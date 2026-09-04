import assert from "node:assert/strict";
import {buildDeckMetrics,parseManaCost} from "../lib/deck-metrics.mjs";

const mk=(name,typeLine,oracleText,cmc,manaCost,producedMana=[],quantity=1)=>({name,quantity,meta:{typeLine,oracleText,cmc,manaCost,producedMana}});

assert.deepEqual(parseManaCost("{2}{W}{U}"),{
  tokens:["2","W","U"],pips:{W:1,U:1,B:0,R:0,G:0,C:0},generic:2,variable:false,colors:["W","U"],coloredPips:2
});

const cards=[];
for(let i=0;i<36;i++)cards.push(mk(`Forest ${i+1}`,"Basic Land — Forest","{T}: Add {G}.",0,"",["G"]));
for(let i=0;i<10;i++)cards.push(mk(`Ramp ${i+1}`,"Sorcery","Search your library for a basic land card, put it onto the battlefield tapped.",2,"{1}{G}"));
for(let i=0;i<8;i++)cards.push(mk(`Draw ${i+1}`,"Sorcery","Draw two cards.",3,"{2}{G}"));
for(let i=0;i<8;i++)cards.push(mk(`Removal ${i+1}`,"Instant","Destroy target creature.",2,"{1}{G}"));
for(let i=0;i<25;i++)cards.push(mk(`Dragon ${i+1}`,"Creature — Dragon","Flying. Whenever this creature attacks, it deals 2 damage to each opponent.",5,"{4}{G}"));
cards.push(mk("Commander","Legendary Creature — Dragon","Flying. Dragon spells you cast cost {1} less.",6,"{5}{G}"));
while(cards.length<100)cards.push(mk(`Mana Rock ${cards.length}`,"Artifact","{T}: Add {G}.",2,"{2}",["G"]));

const out=buildDeckMetrics(cards,{commanderName:"Commander",tribalType:"Dragon",iterations:1000,deckSignature:"smoke"});
assert.equal(out.engine.metricsVersion,1);
assert.equal(out.classifications.length,100);
assert.equal(out.metrics.manaReliability.landCount,36);
assert.equal(out.metrics.interactionDensity.count,8);
assert.ok(out.metrics.manaReliability.landDropT3>0.7);
assert.ok(out.metrics.earlyDevelopment.productiveT2>0.4);
assert.ok(out.metrics.goldfishDevelopment.byTurn.length===7);
assert.ok(out.metrics.effectiveManaValue.adjustedAverage<=out.metrics.effectiveManaValue.printedAverage);
console.log("Deck Metrics smoke test: OK");
