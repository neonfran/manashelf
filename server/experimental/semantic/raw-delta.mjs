import fs from "node:fs";
import readline from "node:readline";
import { streamJsonRecords } from "./json-stream.mjs";
import { semanticInputHash, rawRecordHash } from "./semantic-input.mjs";
import { sha256File, writeJsonAtomic } from "./provenance.mjs";
import { RAW_SEMANTIC_INDEX_VERSION, RAW_DELTA_VERSION } from "./engine-versions.mjs";

const writeLine=async(out,obj)=>{if(!out.write(JSON.stringify(obj)+"\n"))await new Promise(resolve=>out.once("drain",resolve));};

export async function loadRawSemanticIndex(indexPath){
  const map=new Map();
  if(!indexPath||!fs.existsSync(indexPath))return {header:null,map};
  const input=fs.createReadStream(indexPath);const rl=readline.createInterface({input,crlfDelay:Infinity});let header=null;
  for await(const line of rl){
    const s=line.trim();if(!s)continue;const obj=JSON.parse(s);
    if(!header){header=obj;continue;}
    if(obj.recordType==="card"&&obj.oracleId)map.set(obj.oracleId,obj);
  }
  return {header,map};
}

export async function buildRawSemanticDelta({
  inputPath,
  indexPath,
  previousIndexPath=null,
  upsertPath=null,
  removedPath=null,
  reportPath=null,
  sourceUpdatedAt=null,
  sourceSha256=null,
  sampleLimit=20
}){
  const previous=(await loadRawSemanticIndex(previousIndexPath)).map;
  const seen=new Set(),changedIds=new Set(),addedIds=new Set();
  const indexOut=fs.createWriteStream(indexPath,{encoding:"utf8"});
  const upsertOut=upsertPath?fs.createWriteStream(upsertPath,{encoding:"utf8"}):null;
  await writeLine(indexOut,{recordType:"header",schema:"manashelf-raw-semantic-index",schemaVersion:RAW_SEMANTIC_INDEX_VERSION,sourceUpdatedAt,sourceSha256,createdAt:new Date().toISOString()});
  let total=0,added=0,semanticChanged=0,semanticUnchanged=0,rawChangedSemanticUnchanged=0,duplicateOracleIds=0;
  const samples={added:[],semanticChanged:[],rawChangedSemanticUnchanged:[],removed:[]};
  for await(const raw of streamJsonRecords(inputPath)){
    const oracleId=String(raw.oracle_id||raw.oracleId||"").trim();
    if(!oracleId)continue;
    if(seen.has(oracleId)){duplicateOracleIds++;continue;}
    seen.add(oracleId);total++;
    const semanticHash=semanticInputHash(raw),rawHash=rawRecordHash(raw),prior=previous.get(oracleId);
    const entry={recordType:"card",oracleId,name:String(raw.name||""),semanticInputHash:semanticHash,rawRecordHash:rawHash};
    await writeLine(indexOut,entry);
    if(!prior){
      added++;addedIds.add(oracleId);changedIds.add(oracleId);
      if(samples.added.length<sampleLimit)samples.added.push({oracleId,name:entry.name});
      if(upsertOut)await writeLine(upsertOut,raw);
    }else if(prior.semanticInputHash!==semanticHash){
      semanticChanged++;changedIds.add(oracleId);
      if(samples.semanticChanged.length<sampleLimit)samples.semanticChanged.push({oracleId,name:entry.name,before:prior.semanticInputHash,after:semanticHash});
      if(upsertOut)await writeLine(upsertOut,raw);
    }else{
      semanticUnchanged++;
      if(prior.rawRecordHash&&prior.rawRecordHash!==rawHash){
        rawChangedSemanticUnchanged++;
        if(samples.rawChangedSemanticUnchanged.length<sampleLimit)samples.rawChangedSemanticUnchanged.push({oracleId,name:entry.name});
      }
    }
  }
  await new Promise((resolve,reject)=>{indexOut.end(resolve);indexOut.on("error",reject);});
  if(upsertOut)await new Promise((resolve,reject)=>{upsertOut.end(resolve);upsertOut.on("error",reject);});
  const removed=[];
  for(const [oracleId,prior] of previous)if(!seen.has(oracleId)){
    removed.push(oracleId);
    if(samples.removed.length<sampleLimit)samples.removed.push({oracleId,name:prior.name||""});
  }
  if(removedPath)await writeJsonAtomic(removedPath,{schema:"manashelf-raw-semantic-removed",schemaVersion:1,oracleIds:removed});
  const indexMeta=await sha256File(indexPath),upsertMeta=upsertPath?await sha256File(upsertPath):null;
  const report={
    schema:"manashelf-raw-semantic-delta",schemaVersion:RAW_DELTA_VERSION,createdAt:new Date().toISOString(),
    source:{inputPath,updatedAt:sourceUpdatedAt,sha256:sourceSha256},
    previous:{indexPath:previousIndexPath||null,records:previous.size},
    current:{indexPath,records:total,indexSha256:indexMeta.sha256},
    counts:{total,added,semanticChanged,removed:removed.length,semanticUnchanged,rawChangedSemanticUnchanged,duplicateOracleIds,compileRequired:added+semanticChanged},
    samples,
    artifacts:{upsertPath:upsertPath||null,upsertSha256:upsertMeta?.sha256||null,removedPath:removedPath||null}
  };
  if(reportPath)await writeJsonAtomic(reportPath,report);
  return {...report,changedIds,addedIds,removedIds:new Set(removed)};
}
