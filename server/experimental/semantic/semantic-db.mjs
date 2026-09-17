import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  SEMANTIC_DB_SCHEMA,SEMANTIC_DB_SCHEMA_VERSION,SEMANTIC_SCHEMA_VERSION,SEMANTIC_COMPILER_VERSION,
  validateSemanticCard
} from "./schema.mjs";
import { compileCard } from "./compiler.mjs";
import { streamJsonRecords } from "./json-stream.mjs";
import { sha256File, writeJsonAtomic } from "./provenance.mjs";
import { semanticDbEngineFingerprint, semanticDbEngineVersions } from "./engine-versions.mjs";

const drain=out=>new Promise(resolve=>out.once("drain",resolve));

export async function writeSemanticDb(records,filePath,{source=null,inputSha256=null,inputUpdatedAt=null,sourceSnapshotId=null,buildMode="full"}={}){
  await fs.promises.mkdir(path.dirname(filePath),{recursive:true});
  const out=fs.createWriteStream(filePath,{encoding:"utf8"});let count=0,schemaErrors=0,compiled=0,reused=0;
  const header={
    recordType:"header",schema:SEMANTIC_DB_SCHEMA,schemaVersion:SEMANTIC_DB_SCHEMA_VERSION,
    semanticSchemaVersion:SEMANTIC_SCHEMA_VERSION,compilerVersion:SEMANTIC_COMPILER_VERSION,
    semanticDbEngineFingerprint:semanticDbEngineFingerprint(),source,inputSha256,inputUpdatedAt,sourceSnapshotId,buildMode,createdAt:new Date().toISOString()
  };
  out.write(JSON.stringify(header)+"\n");
  for await (const item of records){
    const card=item?.card??item;const mode=item?.mode||"compiled";
    const errors=validateSemanticCard(card);if(errors.length){schemaErrors++;throw new Error(`Semantic schema validation failed for ${card?.oracleId||"unknown"}: ${errors.join(", ")}`);}
    if(!out.write(JSON.stringify({recordType:"card",card})+"\n"))await drain(out);count++;
    if(mode==="reused")reused++;else compiled++;
  }
  await new Promise((resolve,reject)=>{out.end(resolve);out.on("error",reject);});
  return {count,schemaErrors,compiled,reused,header};
}

export async function readSemanticDbHeader(filePath){
  const input=fs.createReadStream(filePath);const rl=readline.createInterface({input,crlfDelay:Infinity});
  for await(const line of rl){const s=line.trim();if(!s)continue;const obj=JSON.parse(s);rl.close();input.destroy();if(obj.recordType!=="header")throw new Error("Semantic DB missing header");return obj;}
  throw new Error("Empty Semantic DB");
}

export async function* readSemanticDb(filePath){
  const input=fs.createReadStream(filePath);const rl=readline.createInterface({input,crlfDelay:Infinity});let sawHeader=false;
  for await(const line of rl){
    const s=line.trim();if(!s)continue;const obj=JSON.parse(s);
    if(!sawHeader){if(obj.recordType!=="header")throw new Error("Semantic DB missing header");sawHeader=true;continue;}
    if(obj.recordType==="card")yield obj.card;
  }
  if(!sawHeader)throw new Error("Empty Semantic DB");
}

async function previousCardMap(previousDbPath){
  const map=new Map();if(!previousDbPath||!fs.existsSync(previousDbPath))return map;
  for await(const card of readSemanticDb(previousDbPath))map.set(card.oracleId,card);
  return map;
}

function refreshNonSemanticProvenance(card,raw,source){
  return {...card,source,provenance:{...(card.provenance||{}),scryfallId:raw.id||card.provenance?.scryfallId||null,lastUpdated:raw.updated_at||card.provenance?.lastUpdated||null}};
}

export async function buildSemanticDb({inputPath,outputPath,manifestPath=`${outputPath}.manifest.json`,source="scryfall-oracle-cards",inputUpdatedAt=null,sourceSnapshotId=null}){
  const inputMeta=await sha256File(inputPath);
  async function* compiled(){for await(const raw of streamJsonRecords(inputPath))yield {card:compileCard(raw,{source}),mode:"compiled"};}
  const written=await writeSemanticDb(compiled(),outputPath,{source,inputSha256:inputMeta.sha256,inputUpdatedAt,sourceSnapshotId,buildMode:"full"});
  const outputMeta=await sha256File(outputPath);
  const manifest={
    schema:"manashelf-semantic-manifest",schemaVersion:2,source,sourceSnapshotId,
    input:{path:inputPath,sha256:inputMeta.sha256,bytes:inputMeta.bytes,updatedAt:inputUpdatedAt},
    output:{path:outputPath,sha256:outputMeta.sha256,bytes:outputMeta.bytes,records:written.count},
    build:{mode:"full",compiled:written.compiled,reused:written.reused},
    engineVersions:semanticDbEngineVersions(),semanticDbEngineFingerprint:semanticDbEngineFingerprint(),createdAt:new Date().toISOString()
  };
  await writeJsonAtomic(manifestPath,manifest);return manifest;
}

export async function buildSemanticDbIncremental({
  inputPath,outputPath,previousDbPath,changedIds,manifestPath=`${outputPath}.manifest.json`,source="scryfall-oracle-cards",inputUpdatedAt=null,sourceSnapshotId=null
}){
  if(!previousDbPath||!fs.existsSync(previousDbPath))return buildSemanticDb({inputPath,outputPath,manifestPath,source,inputUpdatedAt,sourceSnapshotId});
  const previousHeader=await readSemanticDbHeader(previousDbPath);
  const currentFingerprint=semanticDbEngineFingerprint();
  if(previousHeader.semanticDbEngineFingerprint!==currentFingerprint||previousHeader.compilerVersion!==SEMANTIC_COMPILER_VERSION||previousHeader.semanticSchemaVersion!==SEMANTIC_SCHEMA_VERSION){
    return buildSemanticDb({inputPath,outputPath,manifestPath,source,inputUpdatedAt,sourceSnapshotId});
  }
  const inputMeta=await sha256File(inputPath),previous=await previousCardMap(previousDbPath),changed=changedIds instanceof Set?changedIds:new Set(changedIds||[]);
  async function* merged(){
    for await(const raw of streamJsonRecords(inputPath)){
      const oracleId=String(raw.oracle_id||raw.oracleId||raw.id||"").trim();
      const prior=previous.get(oracleId);
      if(prior&&!changed.has(oracleId))yield {card:refreshNonSemanticProvenance(prior,raw,source),mode:"reused"};
      else yield {card:compileCard(raw,{source}),mode:"compiled"};
    }
  }
  const written=await writeSemanticDb(merged(),outputPath,{source,inputSha256:inputMeta.sha256,inputUpdatedAt,sourceSnapshotId,buildMode:"incremental"});
  const outputMeta=await sha256File(outputPath);
  const manifest={
    schema:"manashelf-semantic-manifest",schemaVersion:2,source,sourceSnapshotId,
    input:{path:inputPath,sha256:inputMeta.sha256,bytes:inputMeta.bytes,updatedAt:inputUpdatedAt},
    previous:{path:previousDbPath,records:previous.size},
    output:{path:outputPath,sha256:outputMeta.sha256,bytes:outputMeta.bytes,records:written.count},
    build:{mode:"incremental",compiled:written.compiled,reused:written.reused,requestedChangedIds:changed.size},
    engineVersions:semanticDbEngineVersions(),semanticDbEngineFingerprint:currentFingerprint,createdAt:new Date().toISOString()
  };
  await writeJsonAtomic(manifestPath,manifest);return manifest;
}
