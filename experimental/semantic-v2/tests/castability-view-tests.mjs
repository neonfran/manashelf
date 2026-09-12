import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {deriveCastabilityView,manaBurden} from "../castability-view.mjs";
const view=raw=>deriveCastabilityView(compileCardV5(raw));

let v=view({oracle_id:"hybrid-cast",name:"Hybrid Test",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{B/R}{2/W}{G/P}",cmc:5,color_identity:["W","B","R","G"],legalities:{commander:"legal"},oracle_text:"Draw a card."});
assert.equal(v.entries.length,1);assert.equal(v.entries[0].burden.generic,1);assert.equal(v.entries[0].burden.choicePipCount,3);assert.equal(v.entries[0].burden.hasPhyrexianChoice,true);assert.equal(v.entries[0].burden.hasGenericAlternative,true);

v=view({oracle_id:"flashback-test",name:"Memory Spell",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{U}",cmc:3,color_identity:["U"],keywords:["Flashback"],legalities:{commander:"legal"},oracle_text:"Draw a card.\nFlashback {4}{U}"});
assert.ok(v.keywordRoutes.some(x=>x.keyword==="flashback"&&x.from==="graveyard"),"structured keyword supplies graveyard cast route");

v=view({oracle_id:"convoke-test",name:"Convoke Spell",layout:"normal",type_line:"Sorcery",mana_cost:"{4}{W}",cmc:5,color_identity:["W"],keywords:["Convoke"],legalities:{commander:"legal"},oracle_text:"Convoke\nCreate two 1/1 white Soldier creature tokens."});
assert.ok(v.paymentMethods.some(x=>x.keyword==="convoke"),"convoke is represented as alternate payment method, not fake mana production");

v=view({oracle_id:"reduce-self",name:"Self Discount",layout:"normal",type_line:"Sorcery",mana_cost:"{4}{B}",cmc:5,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"This spell costs {3} less to cast if you've gained 3 or more life this turn.\nDraw two cards."});
assert.ok(v.costModifiers.some(x=>x.action==="reduce_cost"&&x.scopeClass==="self"),"self cost reduction is scoped without raw-text reinterpretation");

v=view({oracle_id:"transform-land",name:"Primal Amulet // Primal Wellspring",layout:"transform",color_identity:[],legalities:{commander:"legal"},card_faces:[{name:"Primal Amulet",type_line:"Artifact",cmc:4,mana_cost:"{4}",oracle_text:"Whenever you cast an instant or sorcery spell, put a charge counter on this artifact. Then if there are four or more charge counters on it, transform it."},{name:"Primal Wellspring",type_line:"Land",cmc:0,mana_cost:"",oracle_text:"{T}: Add one mana of any color."}]});
assert.equal(v.entries.length,1,"transform back face must not become a cast-from-hand entry");

const b=manaBurden({symbols:[{kind:"colored",colors:["U"]},{kind:"choice",colors:["B","R"],phyrexian:false,genericAlternative:null},{kind:"generic",amount:2},{kind:"variable"}]});
assert.equal(b.strictColored.U,1);assert.equal(b.choicePipCount,1);assert.equal(b.generic,2);assert.equal(b.variableCount,1);
console.log("semantic-v2 castability view tests: PASS");
