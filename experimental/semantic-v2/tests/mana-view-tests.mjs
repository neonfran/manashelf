import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {deriveManaView} from "../mana-view.mjs";
const view=raw=>deriveManaView(compileCardV5(raw));

let v=view({oracle_id:"lux",name:"Luxury Suite",layout:"normal",type_line:"Land",cmc:0,mana_cost:"",color_identity:["B","R"],legalities:{commander:"legal"},oracle_text:"This land enters tapped unless you have two or more opponents.\n{T}: Add {B} or {R}."});
assert.equal(v.isPlayableLand,true);assert.equal(v.sources[0].etb.mode,"conditionally_tapped");assert.deepEqual(v.sources[0].colors,["B","R"]);

v=view({oracle_id:"zig",name:"Ancient Ziggurat",layout:"normal",type_line:"Land",cmc:0,mana_cost:"",color_identity:["W","U","B","R","G"],legalities:{commander:"legal"},oracle_text:"{T}: Add one mana of any color. Spend this mana only to cast a creature spell."});
assert.equal(v.sources[0].sourceClass,"restricted");assert.deepEqual(v.sources[0].restrictions[0].allowedUses[0].cardTypes,["Creature"]);

v=view({oracle_id:"mire",name:"Bloodstained Mire",layout:"normal",type_line:"Land",cmc:0,mana_cost:"",color_identity:["B","R"],legalities:{commander:"legal"},oracle_text:"{T}, Pay 1 life, Sacrifice this land: Search your library for a Swamp or Mountain card, put it onto the battlefield, then shuffle."});
assert.equal(v.proxySources.length,1);assert.deepEqual(v.proxySources[0].subtypesAny,["Swamp","Mountain"]);assert.equal(v.proxySources[0].destinationTapped,false);

v=view({oracle_id:"amulet",name:"Primal Amulet // Primal Wellspring",layout:"transform",color_identity:[],legalities:{commander:"legal"},card_faces:[{name:"Primal Amulet",type_line:"Artifact",cmc:4,mana_cost:"{4}",oracle_text:"Whenever you cast an instant or sorcery spell, put a charge counter on this artifact. Then if there are four or more charge counters on it, transform it."},{name:"Primal Wellspring",type_line:"Land",cmc:0,mana_cost:"",oracle_text:"{T}: Add one mana of any color."}]});
assert.equal(v.isPlayableLand,false);assert.equal(v.sources[0].sourceClass,"state_dependent");

v=view({oracle_id:"hyb",name:"Hybrid Test",layout:"normal",type_line:"Sorcery",cmc:3,mana_cost:"{1}{B/R}{B/R}",color_identity:["B","R"],legalities:{commander:"legal"},oracle_text:"Draw a card."});
assert.equal(v.castFaces[0].manaCost.symbols.filter(x=>x.kind==="choice").length,2);
console.log("semantic-v2 mana view tests: PASS");
