import assert from "node:assert/strict";
import { compileCard } from "../compiler.mjs";
import { evaluateRole } from "../role-contracts.mjs";

const mk=(id,text,type_line="Instant",mana_cost="{1}{U}")=>compileCard({id,oracle_id:id,name:id,layout:"normal",type_line,mana_cost,cmc:2,oracle_text:text,keywords:[],color_identity:["U"]});
const one=card=>card.faces[0].abilities[0].clauses[0];

const copyYou=one(mk("m-copy-you","You may copy target instant or sorcery spell."));
const copyOther=one(mk("m-copy-other","That player may copy target instant or sorcery spell."));
assert.equal(copyYou.action,copyOther.action);assert.equal(copyYou.spellScope,copyOther.spellScope);assert.notEqual(copyYou.actor,copyOther.actor);
assert.equal(evaluateRole(mk("m-copy-you2","You may copy target instant or sorcery spell."),"spell_copy").adjudication,"positive");
assert.equal(evaluateRole(mk("m-copy-other2","That player may copy target instant or sorcery spell."),"spell_copy").adjudication,"explicit_negative");

const self=one(mk("m-cost-self","This spell costs {1} less to cast for each instant and sorcery card in your graveyard.","Creature — Wizard","{5}{U}"));
const global=one(mk("m-cost-global","Instant and sorcery spells you cast cost {1} less to cast.","Creature — Wizard","{5}{U}"));
assert.equal(self.action,global.action);assert.notEqual(self.costReductionScope,global.costReductionScope);assert.notEqual(self.beneficiary,global.beneficiary);

const graveSelf=one(mk("m-grave-self","Exile target card from your graveyard."));
const graveOpp=one(mk("m-grave-opp","Exile target card from target opponent's graveyard."));
assert.equal(graveSelf.action,graveOpp.action);assert.equal(graveSelf.sourceZone,graveOpp.sourceZone);assert.notEqual(graveSelf.owner,graveOpp.owner);assert.notEqual(graveSelf.polarity,graveOpp.polarity);

const castIS=one(mk("m-cast-is","Whenever you cast an instant or sorcery spell, draw a card.","Enchantment","{2}{U}"));
const castCreature=one(mk("m-cast-creature","Whenever you cast a creature spell, draw a card.","Enchantment","{2}{U}"));
assert.equal(castIS.action,castCreature.action);assert.equal(castIS.trigger,castCreature.trigger);assert.notEqual(castIS.spellScope,castCreature.spellScope);

const toHand=one(mk("m-zone-hand","Return target creature card from your graveyard to your hand.","Sorcery","{1}{B}"));
const toBattlefield=one(mk("m-zone-bf","Return target creature card from your graveyard to the battlefield.","Sorcery","{1}{B}"));
assert.equal(toHand.action,toBattlefield.action);assert.equal(toHand.owner,toBattlefield.owner);assert.equal(toHand.sourceZone,toBattlefield.sourceZone);assert.notEqual(toHand.destinationZone,toBattlefield.destinationZone);

console.log("semantic metamorphic tests: OK");
