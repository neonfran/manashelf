import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {deriveThemeView} from "../theme-view.mjs";
const theme=raw=>deriveThemeView(compileCardV5(raw));

let t=theme({oracle_id:"theme-pyro",name:"Young Pyromancer",layout:"normal",type_line:"Creature — Human Shaman",mana_cost:"{1}{R}",cmc:2,color_identity:["R"],legalities:{commander:"legal"},oracle_text:"Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token."});
assert.ok(t.facets.spellslinger?.roles.payoff>.8,"instant/sorcery dependency becomes spellslinger payoff evidence");
assert.ok(t.facets.tokens?.roles.enabler>.8,"token creation becomes token enabler evidence");

let s=theme({oracle_id:"theme-altar",name:"Ashnod's Altar",layout:"normal",type_line:"Artifact",mana_cost:"{3}",cmc:3,color_identity:[],legalities:{commander:"legal"},oracle_text:"Sacrifice a creature: Add {C}{C}."});
assert.ok(s.facets.artifacts?.roles.identity>.8);assert.ok(s.facets.sacrifice?.roles.enabler>.9,"repeatable sacrifice cost is strong enabler evidence");

s=theme({oracle_id:"theme-blood",name:"Blood Artist",layout:"normal",type_line:"Creature — Vampire",mana_cost:"{1}{B}",cmc:2,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life."});
assert.ok(s.facets.sacrifice?.roles.payoff>.8,"creature-death dependency becomes sacrifice payoff");assert.ok(s.facets.lifegain?.roles.enabler>.7);assert.ok(s.facets["kindred:vampire"]?.roles.identity>.7);

s=theme({oracle_id:"theme-equip",name:"Sword",layout:"normal",type_line:"Artifact — Equipment",mana_cost:"{2}",cmc:2,color_identity:[],legalities:{commander:"legal"},oracle_text:"Equipped creature gets +2/+2.\nEquip {2}"});
assert.ok(s.facets.equipment?.roles.identity>.9);assert.ok(s.facets.artifacts?.roles.identity>.8);


{
  const v=theme({oracle_id:"theme-adventure",name:"Questing Druid // Seek the Beast",layout:"adventure",color_identity:["G","R"],legalities:{commander:"legal"},card_faces:[
    {name:"Questing Druid",type_line:"Creature — Human Druid",mana_cost:"{1}{G}",cmc:2,oracle_text:"Whenever you cast a spell that's white, blue, black, or red, put a +1/+1 counter on Questing Druid."},
    {name:"Seek the Beast",type_line:"Instant — Adventure",mana_cost:"{1}{R}",cmc:2,oracle_text:"Exile the top two cards of your library. Until your next end step, you may play those cards."}
  ]});
  assert.ok(v.facets["kindred:human"],"creature subtype should create kindred identity");
  assert.ok(v.facets["kindred:druid"],"creature subtype should create kindred identity");
  assert.ok(!v.facets["kindred:adventure"],"non-creature spell subtype must not create kindred identity");
}


let vanilla=theme({oracle_id:"theme-vanilla",name:"Vanilla Bear",layout:"normal",type_line:"Creature — Bear",mana_cost:"{1}{G}",cmc:2,color_identity:["G"],legalities:{commander:"legal"},oracle_text:""});
assert.ok(!vanilla.facets.spellslinger,"a generic spell cast event must not make every nonland card a spellslinger card");

console.log("semantic-v2 theme view tests: PASS");
