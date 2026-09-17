import fs from "node:fs/promises";
import path from "node:path";
import {assertThemeCorpus} from "./schema.mjs";
import {THEME_CORPUS_SWEEP_AUDIT_SCHEMA,THEME_CORPUS_SWEEP_AUDIT_VERSION} from "./theme-corpus-sweep-audit.mjs";
import {buildKnowledgeDb,validateKnowledgeDb} from "./knowledge-db.mjs";
import {fingerprint,readJsonMaybeGzip,sha256File,writeJsonAtomic} from "./io.mjs";

async function fileOrNull(file){try{return await fs.readFile(file);}catch(e){if(e?.code==="ENOENT")return null;throw e;}}
async function writeBufferAtomic(file,buf){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;await fs.writeFile(tmp,buf);await fs.rename(tmp,file);}
const pass=(value,detail={})=>({pass:Boolean(value),...detail});

export function validateThemeCorpusInstall({corpus,audit,runtimeSha256}={}){
  assertThemeCorpus(corpus);
  const trusted=(corpus.themes||[]).filter(x=>x?.trusted),source=corpus?.provenance?.evidenceSource||corpus?.provenance?.source||{};
  const checks={
    non_empty_trusted:pass(trusted.length>0,{trustedProfiles:trusted.length}),
    runtime_sha:pass(Boolean(runtimeSha256)&&corpus.runtimeSha256===runtimeSha256,{expected:runtimeSha256||null,actual:corpus.runtimeSha256||null}),
    independent_training:pass(source?.independentFromValidation===true,{source}),
    audit_schema:pass(audit?.schema===THEME_CORPUS_SWEEP_AUDIT_SCHEMA&&Number(audit?.schemaVersion)===THEME_CORPUS_SWEEP_AUDIT_VERSION,{schema:audit?.schema||null,schemaVersion:audit?.schemaVersion??null}),
    audit_pass:pass(audit?.decision==="PASS",{decision:audit?.decision||null}),
    audit_corpus_fingerprint:pass(Boolean(corpus.fingerprint)&&audit?.corpusFingerprint===corpus.fingerprint,{expected:corpus.fingerprint||null,actual:audit?.corpusFingerprint||null}),
    audit_runtime_sha:pass(Boolean(runtimeSha256)&&audit?.runtimeSha256===runtimeSha256,{expected:runtimeSha256||null,actual:audit?.runtimeSha256||null}),
    audit_trusted_count:pass(Number(audit?.summary?.trustedProfiles??-1)===trusted.length,{expected:trusted.length,actual:audit?.summary?.trustedProfiles??null}),
    sweep_fingerprint:pass(Boolean(audit?.sweepFingerprint),{value:audit?.sweepFingerprint||null})
  };
  const failures=Object.entries(checks).filter(([,x])=>!x.pass).map(([name])=>name);
  return {ok:failures.length===0,failures,checks};
}

export async function installThemeCorpusCandidate({candidatePath,auditPath,runtimePath,targetThemePath,knowledgePath,receiptPath=null,metadata={}}={}){
  if(!candidatePath||!auditPath||!runtimePath||!targetThemePath||!knowledgePath)throw new Error("Theme Corpus install requires candidatePath, auditPath, runtimePath, targetThemePath and knowledgePath");
  const corpus=assertThemeCorpus(await readJsonMaybeGzip(candidatePath)),audit=JSON.parse(await fs.readFile(auditPath,"utf8")),runtimeSha256=await sha256File(runtimePath),preflight=validateThemeCorpusInstall({corpus,audit,runtimeSha256});
  if(!preflight.ok)throw new Error(`Theme Corpus install blocked: ${preflight.failures.join(", ")}`);
  const oldTheme=await fileOrNull(targetThemePath),oldKnowledge=await fileOrNull(knowledgePath),candidateBytes=await fs.readFile(candidatePath);
  try{
    await writeBufferAtomic(targetThemePath,candidateBytes);
    const targetSha256=await sha256File(targetThemePath),candidateSha256=await sha256File(candidatePath);
    if(targetSha256!==candidateSha256)throw new Error("Installed Theme Corpus bytes do not match candidate bytes");
    const tmpKnowledge=`${knowledgePath}.candidate-${process.pid}-${Date.now()}`;
    const db=await buildKnowledgeDb({runtimePath,themeCorpusPath:targetThemePath,outputPath:tmpKnowledge,metadata:{...metadata,status:"candidate",themeCorpusAuditFingerprint:audit.fingerprint||null,themeCorpusSweepFingerprint:audit.sweepFingerprint||null,evidenceFingerprint:corpus?.provenance?.evidenceFingerprint||null}}),integrity=await validateKnowledgeDb(db,{runtimePath,themeCorpusPath:targetThemePath});
    if(!integrity.ok)throw new Error("Knowledge DB integrity failed after Theme Corpus install");
    await fs.rename(tmpKnowledge,knowledgePath);
    const receipt={schema:"manashelf-theme-corpus-install-receipt",schemaVersion:1,createdAt:new Date().toISOString(),candidate:{path:path.resolve(candidatePath),sha256:candidateSha256,fingerprint:corpus.fingerprint,trustedProfiles:(corpus.themes||[]).filter(x=>x.trusted).length},audit:{path:path.resolve(auditPath),fingerprint:audit.fingerprint||null,sweepFingerprint:audit.sweepFingerprint||null,decision:audit.decision},runtime:{path:path.resolve(runtimePath),sha256:runtimeSha256},installed:{themeCorpusPath:path.resolve(targetThemePath),knowledgePath:path.resolve(knowledgePath),knowledgeIntegrity:"PASS"},preflight};
    receipt.fingerprint=fingerprint({...receipt,createdAt:null,fingerprint:undefined});
    if(receiptPath)await writeJsonAtomic(receiptPath,receipt);
    return receipt;
  }catch(e){
    if(oldTheme!==null)await writeBufferAtomic(targetThemePath,oldTheme);else await fs.rm(targetThemePath,{force:true});
    if(oldKnowledge!==null)await writeBufferAtomic(knowledgePath,oldKnowledge);else await fs.rm(knowledgePath,{force:true});
    throw e;
  }
}
