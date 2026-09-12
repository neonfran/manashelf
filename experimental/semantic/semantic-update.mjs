import fs from "node:fs";
import path from "node:path";
import { fetchScryfallBulkDefinitions, downloadScryfallBulkDefinition, writeBulkMetadataSnapshot } from "./scryfall-bulk.mjs";
import { buildRawSemanticDelta } from "./raw-delta.mjs";
import { streamJsonRecords } from "./json-stream.mjs";
import { buildSemanticDb, buildSemanticDbIncremental, readSemanticDb } from "./semantic-db.mjs";
import { buildRulingsDb, RULINGS_DB_SCHEMA_VERSION } from "./rulings-db.mjs";
import { auditCards } from "./audit.mjs";
import { semanticDrift } from "./drift.mjs";
import { sha256File, sha256Object, writeJsonAtomic } from "./provenance.mjs";
import {
  SOURCE_SNAPSHOT_SCHEMA_VERSION,SEMANTIC_UPDATE_PIPELINE_VERSION,
  semanticDbEngineFingerprint,analysisEngineFingerprint,semanticDbEngineVersions,analysisEngineVersions
} from "./engine-versions.mjs";

const exists=p=>Boolean(p)&&fs.existsSync(p);
const short=s=>String(s||"").slice(0,12);
const rel=(root,p)=>path.relative(root,p).replaceAll(path.sep,"/");
const abs=(root,p)=>path.resolve(root,p);
const safeStamp=iso=>String(iso||new Date().toISOString()).replace(/[-:]/g,"").replace(/\.\d{3}(?=Z|[+-])/g,"").replace(/\+00:00$/,"Z").replace(/[^0-9TZ]/g,"");

async function readJson(filePath){return JSON.parse(await fs.promises.readFile(filePath,"utf8"));}
async function readJsonIfExists(filePath){try{return await readJson(filePath);}catch(err){if(err?.code==="ENOENT")return null;throw err;}}

function definitionComparable(def){return {type:def.type,updatedAt:def.updatedAt,preferredDownloadUri:def.preferredDownloadUri,preferredFormat:def.preferredFormat};}
function sourceIdFor(metadata){
  const defs=metadata.definitions;const times=Object.values(defs).map(x=>Date.parse(x.updatedAt)).filter(Number.isFinite);
  const latest=times.length?new Date(Math.max(...times)).toISOString():metadata.fetchedAt;
  return `${safeStamp(latest)}-${sha256Object(Object.fromEntries(Object.entries(defs).map(([k,v])=>[k,definitionComparable(v)]))).slice(0,10)}`;
}
function sameDefinition(a,b){return Boolean(a&&b)&&a.updatedAt===b.updatedAt&&a.preferredDownloadUri===b.preferredDownloadUri;}

async function copyDataset(previousPath,stagingRawDir){
  const target=path.join(stagingRawDir,path.basename(previousPath));await fs.promises.copyFile(previousPath,target);const meta=await sha256File(target);return {path:target,sha256:meta.sha256,bytes:meta.bytes,reused:true};
}

async function resolveLatestSource(dataDir){
  const state=await readJsonIfExists(path.join(dataDir,"state/latest-source.json"));
  if(!state)return null;
  const manifestPath=abs(dataDir,state.manifestPath);if(!exists(manifestPath))return null;
  return {state,manifest:await readJson(manifestPath),manifestPath};
}

export async function updateScryfallSource({dataDir,fetchImpl=globalThis.fetch,force=false}={}){
  if(!dataDir)throw new Error("updateScryfallSource requires dataDir");dataDir=path.resolve(dataDir);
  await fs.promises.mkdir(path.join(dataDir,"state"),{recursive:true});
  const metadata=await fetchScryfallBulkDefinitions({fetchImpl});
  const resolvedPrevious=await resolveLatestSource(dataDir),sourceId=sourceIdFor(metadata);
  const previous=(resolvedPrevious?.manifest?.sourceId===sourceId&&force)?null:resolvedPrevious;
  if(previous&&!force){
    const prevDefs=previous.manifest.definitions||{};
    if(Object.entries(metadata.definitions).every(([type,def])=>sameDefinition(prevDefs[type],def))){
      return {changed:false,sourceId:previous.manifest.sourceId,manifest:previous.manifest,manifestPath:previous.manifestPath,previousSourceId:previous.manifest.previousSourceId||null};
    }
  }
  const finalDir=path.join(dataDir,"sources",sourceId),stagingDir=`${finalDir}.staging-${process.pid}`;
  if(exists(finalDir)&&!force){
    const manifestPath=path.join(finalDir,"source-manifest.json"),manifest=await readJson(manifestPath);
    await writeJsonAtomic(path.join(dataDir,"state/latest-source.json"),{sourceId,manifestPath:rel(dataDir,manifestPath),updatedAt:new Date().toISOString()});
    return {changed:true,sourceId,manifest,manifestPath,previousSourceId:manifest.previousSourceId||null,reusedExisting:true};
  }
  await fs.promises.rm(stagingDir,{recursive:true,force:true});
  const rawDir=path.join(stagingDir,"raw"),indexDir=path.join(stagingDir,"indexes"),deltaDir=path.join(stagingDir,"delta");
  await Promise.all([fs.promises.mkdir(rawDir,{recursive:true}),fs.promises.mkdir(indexDir,{recursive:true}),fs.promises.mkdir(deltaDir,{recursive:true})]);
  await writeBulkMetadataSnapshot(path.join(stagingDir,"bulk-metadata.json"),metadata);

  const datasets={};
  for(const [type,def] of Object.entries(metadata.definitions)){
    const prevDataset=previous?.manifest?.datasets?.[type],prevDef=previous?.manifest?.definitions?.[type];
    if(previous&&sameDefinition(prevDef,def)&&prevDataset?.file&&exists(abs(dataDir,prevDataset.file))){
      const copied=await copyDataset(abs(dataDir,prevDataset.file),rawDir);
      datasets[type]={...definitionComparable(def),file:rel(dataDir,copied.path.replace(stagingDir,finalDir)),sha256:copied.sha256,bytes:copied.bytes,reusedFromSourceId:previous.manifest.sourceId};
    }else{
      const downloaded=await downloadScryfallBulkDefinition(def,rawDir,{fetchImpl,fileBase:type});
      datasets[type]={...definitionComparable(def),file:rel(dataDir,downloaded.path.replace(stagingDir,finalDir)),sha256:downloaded.sha256,bytes:downloaded.bytes,reusedFromSourceId:null};
    }
  }

  const oracleStagePath=path.join(stagingDir,path.relative(finalDir,abs(dataDir,datasets.oracle_cards.file)));
  const oracleIndexStage=path.join(indexDir,"oracle-semantic-index.jsonl"),upsertStage=path.join(deltaDir,"oracle-upsert.jsonl"),removedStage=path.join(deltaDir,"oracle-removed.json"),deltaReportStage=path.join(deltaDir,"oracle-delta.json");
  const previousIndex=previous?.manifest?.oracleIndex?.file&&exists(abs(dataDir,previous.manifest.oracleIndex.file))?abs(dataDir,previous.manifest.oracleIndex.file):null;
  const delta=await buildRawSemanticDelta({inputPath:oracleStagePath,indexPath:oracleIndexStage,previousIndexPath:previousIndex,upsertPath:upsertStage,removedPath:removedStage,reportPath:deltaReportStage,sourceUpdatedAt:datasets.oracle_cards.updatedAt,sourceSha256:datasets.oracle_cards.sha256});

  const finalIndexPath=oracleIndexStage.replace(stagingDir,finalDir),finalDeltaPath=deltaReportStage.replace(stagingDir,finalDir),finalUpsertPath=upsertStage.replace(stagingDir,finalDir),finalRemovedPath=removedStage.replace(stagingDir,finalDir);
  const manifest={
    schema:"manashelf-scryfall-source-snapshot",schemaVersion:SOURCE_SNAPSHOT_SCHEMA_VERSION,sourceId,createdAt:new Date().toISOString(),
    previousSourceId:previous?.manifest?.sourceId||null,api:metadata.api,fetchedAt:metadata.fetchedAt,
    definitions:Object.fromEntries(Object.entries(metadata.definitions).map(([k,v])=>[k,definitionComparable(v)])),datasets,
    oracleIndex:{file:rel(dataDir,finalIndexPath),sha256:delta.current.indexSha256,records:delta.current.records},
    delta:{file:rel(dataDir,finalDeltaPath),upsertFile:rel(dataDir,finalUpsertPath),removedFile:rel(dataDir,finalRemovedPath),counts:delta.counts}
  };
  await writeJsonAtomic(path.join(stagingDir,"source-manifest.json"),manifest);
  await fs.promises.mkdir(path.dirname(finalDir),{recursive:true});
  if(exists(finalDir))await fs.promises.rm(finalDir,{recursive:true,force:true});
  await fs.promises.rename(stagingDir,finalDir);
  const manifestPath=path.join(finalDir,"source-manifest.json");
  await writeJsonAtomic(path.join(dataDir,"state/latest-source.json"),{sourceId,manifestPath:rel(dataDir,manifestPath),updatedAt:new Date().toISOString()});
  return {changed:true,sourceId,manifest,manifestPath,previousSourceId:manifest.previousSourceId,delta};
}

async function changedIdsFromUpsert(filePath){const set=new Set();if(!exists(filePath))return set;for await(const raw of streamJsonRecords(filePath)){const id=String(raw.oracle_id||raw.oracleId||"").trim();if(id)set.add(id);}return set;}

function semanticDbPath(dataDir,sourceId){const fp=semanticDbEngineFingerprint();return path.join(dataDir,"compiled",sourceId,short(fp),"semantic-db.jsonl");}
function rulingsDbPath(dataDir,sourceId){return path.join(dataDir,"compiled",sourceId,`rulings-v${RULINGS_DB_SCHEMA_VERSION}`,"rulings-db.jsonl");}
function analysisDir(dataDir,sourceId){return path.join(dataDir,"analysis",sourceId,short(analysisEngineFingerprint()));}

export async function buildCurrentSemanticCorpus({dataDir,sourceResult=null,compareClassification7=true,force=false}={}){
  if(!dataDir)throw new Error("buildCurrentSemanticCorpus requires dataDir");dataDir=path.resolve(dataDir);
  const source=sourceResult||await resolveLatestSource(dataDir);if(!source)throw new Error("No Scryfall source snapshot is available");
  const manifest=source.manifest,sourceId=manifest.sourceId;
  const oraclePath=abs(dataDir,manifest.datasets.oracle_cards.file),rulingsPath=abs(dataDir,manifest.datasets.rulings.file);
  const dbPath=semanticDbPath(dataDir,sourceId),dbManifestPath=`${dbPath}.manifest.json`;
  let dbManifest=await readJsonIfExists(dbManifestPath);
  if(force||!dbManifest||!exists(dbPath)){
    const previousSourceId=manifest.previousSourceId,previousDb=previousSourceId?semanticDbPath(dataDir,previousSourceId):null;
    const changedIds=await changedIdsFromUpsert(abs(dataDir,manifest.delta.upsertFile));
    if(previousDb&&exists(previousDb))dbManifest=await buildSemanticDbIncremental({inputPath:oraclePath,outputPath:dbPath,previousDbPath:previousDb,changedIds,manifestPath:dbManifestPath,source:"scryfall-oracle-cards",inputUpdatedAt:manifest.datasets.oracle_cards.updatedAt,sourceSnapshotId:sourceId});
    else dbManifest=await buildSemanticDb({inputPath:oraclePath,outputPath:dbPath,manifestPath:dbManifestPath,source:"scryfall-oracle-cards",inputUpdatedAt:manifest.datasets.oracle_cards.updatedAt,sourceSnapshotId:sourceId});
  }

  const rulingsPathOut=rulingsDbPath(dataDir,sourceId),rulingsManifestPath=`${rulingsPathOut}.manifest.json`;
  let rulingsManifest=await readJsonIfExists(rulingsManifestPath);
  if(force||!rulingsManifest||!exists(rulingsPathOut))rulingsManifest=await buildRulingsDb({inputPath:rulingsPath,outputPath:rulingsPathOut,manifestPath:rulingsManifestPath,inputUpdatedAt:manifest.datasets.rulings.updatedAt});

  const aDir=analysisDir(dataDir,sourceId),auditPath=path.join(aDir,"audit.json"),driftPath=path.join(aDir,"semantic-drift.json"),runManifestPath=path.join(aDir,"run-manifest.json");
  let audit=await readJsonIfExists(auditPath);
  if(force||!audit){audit=await auditCards(readSemanticDb(dbPath),{compareClassification7});await writeJsonAtomic(auditPath,audit);}

  let drift=null;const previousSourceId=manifest.previousSourceId,previousDb=previousSourceId?semanticDbPath(dataDir,previousSourceId):null;
  if(previousDb&&exists(previousDb)){drift=await semanticDrift(previousDb,dbPath);await writeJsonAtomic(driftPath,drift);}
  const [dbMeta,rulingsMeta,auditMeta]=await Promise.all([sha256File(dbPath),sha256File(rulingsPathOut),sha256File(auditPath)]);
  const runManifest={
    schema:"manashelf-semantic-corpus-run",schemaVersion:1,pipelineVersion:SEMANTIC_UPDATE_PIPELINE_VERSION,createdAt:new Date().toISOString(),sourceId,
    sourceManifest:rel(dataDir,source.manifestPath||path.join(dataDir,"sources",sourceId,"source-manifest.json")),
    sourceDelta:manifest.delta.counts,
    semanticDb:{file:rel(dataDir,dbPath),manifest:rel(dataDir,dbManifestPath),sha256:dbMeta.sha256,bytes:dbMeta.bytes,records:dbManifest.output.records,build:dbManifest.build},
    rulingsDb:{file:rel(dataDir,rulingsPathOut),manifest:rel(dataDir,rulingsManifestPath),sha256:rulingsMeta.sha256,bytes:rulingsMeta.bytes,records:rulingsManifest.output.records},
    audit:{file:rel(dataDir,auditPath),sha256:auditMeta.sha256,coverage:audit.coverage,cards:audit.cards,clauses:audit.clauses,anomalyFamilies:audit.anomalyFamilies,structuralContradictions:audit.structuralContradictions},
    drift:drift?{file:rel(dataDir,driftPath),counts:drift.counts}:null,
    engines:{semanticDb:semanticDbEngineVersions(),analysis:analysisEngineVersions(),semanticDbFingerprint:semanticDbEngineFingerprint(),analysisFingerprint:analysisEngineFingerprint()},
    compareClassification7
  };
  await writeJsonAtomic(runManifestPath,runManifest);
  await writeJsonAtomic(path.join(dataDir,"state/latest-run.json"),{sourceId,runManifestPath:rel(dataDir,runManifestPath),updatedAt:new Date().toISOString()});
  return {sourceId,dbManifest,rulingsManifest,audit,drift,runManifest,runManifestPath};
}

export async function updateSemanticCorpus({dataDir,fetchImpl=globalThis.fetch,forceSource=false,forceBuild=false,compareClassification7=true}={}){
  const source=await updateScryfallSource({dataDir,fetchImpl,force:forceSource});
  const build=await buildCurrentSemanticCorpus({dataDir,sourceResult:source,compareClassification7,force:forceBuild});
  return {source,build};
}

export const semanticUpdateInternals={sourceIdFor,sameDefinition,definitionComparable,semanticDbPath,rulingsDbPath,analysisDir,resolveLatestSource,changedIdsFromUpsert};
