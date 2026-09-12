import fs from "node:fs";
import assert from "node:assert/strict";

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const packageVersion=JSON.parse(read("package.json")).version.replace(/\.0$/,""),versionPattern=new RegExp(packageVersion.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
const docs={
  index:read("docs/README.md"),
  functional:read("docs/FUNCTIONAL_SPEC.md"),
  architecture:read("docs/ARCHITECTURE.md"),
  lab2:read("docs/LAB2_ENGINE_ARCHITECTURE.md"),
  decisions:read("docs/DECISIONS.md"),
  testing:read("docs/TESTING_AND_DIAGNOSTICS.md"),
  planned:read("docs/PLANNED_BRACKETS_AND_COMMANDER_SETS.md")
};
for(const [name,src] of Object.entries(docs))assert.match(src,versionPattern,`${name} documentation must reference current baseline`);
assert.match(docs.architecture,/builder v14 · classification v7 · mana v5 · combo v2 · LAB2 log v8/,"architecture baseline must expose current engine contract");
assert.match(docs.architecture,/```mermaid[\s\S]*flowchart/,"architecture must contain versioned Mermaid diagrams");
assert.match(docs.functional,/complete infinite package[\s\S]*win condition/i,"functional spec must document combo-as-win-condition behavior");
assert.match(docs.decisions,/Castability repair cannot optimize one metric at any cost/,"ADR summary must preserve tactical/quality repair decision");
assert.match(docs.testing,/LAB 2 diagnostic log v8/,"diagnostics documentation must track current schema");
assert.match(docs.testing,/test:archetypes/,"testing documentation must include the shared archetype contract regression");
assert.match(docs.architecture,/archetype-contracts\.mjs/,"architecture must document the shared archetype contract layer");
assert.match(docs.testing,/Do not request routine logs/i,"testing policy must encode the exit from continuous manual logging");
assert.match(docs.decisions,/No commander-specific runtime rules/i,"docs must ban Commander-name runtime branches");
assert.match(docs.planned,/PLANNED \/ NOT IMPLEMENTED/i,"planned architecture must remain explicitly non-runtime");
assert.match(docs.planned,/Commander Set = \[Commander A, Commander B\?\]/,"paired-Commander design must use the general Commander Set abstraction");
console.log("documentation regression test: OK");
