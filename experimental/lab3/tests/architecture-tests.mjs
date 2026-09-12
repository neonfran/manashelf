import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

const context=read("experimental/lab3/deck-context.mjs");
const builder=read("experimental/lab3/builder.mjs");
const catalog=read("experimental/lab3/runtime-catalog.mjs");
const reader=read("experimental/lab3/runtime-reader.mjs");
for(const [name,src] of [["deck-context",context],["builder",builder],["runtime-catalog",catalog],["runtime-reader",reader]]){
  assert(!/oracleText|oracle_text/i.test(src),`${name} must not inspect Oracle text at runtime`);
  assert(!/from\s+["']\.\.\/semantic\/compiler\.mjs["']/.test(src),`${name} must not import semantic compiler`);
}
assert(!/classifyCard|evaluateThemeEvidence/.test(builder),"LAB3 builder must not call Classification 7/theme Oracle classifiers");
assert(!/classifyCard|evaluateThemeEvidence/.test(context),"LAB3 context must not call Classification 7/theme Oracle classifiers");
assert.ok(catalog.includes("./runtime-reader.mjs"),"runtime catalog must use the read-only runtime reader");
assert.ok(!catalog.includes("./runtime-index.mjs"),"runtime catalog must not import the build-time runtime-index/compiler graph");
assert.ok(!reader.includes("semantic/compiler")&&!reader.includes("role-contracts")&&!reader.includes("archetype-contracts"),"runtime reader must be compiler/contract free");

// LAB2 implementation modules remain independent from LAB3.
for(const rel of ["lib/collection-deck-builder.mjs","lib/deck-metrics.mjs","lib/archetype-contracts.mjs"]){
  const src=read(rel);
  assert(!src.includes("experimental/lab3"),`${rel} must not import LAB3`);
}

const method6=path.join(root,"lib/archidekt-size.mjs");
const sha=execFileSync("sha256sum",[method6],{encoding:"utf8"}).trim().split(/\s+/)[0];
assert.equal(sha,"3494fba7dc3b05412d96f8ca9687b723b1495661656c5744d90d124d7d0e23f5","Method 6 hash changed");

console.log("LAB3 architecture isolation tests passed");
