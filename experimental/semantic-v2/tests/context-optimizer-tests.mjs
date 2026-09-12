import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {buildContextState,rankCandidates} from "../context-optimizer.mjs";
const c=raw=>compileCardV5({layout:"normal",mana_cost:"",cmc:0,color_identity:[],legalities:{commander:"legal"},oracle_text:"",...raw});
const demon=i=>c({oracle_id:`demon-${i}`,name:`Demon ${i}`,type_line:"Creature — Demon",mana_cost:"{3}{B}",cmc:4,color_identity:["B"],oracle_text:"Flying"});
const contract=c({oracle_id:"contract",name:"Liliana's Contract",type_line:"Enchantment",mana_cost:"{3}{B}{B}",cmc:5,color_identity:["B"],oracle_text:"At the beginning of your upkeep, if you control four or more Demons with different names, you win the game."});
let s1=buildContextState([contract,demon(1)]),s4=buildContextState([contract,demon(1),demon(2),demon(3),demon(4)]);
let r1=s1.cards.find(x=>x.oracleId==="contract"),r4=s4.cards.find(x=>x.oracleId==="contract");
assert.ok(r4.context.dependencySemantic>r1.context.dependencySemantic,"explicit cardinality improves only when enough Demon permanents exist");
assert.equal(r4.context.dependencySemantic,1,"four Demons satisfy the semantic cardinality");
assert.ok(contract&&r4.dependency.internalConstraints.includes("constraint:distinct_names"),"distinct-name clause remains an internal constraint rather than fake supply");

const commander=c({oracle_id:"cmd",name:"Commander",type_line:"Legendary Creature — Human",mana_cost:"{2}{W}",cmc:3,color_identity:["W"],oracle_text:"Vigilance"});
const dep=c({oracle_id:"cmd-dep",name:"Commander Reward",type_line:"Enchantment",mana_cost:"{1}{W}",cmc:2,color_identity:["W"],oracle_text:"If you control your commander, draw two cards."});
let noCmd=buildContextState([dep]),withCmd=buildContextState([dep],{commander});
assert.ok(withCmd.cards[0].context.dependencyReliability>noCmd.cards[0].context.dependencyReliability,"commander context satisfies commander-state package requirement");

const blood=c({oracle_id:"blood",name:"Blood Artist",type_line:"Creature — Vampire",mana_cost:"{1}{B}",cmc:2,color_identity:["B"],oracle_text:"Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life."});
const bear=c({oracle_id:"bear",name:"Bear",type_line:"Creature — Bear",mana_cost:"{1}{G}",cmc:2,color_identity:["G"],oracle_text:""});
let themed=buildContextState([blood,bear],{themeFacet:"sacrifice"});
assert.ok(themed.cards.find(x=>x.oracleId==="blood").context.themeFit>themed.cards.find(x=>x.oracleId==="bear").context.themeFit,"structured theme evidence affects context, not Oracle regex");

const uu=c({oracle_id:"uu",name:"Double Blue",type_line:"Instant",mana_cost:"{U}{U}",cmc:2,color_identity:["U"],oracle_text:"Counter target spell."});
const island=i=>c({oracle_id:`island-${i}`,name:`Island ${i}`,type_line:"Basic Land — Island",oracle_text:"{T}: Add {U}."});
let dry=buildContextState([uu]),wet=buildContextState([uu,island(1),island(2)]);
assert.ok(wet.cards.find(x=>x.oracleId==="uu").context.castPressure.worstColorCoverage>dry.cards.find(x=>x.oracleId==="uu").context.castPressure.worstColorCoverage,"colored source support comes from structured mana sources");

const xspell=c({oracle_id:"x",name:"X Choice",type_line:"Sorcery",mana_cost:"{X}{U}",cmc:1,color_identity:["U"],oracle_text:"If X is 2, draw two cards."});
assert.equal(buildContextState([xspell]).cards[0].dependency.packageNeeds.length,0,"internal X condition cannot become a deck bottleneck");

const tokenMaker=c({oracle_id:"maker",name:"Maker",type_line:"Enchantment",mana_cost:"{2}{W}",cmc:3,color_identity:["W"],oracle_text:"At the beginning of your end step, create a 1/1 white Soldier creature token."});
const tokenPayoff=c({oracle_id:"payoff",name:"Payoff",type_line:"Enchantment",mana_cost:"{2}{W}",cmc:3,color_identity:["W"],oracle_text:"Whenever a token enters the battlefield under your control, draw a card."});
const ranked=rankCandidates([tokenMaker,bear],[tokenPayoff]);
assert.equal(ranked[0].oracleId,"maker","candidate producing an existing package need should outrank an unrelated card under structural context");


const domainPayoff=c({oracle_id:"domain-payoff",name:"Domain Payoff",type_line:"Sorcery",mana_cost:"{2}{G}",cmc:3,color_identity:["G"],oracle_text:"If there are five basic land types among lands you control, draw a card."});
const plains=c({oracle_id:"plains",name:"Plains",type_line:"Basic Land — Plains",oracle_text:"{T}: Add {W}."});
const island2=c({oracle_id:"island2",name:"Island",type_line:"Basic Land — Island",oracle_text:"{T}: Add {U}."});
const swamp=c({oracle_id:"swamp",name:"Swamp",type_line:"Basic Land — Swamp",oracle_text:"{T}: Add {B}."});
const mountain=c({oracle_id:"mountain",name:"Mountain",type_line:"Basic Land — Mountain",oracle_text:"{T}: Add {R}."});
const forest=c({oracle_id:"forest",name:"Forest",type_line:"Basic Land — Forest",oracle_text:"{T}: Add {G}."});
const plains2=c({oracle_id:"plains2",name:"Plains Two",type_line:"Basic Land — Plains",oracle_text:"{T}: Add {W}."});
let oneType=buildContextState([domainPayoff,plains,plains2]),fiveTypes=buildContextState([domainPayoff,plains,island2,swamp,mountain,forest]);
let d1=oneType.cards.find(x=>x.oracleId==="domain-payoff"),d5=fiveTypes.cards.find(x=>x.oracleId==="domain-payoff");
assert.ok(d5.context.dependencySemantic>d1.context.dependencySemantic,"domain counts distinct basic land types, not raw land copies");assert.equal(d5.context.dependencySemantic,1);

const deliriumPayoff=c({oracle_id:"delirium-payoff",name:"Delirium Payoff",type_line:"Creature",mana_cost:"{1}{B}",cmc:2,color_identity:["B"],oracle_text:"As long as there are four or more card types among cards in your graveyard, this creature gets +2/+2."});
const art=c({oracle_id:"art",name:"Artifact",type_line:"Artifact",mana_cost:"{1}",cmc:1,oracle_text:""});
const ench=c({oracle_id:"ench",name:"Enchantment",type_line:"Enchantment",mana_cost:"{1}{W}",cmc:2,oracle_text:""});
const inst=c({oracle_id:"inst",name:"Instant",type_line:"Instant",mana_cost:"{U}",cmc:1,oracle_text:"Draw a card."});
const land=c({oracle_id:"land",name:"Land",type_line:"Land",oracle_text:"{T}: Add {C}."});
const mill=c({oracle_id:"mill",name:"Mill",type_line:"Sorcery",mana_cost:"{1}{B}",cmc:2,oracle_text:"Mill three cards."});
let lowDiv=buildContextState([deliriumPayoff,art,mill]),highDiv=buildContextState([deliriumPayoff,art,ench,inst,land,mill]);
assert.equal(lowDiv.supply["zone:your_graveyard:card_type_diversity"],3);assert.ok(highDiv.supply["zone:your_graveyard:card_type_diversity"]>=4,"delirium uses unique card-type diversity from structured card metadata");



const sharedPayoff=c({oracle_id:"shared-payoff",name:"Shared Payoff",type_line:"Creature",mana_cost:"{3}{B}",cmc:4,color_identity:["B"],oracle_text:"This creature gets +X/+0, where X is the greatest number of creatures you control that have a creature type in common."});
const elf1=c({oracle_id:"elf1",name:"Elf One",type_line:"Creature — Elf Druid",mana_cost:"{G}",cmc:1,color_identity:["G"],oracle_text:""});
const elf2=c({oracle_id:"elf2",name:"Elf Two",type_line:"Creature — Elf Warrior",mana_cost:"{1}{G}",cmc:2,color_identity:["G"],oracle_text:""});
const goblin=c({oracle_id:"goblin",name:"Goblin",type_line:"Creature — Goblin",mana_cost:"{R}",cmc:1,color_identity:["R"],oracle_text:""});
let mixedTypes=buildContextState([sharedPayoff,elf1,goblin]),sameTypes=buildContextState([sharedPayoff,elf1,elf2]);
assert.ok(sameTypes.supply["package:shared_creature_type"]>mixedTypes.supply["package:shared_creature_type"],"shared-type package uses maximum repeated subtype rather than creature count alone");

console.log("semantic-v2 context optimizer tests: PASS");
