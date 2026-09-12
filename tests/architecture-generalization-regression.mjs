import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const runtime=[
  "server.mjs",
  "public/app.js",
  ...fs.readdirSync(path.join(root,"lib")).filter(x=>x.endsWith(".mjs")).map(x=>`lib/${x}`)
];
// Fixture names are intentionally concrete. They may appear in tests, never in runtime logic.
const fixtureCommanders=[
  "Kess, Dissident Mage",
  "Animar, Soul of Elements",
  "Koma, Cosmos Serpent",
  "Arahbo, Roar of the World",
  "Judith, Carnage Connoisseur",
  "Deadpool, Trading Card",
  "Cosmic Spider-Man",
  "Kotis, the Fangkeeper",
  "Token Matriarch",
  "Tri Sage",
  "Guard Wizard",
  "Combo Sage",
  "Structure Commander",
  "Drafna, Founder of Lat-Nam",
  "Izzet Boilerworks",
  "Deadly Dispute",
  "Arcum's Astrolabe",
  "Carnival of Souls",
  "Rhonas\'s Monument",
  "Deeproot Waters",
  "Don Andres, the Renegade",
  "Captain Lannery Storm",
  "Treacherous Blessing"
];
for(const rel of runtime){
  const src=fs.readFileSync(path.join(root,rel),"utf8");
  for(const name of fixtureCommanders){
    assert.ok(!src.includes(name),`${rel} must not contain commander-specific runtime rule/fixture name: ${name}`);
  }
}

const server=fs.readFileSync(path.join(root,"server.mjs"),"utf8");
assert.ok(!server.includes("function themeSignals("),"server must not keep a parallel Oracle-regex theme classifier");
assert.match(server,/const themeHits=themes\.slice\(0,3\)\.filter\(t=>edhrecTagEvidence\(t\.name,c\.meta\)>0\)\.length/ ,"CUT scoring must consume the shared archetype evaluator");
const decisions=fs.readFileSync(path.join(root,"docs/DECISIONS.md"),"utf8");
assert.match(decisions,/No commander-specific runtime rules/i,"architecture decision must explicitly ban Commander-name runtime branches");
assert.match(decisions,/Hard rules[\s\S]*Explicit strong requirements[\s\S]*Structural health[\s\S]*Mana \/ castability[\s\S]*Archetype \/ theme[\s\S]*Soft preferences/i,"constraint hierarchy must be documented");
console.log("architecture generalization regression: OK");
