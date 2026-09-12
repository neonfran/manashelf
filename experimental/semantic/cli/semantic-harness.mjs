#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSemanticDb, readSemanticDb } from "../semantic-db.mjs";
import { buildRulingsDb } from "../rulings-db.mjs";
import { auditCards } from "../audit.mjs";
import { semanticDrift } from "../drift.mjs";
import { writeJsonAtomic } from "../provenance.mjs";
import { inspectLab2LogFile } from "../lab2-baseline.mjs";
import { updateScryfallSource, buildCurrentSemanticCorpus, updateSemanticCorpus } from "../semantic-update.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
let args=[];
const opt=name=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:null;};
const flag=name=>args.includes(`--${name}`);
const need=name=>{const v=opt(name);if(!v)throw new Error(`Missing --${name}`);return path.resolve(v);};
const dataDir=()=>path.resolve(opt("data-dir")||process.env.MANASHELF_SEMANTIC_DATA_DIR||path.join(os.homedir(),".manashelf","semantic-lab3"));

async function smoke(){
  const fixture=path.join(root,"fixtures/smoke-cards.json"),temp=fs.mkdtempSync(path.join(os.tmpdir(),"manashelf-semantic-smoke-")),db=path.join(temp,"semantic.jsonl");
  const manifest=await buildSemanticDb({inputPath:fixture,outputPath:db,source:"synthetic-smoke"});
  const audit=await auditCards(readSemanticDb(db));
  console.log(JSON.stringify({ok:true,manifest:{records:manifest.output.records,inputSha256:manifest.input.sha256,outputSha256:manifest.output.sha256},coverage:audit.coverage,anomalyFamilies:audit.anomalyFamilies,structuralContradictions:audit.structuralContradictions},null,2));
}
async function build(){const manifest=await buildSemanticDb({inputPath:need("input"),outputPath:need("output"),manifestPath:opt("manifest")?path.resolve(opt("manifest")):undefined,source:opt("source")||"scryfall-oracle-cards",inputUpdatedAt:opt("updated-at")});console.log(JSON.stringify(manifest,null,2));}
async function rulings(){const manifest=await buildRulingsDb({inputPath:need("input"),outputPath:need("output"),manifestPath:opt("manifest")?path.resolve(opt("manifest")):undefined,inputUpdatedAt:opt("updated-at")});console.log(JSON.stringify(manifest,null,2));}
async function audit(){const db=need("db"),report=await auditCards(readSemanticDb(db),{compareClassification7:!flag("no-c7")});if(opt("output"))await writeJsonAtomic(path.resolve(opt("output")),report);console.log(JSON.stringify(report,null,2));}
async function drift(){const report=await semanticDrift(need("before"),need("after"));if(opt("output"))await writeJsonAtomic(path.resolve(opt("output")),report);console.log(JSON.stringify(report,null,2));}
function lab2Log(){console.log(JSON.stringify(inspectLab2LogFile(need("input")),null,2));}
async function sourceUpdate(){const result=await updateScryfallSource({dataDir:dataDir(),force:flag("force")});console.log(JSON.stringify({changed:result.changed,sourceId:result.sourceId,manifestPath:result.manifestPath,delta:result.manifest?.delta?.counts||null},null,2));}
async function corpusBuild(){const result=await buildCurrentSemanticCorpus({dataDir:dataDir(),force:flag("force"),compareClassification7:!flag("no-c7")});console.log(JSON.stringify({sourceId:result.sourceId,runManifestPath:result.runManifestPath,semanticDb:result.runManifest.semanticDb,audit:result.runManifest.audit,drift:result.runManifest.drift},null,2));}
async function update(){const result=await updateSemanticCorpus({dataDir:dataDir(),forceSource:flag("force-source"),forceBuild:flag("force-build"),compareClassification7:!flag("no-c7")});console.log(JSON.stringify({source:{changed:result.source.changed,sourceId:result.source.sourceId,delta:result.source.manifest?.delta?.counts||null},runManifestPath:result.build.runManifestPath,semanticDb:result.build.runManifest.semanticDb,audit:result.build.runManifest.audit,drift:result.build.runManifest.drift},null,2));}
function help(){console.log(`ManaShelf Semantic Harness\n\nCommands:\n  smoke\n  build --input oracle-cards.json[.gz] --output semantic.jsonl [--manifest file] [--source label] [--updated-at ISO]\n  rulings --input rulings.json[.gz] --output rulings.jsonl [--manifest file] [--updated-at ISO]\n  audit --db semantic.jsonl [--output audit.json] [--no-c7]\n  drift --before old.jsonl --after new.jsonl [--output drift.json]\n  lab2-log --input LAB2-build-log.json\n  source-update [--data-dir DIR] [--force]\n  corpus-build [--data-dir DIR] [--force] [--no-c7]\n  update [--data-dir DIR] [--force-source] [--force-build] [--no-c7]\n\nDefault data dir: ~/.manashelf/semantic-lab3 (override with --data-dir or MANASHELF_SEMANTIC_DATA_DIR).\nThe update command resolves Scryfall Bulk metadata, stores source snapshots separately from engine builds, computes oracle_id semantic deltas, reuses unchanged compiled cards when the compiler fingerprint matches, and writes a versioned audit/run manifest.`);}

export async function main(argv=process.argv.slice(2)){
  args=[...argv];const command=args.shift()||"help";
  if(command==="smoke")await smoke();else if(command==="build")await build();else if(command==="rulings")await rulings();else if(command==="audit")await audit();else if(command==="drift")await drift();else if(command==="lab2-log")lab2Log();else if(command==="source-update")await sourceUpdate();else if(command==="corpus-build")await corpusBuild();else if(command==="update")await update();else help();
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){try{await main();}catch(err){console.error(err?.stack||String(err));process.exitCode=1;}}
