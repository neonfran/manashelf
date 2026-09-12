import assert from "node:assert/strict";
import { compileCardV5 } from "../../semantic-v2/compiler.mjs";
import { runtimeRecordFromSemanticV2 } from "../runtime-index.mjs";
import { buildLab3Deck, builderInternals } from "../builder.mjs";
import { inferThemeModel, scoreCardForThemeModel } from "../theme-understanding.mjs";

const mk=(id,name,type_line,mana_cost,oracle_text,color_identity=["U","R"])=>runtimeRecordFromSemanticV2(compileCardV5({id,oracle_id:id,name,layout:"normal",type_line,mana_cost,cmc:(mana_cost.match(/\{/g)||[]).length,oracle_text,keywords:[],color_identity,legalities:{commander:"legal"}}));
const commander=mk("cmd","Synthetic Spells Commander","Legendary Creature — Human Wizard","{1}{U}{R}","Whenever you cast an instant or sorcery spell, draw a card.");
const candidates=[];
const add=(card,extra={})=>candidates.push({name:card.name,semanticCard:card,ownedQuantity:1,availableQuantity:1,efficiencyScore:.55,commanderAffinity:.4,themeAffinity:.4,...extra});
for(let i=0;i<16;i++)add(mk(`draw${i}`,`Draw Spell ${i}`,"Instant","{1}{U}","Draw two cards."));
for(let i=0;i<12;i++)add(mk(`rem${i}`,`Removal Spell ${i}`,"Instant","{1}{R}","Destroy target creature."));
for(let i=0;i<12;i++)add(mk(`ramp${i}`,`Ramp Rock ${i}`,"Artifact","{2}","{T}: Add {U} or {R}.",[]));
for(let i=0;i<5;i++)add(mk(`wipe${i}`,`Wipe ${i}`,"Sorcery","{3}{R}{R}","Destroy all creatures."));
for(let i=0;i<7;i++)add(mk(`prot${i}`,`Protection ${i}`,"Instant","{U}","Target creature you control gains hexproof until end of turn."));
for(let i=0;i<5;i++)add(mk(`rec${i}`,`Recursion ${i}`,"Sorcery","{2}{B}","Return target creature card from your graveyard to the battlefield.",["B"]));
for(let i=0;i<5;i++)add(mk(`fin${i}`,`Finisher ${i}`,"Sorcery","{5}{U}","Take an extra turn after this one."));
for(let i=0;i<30;i++)add(mk(`spell${i}`,`Theme Spell ${i}`,i%2?"Instant":"Sorcery",i%2?"{U}":"{R}",i%3?"Scry 1.":"Draw a card."));
for(let i=0;i<20;i++)add(mk(`land${i}`,`Utility Land ${i}`,"Land","",`{T}: Add ${i%2?"{U}":"{R}"}.`,[]));
const plainLand=mk("plainland","Plain Mana Land","Land","","{T}: Add {U}.",[]);add(plainLand);
const typedDual=mk("typeddual","Typed Dual","Land — Island Mountain","","This land enters tapped unless you pay 2 life.", ["U","R"]);add(typedDual,{efficiencyScore:.7});
const selfDiscount=mk("selfdiscount","Self Discount","Creature — Wizard","{5}{U}","This spell costs {1} less to cast for each instant and sorcery card in your graveyard.",["U"]);add(selfDiscount);
const unknown=mk("unknown","Unknown Temptation","Enchantment","{U}","Perform the unknowable ritual of seven mirrors.",["U"]);add(unknown,{efficiencyScore:1,commanderAffinity:1,themeAffinity:1});

const build=buildLab3Deck({commander,theme:"Spellslinger",candidates,settings:{protectExistingDecks:false,themeFocus:80}});
assert.equal(build.size,100);
assert.equal(build.complete,true);
assert.equal(build.validation.deckSize,true);
assert.equal(build.deck.find(c=>c.name===commander.name)?.cmc,3,"LAB3 output must preserve the Commander mana value instead of collapsing it to zero");
assert.ok(build.summary.roleCounts.ramp>=8,"builder should achieve substantial structural ramp coverage");
assert.ok(build.summary.themeCards>=20,"Spellslinger build should maintain meaningful theme density");
assert.equal(plainLand.roles?.ramp?.adjudication,"explicit_negative");
assert.equal(selfDiscount.roles?.ramp?.adjudication,"explicit_negative");
assert.equal(unknown.status,"coverage_gap");
assert.ok(!build.deck.some(c=>c.name===unknown.name),"coverage-gap cards must not enter LAB3 decks even with strong external scores");
assert.ok(build.context.summary.avgDependencySatisfaction>=0);
assert.ok(Array.isArray(build.context.bottlenecks));
assert.ok(Number(build.context.summary.dependencyCoverage)>=0&&Number(build.context.summary.dependencyCoverage)<=1);
assert.ok(Number(build.context.summary.dependencyRedundancy)>=0&&Number(build.context.summary.dependencyRedundancy)<=1);
assert.ok(build.mana.weightedCoverage>=.8,"mana plan should satisfy most weighted color-source demand");
assert.ok(Number(build.mana.sourcesByColor.U||0)>0&&Number(build.mana.sourcesByColor.R||0)>0,"mana plan must expose colored source counts");
assert.ok(build.deck.some(c=>c.name===typedDual.name),"typed dual lands should be recognized as useful colored mana sources");
assert.ok(build.deck.every(c=>c.category&&c.category!=="Spell"),"LAB3 output must assign an Archidekt-ready primary category instead of the generic Spell placeholder");
assert.equal(build.deck.find(c=>c.name===commander.name)?.category,"Commander","Commander export category must be explicit");
assert.ok(build.deck.filter(c=>/Land/.test(c.typeLine||"")).every(c=>c.category==="Land"),"all LAB3 lands must export under the Land category");
assert.ok(build.deck.some(c=>c.category==="Draw / Resources"),"resource cards should receive a useful primary category");
assert.ok(build.deck.some(c=>c.category==="Interaction"),"interaction cards should receive a useful primary category");

// LAB3 combo regression: same user-facing policy as LAB2, but selection is scored
// by LAB3 semantic/context data. Exact packages are atomic and cannot be removed
// by quota repair.
const comboVariant={id:"lab3-combo-test",pieces:[{name:commander.name,quantity:1,mustBeCommander:true},{name:"Draw Spell 0",quantity:1,mustBeCommander:false},{name:"Removal Spell 0",quantity:1,mustBeCommander:false}],hasTemplates:false,commanderIncluded:true,commanderRequired:true,otherCommanderRequired:false,identity:["U","R"],legalities:{commander:true},infinite:true,produces:[{name:"Infinite test loop"}],popularity:25};
const comboBuild=buildLab3Deck({commander,theme:"Spellslinger",candidates,comboCandidates:[comboVariant],settings:{protectExistingDecks:false,themeFocus:80,comboPolicy:"infinite"}});
assert.equal(comboBuild.combo?.selected,true,"LAB3 must select a complete exact combo when the policy requests one");
assert.equal(comboBuild.combo?.infinite,true);
assert.ok(comboBuild.deck.some(c=>c.name==="Draw Spell 0"&&c.category==="Combo Piece"),"combo pieces must remain locked and export with an explicit category");
assert.ok(comboBuild.deck.some(c=>c.name==="Removal Spell 0"&&c.category==="Combo Piece"),"all exact combo pieces must be present or none");

const balanced=buildLab3Deck({commander,theme:"Balanced / Good Stuff",candidates,settings:{protectExistingDecks:false,themeFocus:100}});
assert.equal(balanced.targets.theme,0,"neutral fallback must not invent a theme-density quota");
assert.equal(balanced.complete,true);

const externalFallback=buildLab3Deck({commander,theme:"Wheels",themeMode:"external_fallback",candidates,settings:{protectExistingDecks:false,themeFocus:80}});
assert.equal(externalFallback.complete,true,"an EDHREC theme without a dedicated contract must still build");
assert.equal(externalFallback.themeMode,"external_fallback");
assert.ok(externalFallback.summary.themeCards>=20,"external fallback must be able to satisfy meaningful theme density from EDHREC evidence");
assert.ok(Number(externalFallback.summary.themeEvidenceCounts?.edhrec_external_fallback||0)>0,"fallback build must expose which selected cards relied on EDHREC theme evidence");
assert.ok(externalFallback.deck.some(c=>c.themeEvidenceSource==="edhrec_external_fallback"),"selected-card diagnostics must preserve external fallback provenance");
assert.ok(Object.keys(externalFallback.summary.themeFacets||{}).length>1,"external fallback must use Semantic v2 contribution facets instead of collapsing every card into a generic theme bucket");
const safeBuild=buildLab3Deck({commander,theme:"Spellslinger",candidates,settings:{protectExistingDecks:false,themeFocus:80,landStyle:"safe"}});
assert.ok(Number(safeBuild.deck.find(c=>c.name==="Island")?.quantity||0)>0&&Number(safeBuild.deck.find(c=>c.name==="Mountain")?.quantity||0)>0,"safe mana must preserve at least one basic for every demanded Commander color");
assert.ok(Number(safeBuild.summary.nonbasicLands||0)<=Number(safeBuild.summary.lands||0)*.65,"safe mana must not exceed the nonbasic-pressure guardrail");



// Holistic theme understanding regression: an unknown theme name must be inferred
// from structured semantic commonalities in externally ranked members, without any
// theme-name or card-name special case.
const inferredCandidates=[];
for(let i=0;i<10;i++){
  const card=mk(`press${i}`,`Pressure Engine ${i}`,"Enchantment","{2}{R}",`Whenever an opponent casts a spell, Pressure Engine ${i} deals 1 damage to that player.`,["R"]);
  inferredCandidates.push({name:card.name,semanticCard:card,ownedQuantity:1,availableQuantity:1,themeAffinity:.82,edhrecThemeScore:.82,commanderAffinity:.12,edhrecBaseScore:.12});
}
for(let i=0;i<18;i++){
  const card=mk(`generic${i}`,`Generic Value ${i}`,i%2?"Enchantment":"Instant",i%2?"{2}{R}":"{1}{U}",i%2?"At the beginning of your upkeep, draw a card.":"Draw two cards.",i%2?["R"]:["U"]);
  inferredCandidates.push({name:card.name,semanticCard:card,ownedQuantity:1,availableQuantity:1,themeAffinity:i<2?.08:0,edhrecThemeScore:i<2?.08:0,commanderAffinity:.35,edhrecBaseScore:.35});
}
const holisticModel=inferThemeModel(inferredCandidates,{theme:"Synthetic Unknown Pressure Theme"});
assert.equal(holisticModel.mode,"semantic_inferred","unknown themes with contrasted external evidence should get a learned semantic model");
assert.ok(holisticModel.featureRows.some(x=>x.feature.includes("deal_damage")),"learned model should discover the shared structured action rather than rely on the theme label");
assert.ok(scoreCardForThemeModel(inferredCandidates[0].semanticCard,holisticModel)>scoreCardForThemeModel(inferredCandidates.at(-1).semanticCard,holisticModel)+.15,"learned model must separate semantic theme members from generic good-stuff cards");

const restrictedLand=mk("restricted-land","Synthetic Creature-Only Land","Land","","{T}: Add one mana of any color. Spend this mana only to cast a creature spell.",[]);
const restrictionCap=builderInternals.manaCapabilities(restrictedLand,["U","R"],candidates.filter(c=>!/Land/.test(c.semanticCard.faces?.[0]?.typeLine||"")));
assert.equal(restrictionCap.restricted,true,"linked mana restriction must remain visible in LAB3 mana capabilities");
assert.ok(restrictionCap.restrictionUsability<.4,"creature-only colored mana must be heavily discounted in a spell-heavy pool");
assert.ok(Number(restrictionCap.colorReliability.U||0)<.4&&Number(restrictionCap.colorReliability.R||0)<.4,"restricted any-color mana cannot count as full U/R sources");
assert.ok((build.summary.themeFacets?.["spell-copy"]||0)<=6,"Spellslinger diversity should cap excessive copy redundancy before it dominates the shell");
assert.ok(Array.isArray(build.diagnostics?.topRejected),"LAB3 logs must expose top rejected candidates for field debugging");

// Regression: structural selection must not make an otherwise feasible theme quota
// impossible.  The generic quota-repair pass may swap non-theme structural picks,
// but it must preserve the achieved theme count while closing structural deficits.
const fake=(name,{theme=0,ramp=0,resources=0,interaction=0,wipes=0,protection=0,recursion=0,finishers=0}={})=>({name,selected:true,baseScore:.5,profile:{themeScore:theme,roleScores:{ramp,card_draw:resources,removal:interaction,board_wipe:wipes,protection,recursion,finisher:finishers}}});
const themeOnly=[0,1,2,3].map(i=>fake(`Theme ${i}`,{theme:.8}));
const weakA=fake("Weak A",{ramp:1,resources:1}),weakB=fake("Weak B",{interaction:1,wipes:1});
const strongA=fake("Strong A",{ramp:1,resources:1,protection:1});strongA.selected=false;
const strongB=fake("Strong B",{interaction:1,wipes:1,recursion:1,finishers:1});strongB.selected=false;
const quotaSelected=[...themeOnly,weakA,weakB],quotaPool=[...quotaSelected,strongA,strongB];
const quotaRepair=builderInternals.repairQuotaSelection(quotaPool,quotaSelected,{ramp:1,resources:1,interaction:1,wipes:1,protection:1,recursion:1,finishers:1,theme:4},6);
assert.equal(quotaRepair.after,0,"quota repair must close jointly feasible structural/theme deficits");
assert.equal(quotaSelected.filter(c=>c.profile.themeScore>=.35).length,4,"quota repair must preserve the feasible theme quota");
assert.ok(quotaSelected.some(c=>c.name==="Strong A")&&quotaSelected.some(c=>c.name==="Strong B"),"quota repair should replace weaker structural picks rather than sacrifice theme slots");

console.log(`LAB3 builder tests: OK · size ${build.size} · theme ${build.summary.themeCards} · ramp ${build.summary.roleCounts.ramp.toFixed(2)}`);
