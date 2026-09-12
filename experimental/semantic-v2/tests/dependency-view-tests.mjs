import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {deriveDependencyView} from "../dependency-view.mjs";
const view=raw=>deriveDependencyView(compileCardV5(raw));

let v=view({oracle_id:"dep-altar",name:"Ashnod's Altar",layout:"normal",type_line:"Artifact",mana_cost:"{3}",cmc:3,color_identity:[],legalities:{commander:"legal"},oracle_text:"Sacrifice a creature: Add {C}{C}."});
assert.ok(v.packageNeeds.includes("permanent:creature"),"sacrifice cost creates a real package need");
assert.ok(v.externalNeeds.includes("permanent:creature"),"artifact does not self-supply a creature");
assert.ok(v.produces.includes("resource:mana"));

v=view({oracle_id:"dep-contract",name:"Liliana's Contract",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{B}{B}",cmc:5,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"At the beginning of your upkeep, if you control four or more Demons with different names, you win the game."});
const demon=v.demands.find(x=>x.signal==="permanent:subtype:demon");assert.ok(demon);assert.equal(demon.requiredCount,4,"cardinality survives into dependency view");
assert.ok(v.internalConstraints.includes("constraint:distinct_names"),"non-supply requirement remains a constraint");

v=view({oracle_id:"dep-x",name:"Multiple Choice",layout:"normal",type_line:"Sorcery",mana_cost:"{X}{U}",cmc:1,color_identity:["U"],legalities:{commander:"legal"},oracle_text:"If X is 2, draw two cards."});
assert.equal(v.packageNeeds.length,0,"chosen X is not a package dependency");
assert.ok(v.internalConstraints.some(x=>x.startsWith("internal:variable")));

v=view({oracle_id:"dep-commander",name:"Commander Check",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{W}",cmc:3,color_identity:["W"],legalities:{commander:"legal"},oracle_text:"If you control your commander, draw two cards."});
assert.ok(v.packageNeeds.includes("commander:controlled"));assert.equal(v.summary.commanderDependent,true);


{
  const demon=view({oracle_id:"dep-demon",name:"Test Demon",layout:"normal",type_line:"Creature — Demon",mana_cost:"{3}{B}",cmc:4,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"Flying"});
  assert.ok(demon.produces.includes("permanent:subtype:demon"),"permanent subtype supply must match subtype package dependencies");
}


{
  const gate=view({oracle_id:"dep-art-gate",name:"Artifact Gate",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,color_identity:["R"],legalities:{commander:"legal"},oracle_text:"{T}: Add {R}. Activate only if you control an artifact."});
  assert.ok(gate.packageNeeds.includes("permanent:artifact"),"controlled artifact condition must become package demand");
}
{
  const gy=view({oracle_id:"dep-gy",name:"Grave Threshold",layout:"normal",type_line:"Creature — Horror",mana_cost:"{3}{B}",cmc:4,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"This creature gets +2/+2 if there are seven or more cards in your graveyard."});
  assert.ok(gy.packageNeeds.includes("zone:your_graveyard"),"graveyard-count condition is a package dependency rather than generic state");
}



v=view({oracle_id:"dep-etb",name:"Creature ETB",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{G}",cmc:3,color_identity:["G"],legalities:{commander:"legal"},oracle_text:"Whenever another creature enters the battlefield, you gain 1 life."});
assert.ok(v.packageNeeds.includes("card:type:creature"),"creature characteristic must match intrinsic creature supply namespace");

v=view({oracle_id:"dep-gy-spells",name:"Grave Spells",layout:"normal",type_line:"Creature",mana_cost:"{1}{R}",cmc:2,color_identity:["R"],legalities:{commander:"legal"},oracle_text:"As long as there are two or more instant and/or sorcery cards in your graveyard, this creature gets +1/+0."});
assert.ok(v.packageNeeds.includes("zone:your_graveyard"));assert.ok(v.packageNeeds.includes("card:instant_sorcery"));
const spells=v.demands.find(x=>x.signal==="card:instant_sorcery");assert.ok(spells);assert.equal(spells.requiredCount,2,"graveyard payload cardinality survives into dependency view");

v=view({oracle_id:"dep-delirium",name:"Delirium",layout:"normal",type_line:"Creature",mana_cost:"{1}{B}",cmc:2,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"As long as there are four or more card types among cards in your graveyard, this creature gets +2/+2."});
const delirium=v.demands.find(x=>x.signal==="zone:your_graveyard:card_type_diversity");assert.ok(delirium);assert.equal(delirium.requiredCount,4);

v=view({oracle_id:"dep-domain",name:"Domain",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{G}",cmc:3,color_identity:["G"],legalities:{commander:"legal"},oracle_text:"If there are five basic land types among lands you control, draw a card."});
const domain=v.demands.find(x=>x.signal==="permanent:basic_land_type_diversity");assert.ok(domain);assert.equal(domain.requiredCount,5);



v=view({oracle_id:"dep-slow-land",name:"Slow Land",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,color_identity:["U"],legalities:{commander:"legal"},oracle_text:"If you control two or more other lands, this land enters tapped.\n{T}: Add {U}."});
assert.ok(!v.packageNeeds.includes("permanent:land"),"a condition that turns a land tapped is state, not a desired deck dependency");assert.ok(v.stateNeeds.some(x=>x.includes("etb_condition:permanent:land")));

v=view({oracle_id:"dep-battle-land",name:"Battle Land",layout:"normal",type_line:"Land — Swamp Mountain",mana_cost:"",cmc:0,color_identity:["B","R"],legalities:{commander:"legal"},oracle_text:"This land enters tapped unless you control two or more basic lands.\n{T}: Add {B} or {R}."});
assert.ok(v.capabilities.some(c=>c.negatedDependencies.some(x=>x.signal==="permanent:basic_land")),"battle-land untap gate keeps a precise basic-land predicate without becoming a positive bottleneck");

v=view({oracle_id:"dep-rats",name:"Rat Threshold",layout:"normal",type_line:"Creature",mana_cost:"{2}{B}",cmc:3,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"If you control five or more Rats, draw a card."});
const rats=v.demands.find(x=>x.signal==="permanent:subtype:rat");assert.ok(rats);assert.equal(rats.requiredCount,5);



v=view({oracle_id:"dep-shared-type",name:"Shared Type",layout:"normal",type_line:"Creature",mana_cost:"{3}{B}",cmc:4,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"This creature gets +X/+0, where X is the greatest number of creatures you control that have a creature type in common."});
assert.ok(v.packageNeeds.includes("package:shared_creature_type"));

v=view({oracle_id:"dep-reveal-creature",name:"Reveal Creature",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{G}",cmc:4,color_identity:["G"],legalities:{commander:"legal"},oracle_text:"Reveal the top card of your library. If it's a creature card, put it onto the battlefield."});
assert.ok(v.packageNeeds.includes("card:type:creature"),"revealed-card condition becomes creature-density package demand");

console.log("semantic-v2 dependency view tests: PASS");

// Batch 14: grammar/state/environment must not create fake deck-supply bottlenecks.
v=view({oracle_id:"dep-b14-token",name:"Token Scale",layout:"normal",type_line:"Instant",mana_cost:"{2}{G}",cmc:3,color_identity:["G"],legalities:{commander:"legal"},oracle_text:"For each token you control, create a token that's a copy of that permanent."});
assert.ok(v.packageNeeds.includes("permanent:token"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:token")));

v=view({oracle_id:"dep-b14-state",name:"Attack State",layout:"normal",type_line:"Creature",mana_cost:"{2}{R}",cmc:3,color_identity:["R"],legalities:{commander:"legal"},oracle_text:"Activate only if you control an attacking modified creature."});
assert.ok(!v.packageNeeds.some(x=>/subtype:(?:attacking|modified)/.test(x)));assert.ok(v.stateNeeds.includes("permanent:creature"));

v=view({oracle_id:"dep-b14-opponent",name:"Opponent Effect",layout:"normal",type_line:"Sorcery",mana_cost:"{B}",cmc:1,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"Each opponent loses 1 life."});
assert.ok(!v.packageNeeds.includes("event:opponent_action"));assert.ok(v.environmentNeeds.includes("event:opponent_action"));

v=view({oracle_id:"dep-b14-outlaw",name:"Outlaw Gate",layout:"normal",type_line:"Instant",mana_cost:"{1}{B}",cmc:2,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"Draw a card if you control an outlaw."});
assert.ok(v.packageNeeds.includes("package:outlaw"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:outlaw")));
const rogue=view({oracle_id:"dep-b14-rogue",name:"Rogue",layout:"normal",type_line:"Creature — Human Rogue",mana_cost:"{1}{B}",cmc:2,color_identity:["B"],legalities:{commander:"legal"},oracle_text:""});
assert.ok(rogue.produces.includes("package:outlaw"),"outlaw umbrella receives structured subtype supply");

v=view({oracle_id:"dep-b14-historic",name:"Historic Gate",layout:"normal",type_line:"Instant",mana_cost:"{1}{W}",cmc:2,color_identity:["W"],legalities:{commander:"legal"},oracle_text:"Draw a card if you control a historic permanent."});
assert.ok(v.packageNeeds.includes("package:historic"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:historic")));

v=view({oracle_id:"dep-b14-token-plural",name:"Token Threshold",layout:"normal",type_line:"Creature",mana_cost:"{2}{W}",cmc:3,color_identity:["W"],legalities:{commander:"legal"},oracle_text:"If you control three or more tokens, draw a card."});
assert.ok(v.packageNeeds.includes("permanent:token"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:token")));

// Batch 15: impossible subtype bottlenecks become state, aggregate, name, or real package signals.
v=view({oracle_id:"dep-b15-fewer",name:"Fewer Lands",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{G}",cmc:2,color_identity:["G"],legalities:{commander:"legal"},oracle_text:"If you control four or fewer lands, draw a card."});
assert.ok(!v.packageNeeds.some(x=>x.includes("or_fewer")));assert.ok(v.stateNeeds.includes("state:controlled_count_limit"));

v=view({oracle_id:"dep-b15-nonland",name:"Nonland Pair",layout:"normal",type_line:"Creature",mana_cost:"{3}",cmc:3,color_identity:[],legalities:{commander:"legal"},oracle_text:"When this creature enters, if you control two or more nonland, nontoken permanents with the same name as one another, draw a card."});
assert.ok(v.packageNeeds.includes("permanent:nonland_nontoken"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:nonland")));

v=view({oracle_id:"dep-b15-name",name:"Command Test",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,color_identity:[],legalities:{commander:"legal"},oracle_text:"If you control a Command Tower and a Command Power Plant, add two mana of any color."});
assert.ok(v.packageNeeds.includes("permanent:name:command_tower"));assert.ok(v.packageNeeds.includes("permanent:name:command_power_plant"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:command_")));

v=view({oracle_id:"dep-b15-familiar",name:"Familiar Scale",layout:"normal",type_line:"Creature",mana_cost:"{2}{G}",cmc:3,color_identity:["G"],legalities:{commander:"legal"},oracle_text:"You gain 1 life for each familiar you control."});
assert.ok(v.packageNeeds.includes("package:familiar"));assert.ok(!v.packageNeeds.some(x=>x.includes("subtype:familiar")));
const birdFamiliar=view({oracle_id:"dep-b15-bird",name:"Test Bird",layout:"normal",type_line:"Creature — Bird",mana_cost:"{1}{U}",cmc:2,color_identity:["U"],legalities:{commander:"legal"},oracle_text:"Flying"});
assert.ok(birdFamiliar.produces.includes("package:familiar"));

v=view({oracle_id:"dep-b15-decorated",name:"Decorated Gate",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{W}",cmc:3,color_identity:["W"],legalities:{commander:"legal"},oracle_text:"If you control twelve or more decorated permanents, you win the game."});
assert.ok(!v.packageNeeds.some(x=>x.includes("decorated")));assert.ok(v.unresolvedConditions.includes("condition:decorated_permanent"));

v=view({oracle_id:"dep-b15-color-coverage",name:"Color Coverage",layout:"normal",type_line:"Enchantment",mana_cost:"{W}",cmc:1,color_identity:["W"],legalities:{commander:"legal"},oracle_text:"As long as you control a permanent of each color, prevent all damage that would be dealt to you."});
assert.ok(!v.packageNeeds.some(x=>x.includes("permanent_of_each_color")));assert.ok(v.stateNeeds.includes("state:permanent_color_coverage"));

v=view({oracle_id:"dep-b15-spawn",name:"Spawn Gate",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{R}",cmc:2,color_identity:["R"],legalities:{commander:"legal"},oracle_text:"If you control an Eldrazi Spawn, draw a card."});
assert.ok(v.packageNeeds.includes("permanent:subtype:eldrazi"));assert.ok(v.packageNeeds.includes("permanent:subtype:spawn"));assert.ok(!v.packageNeeds.some(x=>x.includes("eldrazi_spawn")));
