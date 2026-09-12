import assert from "node:assert/strict";
import { compileCardV5 } from "../../semantic-v2/compiler.mjs";
import { runtimeRecordFromSemanticV2 } from "../runtime-index.mjs";
import { buildLab3Deck } from "../builder.mjs";
import { compareLab2Lab3 } from "../ab-compare.mjs";
import { buildCollectionDeck } from "../../../lib/collection-deck-builder.mjs";

const colors=["U","G"];
const raw=(id,name,typeLine,manaCost,oracleText)=>({id,oracle_id:id,name,layout:"normal",type_line:typeLine,mana_cost:manaCost,cmc:(manaCost.match(/\{/g)||[]).length,oracle_text:oracleText,keywords:[],color_identity:colors,legalities:{commander:"legal"}});
const commanderRaw=raw("multi-cmd","Koma Test","Legendary Creature — Serpent","{3}{G}{G}{U}{U}","At the beginning of each upkeep, create a 3/3 blue Serpent creature token named Koma's Coil.");
const commander=runtimeRecordFromSemanticV2(compileCardV5(commanderRaw));
const commanderMeta={typeLine:commanderRaw.type_line,oracleText:commanderRaw.oracle_text,cmc:7,manaCost:commanderRaw.mana_cost,colorIdentity:colors,legalities:{commander:"legal"},ownedQuantity:1};
const cards=[];
function add(family,i,typeLine,manaCost,oracleText){cards.push(raw(`${family}-${i}`,`${family} Package ${i}`,typeLine,manaCost,oracleText));}
for(let i=0;i<30;i++)add("Token",i,"Creature — Merfolk","{1}{G}{U}","When this creature enters the battlefield, create two 1/1 blue Merfolk creature tokens.");
for(let i=0;i<30;i++)add("Clone",i,"Creature — Shapeshifter","{2}{U}","You may have this creature enter the battlefield as a copy of any creature on the battlefield.");
for(let i=0;i<30;i++)add("Ramp",i,i%2?"Sorcery":"Creature — Druid","{1}{G}",i%2?"Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.":"{T}: Add one mana of any color.");
for(let i=0;i<20;i++)add("Draw",i,"Instant","{1}{U}","Draw two cards.");
for(let i=0;i<18;i++)add("Counter",i,"Instant","{U}{U}","Counter target spell.");
for(let i=0;i<6;i++)add("Wipe",i,"Sorcery","{4}{U}","Return all creatures to their owners' hands.");
for(let i=0;i<8;i++)add("Protection",i,"Instant","{U}","Target creature you control gains hexproof until end of turn.");
for(let i=0;i<6;i++)add("Recursion",i,"Sorcery","{2}{G}","Return target creature card from your graveyard to your hand.");
for(let i=0;i<8;i++)add("Finisher",i,"Sorcery","{3}{G}{G}","Creatures you control get +3/+3 and gain trample until end of turn.");

const settings={themeFocus:82,ramp:"standard",interaction:"standard",curve:"normal",synergyBias:"balanced",protectExistingDecks:false,commanderDependence:"normal",landStyle:"balanced"};
const expected={Tokens:"Token",Clones:"Clone",Ramp:"Ramp"};
const lab3Builds={};
for(const theme of Object.keys(expected)){
  const runtimeCandidates=cards.map(c=>{const sem=runtimeRecordFromSemanticV2(compileCardV5(c));return {name:c.name,semanticCard:sem,ownedQuantity:1,availableQuantity:1,efficiencyScore:.45,commanderAffinity:.35,themeAffinity:c.name.startsWith(expected[theme])?.7:.05};});
  const legacyCandidates=cards.map(c=>({name:c.name,ownedQuantity:1,availableQuantity:1,efficiencyScore:.45,commanderAffinity:.35,themeAffinity:c.name.startsWith(expected[theme])?.7:.05,meta:{typeLine:c.type_line,oracleText:c.oracle_text,cmc:c.cmc,manaCost:c.mana_cost,colorIdentity:colors,legalities:{commander:"legal"}}}));
  const l3=buildLab3Deck({commander,theme,candidates:runtimeCandidates,settings});
  const l2=buildCollectionDeck({commander:"Koma Test",commanderMeta,theme:{name:theme,slug:theme.toLowerCase()},candidates:legacyCandidates,settings});
  assert.equal(l3.complete,true,`${theme}: LAB3 must build 100 cards`);
  assert.equal(l2.size,100,`${theme}: LAB2 fixture must build 100 cards`);
  assert.equal(l3.validation.semanticCoverage.gap,0,`${theme}: no coverage-gap card may enter LAB3`);
  assert.ok(l3.mana.weightedCoverage>=.8,`${theme}: mana coverage must remain healthy`);
  const packageCount=l3.deck.filter(c=>c.name.startsWith(expected[theme])).reduce((n,c)=>n+Number(c.quantity||1),0);
  assert.ok(packageCount>=12,`${theme}: LAB3 must materially prefer the requested semantic package (got ${packageCount})`);
  const wrapped={input:{commander:"Koma Test",theme:{name:theme}},result:{summary:l2.summary,roleCounts:l2.roleCounts},deck:l2.mainboard.map(c=>({name:c.name,quantity:c.quantity||1}))};
  const ab=compareLab2Lab3(wrapped,l3,{candidateScope:"full-runtime-pool"});
  assert.deepEqual(ab.caveats,[],`${theme}: full synthetic pool should be a comparable A/B scope`);
  assert.equal(ab.deck.lab2Count,100);assert.equal(ab.deck.lab3Count,100);
  lab3Builds[theme]=l3;
}
const names=b=>new Set(b.deck.filter(c=>!c.syntheticBasic&&c.category!=="Commander").map(c=>c.name));
const overlap=(a,b)=>{const A=names(a),B=names(b),same=[...A].filter(x=>B.has(x)).length;return same/Math.max(1,Math.min(A.size,B.size));};
assert.ok(overlap(lab3Builds.Tokens,lab3Builds.Clones)<.86,"Tokens and Clones must not collapse to the same nonland shell");
assert.ok(overlap(lab3Builds.Clones,lab3Builds.Ramp)<.86,"Clones and Ramp must not collapse to the same nonland shell");
console.log("LAB3 multi-archetype cross-engine tests: OK · Tokens / Clones / Ramp");
