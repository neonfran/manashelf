import fs from "node:fs/promises";
import path from "node:path";
import { loadKnowledgeDb, validateKnowledgeDb } from "../knowledge/knowledge-db.mjs";
import { readRuntimeServingHeader, LAB3_SERVING_RUNTIME_SCHEMA, LAB3_SERVING_RUNTIME_VERSION } from "./runtime-serving.mjs";

export const LAB3_DEPLOYMENT_INTEGRITY_VERSION=2;
export const LAB3_DEPLOYMENT_ASSETS=Object.freeze({
  runtime:"data/lab3-runtime-index.jsonl.gz",
  servingRuntime:"data/lab3-runtime-serving.jsonl.gz",
  themeCorpus:"data/lab3-theme-corpus.json.gz",
  knowledge:"data/lab3-knowledge-db.json"
});

async function statFile(file,label){try{const st=await fs.stat(file);if(!st.isFile())throw new Error("not a file");return st;}catch{throw new Error(`LAB3 deployment asset missing: ${label||file}. The deployed source is incomplete; include the repository data/ directory.`);}}
async function assertGzip(file,label){const fh=await fs.open(file,"r");try{const head=Buffer.alloc(2),{bytesRead}=await fh.read(head,0,2,0);if(bytesRead!==2||head[0]!==0x1f||head[1]!==0x8b)throw new Error(`LAB3 deployment asset is not a valid gzip payload: ${label}`);}finally{await fh.close();}}

export async function checkLab3DeploymentIntegrity({projectRoot=process.cwd()}={}){
  const files={};for(const [key,rel] of Object.entries(LAB3_DEPLOYMENT_ASSETS))files[key]=path.join(projectRoot,...rel.split("/"));
  const [runtimeStat,servingStat,themeStat,knowledgeStat]=await Promise.all([
    statFile(files.runtime,LAB3_DEPLOYMENT_ASSETS.runtime),statFile(files.servingRuntime,LAB3_DEPLOYMENT_ASSETS.servingRuntime),statFile(files.themeCorpus,LAB3_DEPLOYMENT_ASSETS.themeCorpus),statFile(files.knowledge,LAB3_DEPLOYMENT_ASSETS.knowledge)
  ]);
  if(runtimeStat.size<1_000_000)throw new Error(`LAB3 deployment runtime looks truncated: ${LAB3_DEPLOYMENT_ASSETS.runtime} is only ${runtimeStat.size} bytes.`);
  if(servingStat.size<500_000)throw new Error(`LAB3 serving runtime looks truncated: ${LAB3_DEPLOYMENT_ASSETS.servingRuntime} is only ${servingStat.size} bytes.`);
  if(themeStat.size<50)throw new Error(`LAB3 deployment Theme Corpus looks truncated: ${LAB3_DEPLOYMENT_ASSETS.themeCorpus} is only ${themeStat.size} bytes.`);
  if(knowledgeStat.size<100)throw new Error(`LAB3 deployment Knowledge DB looks truncated: ${LAB3_DEPLOYMENT_ASSETS.knowledge} is only ${knowledgeStat.size} bytes.`);
  await Promise.all([assertGzip(files.runtime,LAB3_DEPLOYMENT_ASSETS.runtime),assertGzip(files.servingRuntime,LAB3_DEPLOYMENT_ASSETS.servingRuntime),assertGzip(files.themeCorpus,LAB3_DEPLOYMENT_ASSETS.themeCorpus)]);
  const db=await loadKnowledgeDb(files.knowledge),integrity=await validateKnowledgeDb(db,{runtimePath:files.runtime,themeCorpusPath:files.themeCorpus});
  if(!integrity.ok){const bad=[];if(!integrity.checks.runtime.ok)bad.push("Semantic Runtime SHA");if(!integrity.checks.themeCorpus.ok)bad.push("Theme Corpus SHA");throw new Error(`LAB3 deployment Knowledge integrity mismatch: ${bad.join(" + ")}. Deploy Runtime, Theme Corpus and Knowledge DB from the same certified snapshot.`);}
  const servingHeader=await readRuntimeServingHeader(files.servingRuntime);
  if(servingHeader.schema!==LAB3_SERVING_RUNTIME_SCHEMA||Number(servingHeader.schemaVersion)!==LAB3_SERVING_RUNTIME_VERSION)throw new Error(`LAB3 serving runtime schema mismatch: ${servingHeader.schema||"unknown"} v${servingHeader.schemaVersion||0}.`);
  if(servingHeader.sourceRuntime?.sha256!==integrity.checks.runtime.actual)throw new Error("LAB3 serving runtime source SHA does not match the certified Semantic Runtime. Rebuild the serving index from the deployed Runtime snapshot.");
  return {version:LAB3_DEPLOYMENT_INTEGRITY_VERSION,status:"PASS",assets:{runtime:{path:LAB3_DEPLOYMENT_ASSETS.runtime,bytes:runtimeStat.size,sha256:integrity.checks.runtime.actual},servingRuntime:{path:LAB3_DEPLOYMENT_ASSETS.servingRuntime,bytes:servingStat.size,sourceRuntimeSha256:servingHeader.sourceRuntime.sha256},themeCorpus:{path:LAB3_DEPLOYMENT_ASSETS.themeCorpus,bytes:themeStat.size,sha256:integrity.checks.themeCorpus.actual},knowledge:{path:LAB3_DEPLOYMENT_ASSETS.knowledge,bytes:knowledgeStat.size}}};
}
export async function assertLab3DeploymentIntegrity(options={}){return checkLab3DeploymentIntegrity(options);}
