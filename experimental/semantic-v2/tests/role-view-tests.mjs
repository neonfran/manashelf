import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {deriveRoleViews} from "../role-views.mjs";
const make=raw=>deriveRoleViews(compileCardV5(raw));

let r=make({oracle_id:"mdfc-role",name:"Insight // Morass",layout:"modal_dfc",color_identity:["B","R"],legalities:{commander:"legal"},card_faces:[{name:"Insight",type_line:"Sorcery",mana_cost:"{3}{B}",cmc:4,oracle_text:"Draw two cards."},{name:"Morass",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"This land enters tapped.\n{T}: Add {B} or {R}."}]});
assert.ok(r.land_slot.potentialScore>.8);assert.ok(r.mana_source.potentialScore>.7);assert.ok(r.card_draw.potentialScore>.6);

r=make({oracle_id:"transform-role",name:"Amulet // Wellspring",layout:"transform",color_identity:[],legalities:{commander:"legal"},card_faces:[{name:"Amulet",type_line:"Artifact",mana_cost:"{4}",cmc:4,oracle_text:"Whenever you cast an instant or sorcery spell, put a charge counter on this artifact. Then if there are four or more charge counters on it, transform it."},{name:"Wellspring",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"{T}: Add one mana of any color."}]});
assert.equal(r.land_slot.potentialScore,0);assert.ok(r.mana_source.potentialScore>0,"back face mana remains potential");

r=make({oracle_id:"dredge-role",name:"Stinkweed Imp",layout:"normal",type_line:"Creature — Imp",mana_cost:"{2}{B}",cmc:3,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"Dredge 5 (If you would draw a card, you may mill five cards instead. If you do, return this card from your graveyard to your hand.)"});
assert.equal(r.card_draw.potentialScore,0,"replacement precondition is not card draw");

r=make({oracle_id:"jace-role",name:"Jace",layout:"normal",type_line:"Planeswalker",mana_cost:"{1}{U}{U}{U}",cmc:4,color_identity:["U"],legalities:{commander:"legal"},oracle_text:"If you would draw a card while your library has no cards in it, you win the game instead.\n+1: Target player mills two cards. Draw a card."});
assert.ok(r.card_draw.potentialScore>.6);assert.ok(r.finisher.potentialScore>0);assert.equal(r.finisher.conditional,true);

r=make({oracle_id:"contract-role",name:"Liliana's Contract",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{B}{B}",cmc:5,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"At the beginning of your upkeep, if you control four or more Demons with different names, you win the game."});
assert.ok(r.finisher.potentialScore>0);assert.equal(r.finisher.conditional,true);assert.ok(r.finisher.conditions.length>0);
console.log("semantic-v2 role view tests: PASS");
