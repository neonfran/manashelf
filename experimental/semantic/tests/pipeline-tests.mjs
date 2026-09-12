import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { streamJsonRecords } from "../json-stream.mjs";
import { semanticInputHash } from "../semantic-input.mjs";
import { buildRawSemanticDelta } from "../raw-delta.mjs";
import { buildSemanticDb, buildSemanticDbIncremental, readSemanticDb } from "../semantic-db.mjs";
import { semanticDrift } from "../drift.mjs";
import { fetchScryfallBulkDefinitions, downloadScryfallBulkDefinition, SCRYFALL_BULK_API } from "../scryfall-bulk.mjs";
import { updateSemanticCorpus } from "../semantic-update.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const fixturePath=path.resolve(here,"../fixtures/smoke-cards.json");
const fixtures=JSON.parse(fs.readFileSync(fixturePath,"utf8"));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"manashelf-semantic-pipeline-"));

const writeJsonl=(p,rows)=>fs.writeFileSync(p,rows.map(x=>JSON.stringify(x)).join("\n")+"\n");
const writeGzip=(p,content)=>fs.writeFileSync(p,zlib.gzipSync(Buffer.from(content)));
const collect=async iter=>{const out=[];for await(const x of iter)out.push(x);return out;};

// gzip input supports both JSONL and legacy JSON-array shapes.
const gzJsonl=path.join(temp,"cards.jsonl.gz");writeGzip(gzJsonl,fixtures.slice(0,3).map(x=>JSON.stringify(x)).join("\n")+"\n");
assert.equal((await collect(streamJsonRecords(gzJsonl))).length,3);
const gzArray=path.join(temp,"cards.json.gz");writeGzip(gzArray,JSON.stringify(fixtures.slice(0,4)));
assert.equal((await collect(streamJsonRecords(gzArray))).length,4);

// Cosmetic Scryfall fields do not invalidate semantic input; semantic fields do.
const base={...fixtures[0],prices:{usd:"1.00"},image_uris:{normal:"a"}};
assert.equal(semanticInputHash(base),semanticInputHash({...base,prices:{usd:"99.99"},image_uris:{normal:"b"}}));
assert.notEqual(semanticInputHash(base),semanticInputHash({...base,oracle_text:`${base.oracle_text} Draw a card.`}));

// Raw delta: added/changed/removed/unchanged + cosmetic-only raw change.
const before=fixtures.slice(0,4).map((x,i)=>({...x,prices:{usd:String(i+1)}}));
const after=[
  {...before[0],prices:{usd:"777"}},
  {...before[1],oracle_text:`${before[1].oracle_text} Draw a card.`},
  before[2],
  fixtures[4]
];
const beforePath=path.join(temp,"before.jsonl"),beforeIndex=path.join(temp,"before.index.jsonl");writeJsonl(beforePath,before);
const initial=await buildRawSemanticDelta({inputPath:beforePath,indexPath:beforeIndex,upsertPath:path.join(temp,"before.upsert.jsonl")});
assert.equal(initial.counts.added,4);assert.equal(initial.counts.compileRequired,4);
const afterPath=path.join(temp,"after.jsonl.gz");writeGzip(afterPath,after.map(x=>JSON.stringify(x)).join("\n")+"\n");
const afterIndex=path.join(temp,"after.index.jsonl");
const delta=await buildRawSemanticDelta({inputPath:afterPath,indexPath:afterIndex,previousIndexPath:beforeIndex,upsertPath:path.join(temp,"after.upsert.jsonl"),removedPath:path.join(temp,"removed.json")});
assert.deepEqual(delta.counts,{total:4,added:1,semanticChanged:1,removed:1,semanticUnchanged:2,rawChangedSemanticUnchanged:1,duplicateOracleIds:0,compileRequired:2});

// Incremental compilation is semantically identical to a fresh full rebuild.
const dbBefore=path.join(temp,"before.semantic.jsonl"),dbIncremental=path.join(temp,"after.incremental.jsonl"),dbFull=path.join(temp,"after.full.jsonl");
await buildSemanticDb({inputPath:beforePath,outputPath:dbBefore,source:"pipeline-test",sourceSnapshotId:"before"});
const incManifest=await buildSemanticDbIncremental({inputPath:afterPath,outputPath:dbIncremental,previousDbPath:dbBefore,changedIds:delta.changedIds,source:"pipeline-test",sourceSnapshotId:"after"});
assert.equal(incManifest.build.compiled,2);assert.equal(incManifest.build.reused,2);
await buildSemanticDb({inputPath:afterPath,outputPath:dbFull,source:"pipeline-test",sourceSnapshotId:"after"});
const incVsFull=await semanticDrift(dbIncremental,dbFull);assert.equal(incVsFull.counts.changed,0);assert.equal(incVsFull.counts.added,0);assert.equal(incVsFull.counts.removed,0);
const sourceDrift=await semanticDrift(dbBefore,dbIncremental);assert.equal(sourceDrift.counts.added,1);assert.equal(sourceDrift.counts.removed,1);assert.equal(sourceDrift.counts.changed,1);

// Downloader and complete source/build pipeline with an in-memory fake Scryfall server.
function makeDefinitions(version,{rulingsVersion=version}={}){
  const stamp=v=>`2026-09-${String(10+v).padStart(2,"0")}T00:00:00.000+00:00`;
  return [
    {object:"bulk_data",id:`oracle-${version}`,type:"oracle_cards",name:"Oracle Cards",updated_at:stamp(version),jsonl_download_uri:`https://data.test/oracle-v${version}.jsonl.gz`,download_uri:`https://data.test/oracle-v${version}.json`},
    {object:"bulk_data",id:`rulings-${rulingsVersion}`,type:"rulings",name:"Rulings",updated_at:stamp(rulingsVersion),jsonl_download_uri:`https://data.test/rulings-v${rulingsVersion}.jsonl.gz`,download_uri:`https://data.test/rulings-v${rulingsVersion}.json`}
  ];
}
const oracleV1=before,oracleV2=after;
const rulings=[{oracle_id:before[0].oracle_id,published_at:"2026-01-01",source:"wotc",comment:"Test ruling."}];
function fakeFetchFactory(defs){
  const bodies=new Map([
    ["https://data.test/oracle-v1.jsonl.gz",zlib.gzipSync(Buffer.from(oracleV1.map(x=>JSON.stringify(x)).join("\n")+"\n"))],
    ["https://data.test/oracle-v2.jsonl.gz",zlib.gzipSync(Buffer.from(oracleV2.map(x=>JSON.stringify(x)).join("\n")+"\n"))],
    ["https://data.test/rulings-v1.jsonl.gz",zlib.gzipSync(Buffer.from(rulings.map(x=>JSON.stringify(x)).join("\n")+"\n"))]
  ]);
  return async url=>{
    url=String(url);
    if(url===SCRYFALL_BULK_API)return new Response(JSON.stringify({object:"list",data:defs}),{status:200,headers:{"content-type":"application/json"}});
    if(bodies.has(url))return new Response(bodies.get(url),{status:200,headers:{"content-type":"application/gzip"}});
    throw new Error(`unexpected fake URL ${url}`);
  };
}
const meta=await fetchScryfallBulkDefinitions({fetchImpl:fakeFetchFactory(makeDefinitions(1,{rulingsVersion:1}))});
assert.equal(meta.definitions.oracle_cards.preferredFormat,"jsonl-gzip");
const standalone=await downloadScryfallBulkDefinition(meta.definitions.oracle_cards,path.join(temp,"standalone"),{fetchImpl:fakeFetchFactory(makeDefinitions(1,{rulingsVersion:1}))});
assert.ok(standalone.path.endsWith(".jsonl.gz"));assert.equal((await collect(streamJsonRecords(standalone.path))).length,4);

const corpusDir=path.join(temp,"corpus");
const firstRun=await updateSemanticCorpus({dataDir:corpusDir,fetchImpl:fakeFetchFactory(makeDefinitions(1,{rulingsVersion:1})),compareClassification7:false});
assert.equal(firstRun.source.manifest.delta.counts.compileRequired,4);assert.equal(firstRun.build.runManifest.semanticDb.build.compiled,4);
const secondRun=await updateSemanticCorpus({dataDir:corpusDir,fetchImpl:fakeFetchFactory(makeDefinitions(2,{rulingsVersion:1})),compareClassification7:false});
assert.equal(secondRun.source.manifest.delta.counts.compileRequired,2);assert.equal(secondRun.source.manifest.delta.counts.rawChangedSemanticUnchanged,1);
assert.equal(secondRun.build.runManifest.semanticDb.build.mode,"incremental");assert.equal(secondRun.build.runManifest.semanticDb.build.compiled,2);assert.equal(secondRun.build.runManifest.semanticDb.build.reused,2);
const thirdRun=await updateSemanticCorpus({dataDir:corpusDir,fetchImpl:fakeFetchFactory(makeDefinitions(2,{rulingsVersion:1})),compareClassification7:false});
assert.equal(thirdRun.source.changed,false,"identical Scryfall metadata must skip source download/update");

console.log("semantic pipeline tests: OK · gzip + snapshots + delta + incremental rebuild");
