import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { compileCard, semanticClauses } from "../compiler.mjs";
import { evaluateRole } from "../role-contracts.mjs";
import { evaluateArchetype } from "../archetype-contracts.mjs";
import { ADJUDICATION, COVERAGE_STATUS } from "../schema.mjs";
import { buildSemanticDb, readSemanticDb } from "../semantic-db.mjs";
import { auditCards } from "../audit.mjs";
import { semanticDrift } from "../drift.mjs";
import { castabilityRequirement } from "../castability.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const fixturePath=path.resolve(here,"../fixtures/smoke-cards.json");
const raw=JSON.parse(fs.readFileSync(fixturePath,"utf8"));
const byId=new Map(raw.map(c=>[c.oracle_id,compileCard(c)]));

const selfDiscount=byId.get("syn-001");
assert.equal(evaluateRole(selfDiscount,"ramp").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"self-spell discount must not be structural ramp");
assert.equal(evaluateRole(selfDiscount,"cost_reduction").adjudication,ADJUDICATION.POSITIVE);
assert.equal(evaluateArchetype(selfDiscount,"Spellslinger").adjudication,ADJUDICATION.POSITIVE,"self discount may still be a thematic payoff when its dependency is spell-relevant");
assert.equal(evaluateRole(byId.get("syn-002"),"ramp").adjudication,ADJUDICATION.POSITIVE,"discount affecting spells you cast can be structural acceleration");

assert.equal(evaluateRole(byId.get("syn-003"),"spell_copy").adjudication,ADJUDICATION.POSITIVE);
assert.equal(evaluateRole(byId.get("syn-004"),"spell_copy").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"foreign copy agency must not become you-copy-spell");

assert.equal(evaluateRole(byId.get("syn-005"),"removal").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"own graveyard movement must not be hostile removal");
assert.equal(evaluateRole(byId.get("syn-005"),"recursion").adjudication,ADJUDICATION.POSITIVE);
assert.equal(evaluateRole(byId.get("syn-006"),"removal").adjudication,ADJUDICATION.POSITIVE,"opponent graveyard exile is interaction");

assert.equal(evaluateRole(byId.get("syn-007"),"mana_source").adjudication,ADJUDICATION.POSITIVE);
assert.equal(evaluateRole(byId.get("syn-007"),"ramp").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"normal land mana ability must not fill ramp");
assert.equal(evaluateRole(byId.get("syn-008"),"ramp").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"mana-neutral filter must not fill ramp");
assert.equal(evaluateRole(byId.get("syn-009"),"ramp").adjudication,ADJUDICATION.POSITIVE,"positive nonland mana source should count as structural ramp");

assert.ok(evaluateRole(byId.get("syn-010"),"board_wipe").score>=.95);
assert.ok(evaluateRole(byId.get("syn-011"),"board_wipe").score<.72,"3 damage sweeper should remain below full structural wipe threshold");

const scoped=byId.get("syn-012");
assert.equal(scoped.faces[0].abilities.length,2,"Oracle newlines must preserve independent abilities");
const firstDeps=scoped.faces[0].abilities[0].clauses.flatMap(c=>c.dependencies);
const secondDeps=scoped.faces[0].abilities[1].clauses.flatMap(c=>c.dependencies);
assert.ok(firstDeps.includes("card:instant_sorcery"));
assert.ok(!firstDeps.includes("permanent:artifact"),"condition from another ability must not contaminate the first ability");
assert.ok(secondDeps.includes("permanent:artifact"));

const mdfc=byId.get("syn-013");
assert.equal(mdfc.faces.length,2,"MDFC must preserve semantics by face");
assert.equal(mdfc.faces[0].abilities[0].clauses[0].action,"draw");
assert.equal(mdfc.faces[1].abilities[0].clauses[0].action,"add_mana");

const granted=byId.get("syn-014");
const top=semanticClauses(granted).map(x=>x.clause);
const embedded=semanticClauses(granted,{includeEmbedded:true}).filter(x=>x.embedded).map(x=>x.clause);
assert.ok(top.some(c=>c.action==="create_token"));
assert.ok(!top.some(c=>c.action==="add_mana"),"granted quoted rules must not become a direct parent ability");
assert.ok(embedded.some(c=>c.action==="add_mana"),"embedded rule is preserved separately for future relationship reasoning");

assert.equal(byId.get("syn-015").status,COVERAGE_STATUS.GAP,"unsupported text should be explicit coverage_gap");
assert.equal(evaluateRole(byId.get("syn-016"),"counterspell").adjudication,ADJUDICATION.POSITIVE);
assert.equal(byId.get("syn-017").status,COVERAGE_STATUS.SUPPORTED);

const huge=compileCard({id:"syn-huge",oracle_id:"syn-huge",name:"Synthetic Huge Spell",layout:"normal",type_line:"Artifact",mana_cost:"{12}",cmc:12,oracle_text:"",keywords:[],color_identity:[]});
const hugeReq=castabilityRequirement(huge);
assert.equal(hugeReq.faces[0].colorReliabilityRequirement,0,"color reliability can be zero");
assert.equal(hugeReq.faces[0].totalManaCastabilityRequirement,12,"total mana castability must still preserve generic mana cost");

const temp=fs.mkdtempSync(path.join(os.tmpdir(),"manashelf-semantic-"));
const db1=path.join(temp,"semantic-1.jsonl"),manifest1=path.join(temp,"semantic-1.manifest.json");
const manifest=await buildSemanticDb({inputPath:fixturePath,outputPath:db1,manifestPath:manifest1,source:"synthetic-smoke"});
assert.equal(manifest.output.records,raw.length);
let readCount=0;for await(const _ of readSemanticDb(db1))readCount++;assert.equal(readCount,raw.length);
const report=await auditCards(readSemanticDb(db1));
assert.equal(report.cards.total,raw.length);
assert.ok(report.coverage.unknown>=1);
assert.equal(report.structuralContradictions.RAMP_WITHOUT_ACCELERATION_EVIDENCE||0,0);
assert.equal(report.structuralContradictions.SPELL_COPY_WITHOUT_SELF_AGENCY||0,0);
assert.equal(report.structuralContradictions.REMOVAL_WITHOUT_HOSTILE_CAPABILITY||0,0);

const modified=raw.map(c=>c.oracle_id==="syn-015"?{...c,oracle_text:"Draw a card."}:c);
const input2=path.join(temp,"fixture-2.json"),db2=path.join(temp,"semantic-2.jsonl");fs.writeFileSync(input2,JSON.stringify(modified));
await buildSemanticDb({inputPath:input2,outputPath:db2,source:"synthetic-smoke"});
const drift=await semanticDrift(db1,db2);assert.equal(drift.counts.changed,1);assert.equal(drift.samples.changed[0].oracleId,"syn-015");

console.log(`semantic property tests: OK · ${raw.length} fixtures · coverage ${report.coverage.highConfidence}/${report.coverage.partial}/${report.coverage.unknown}`);

// Corpus-derived general regressions (no card-name runtime patches).
const opponentDraw=compileCard({id:"syn-opponent-draw",oracle_id:"syn-opponent-draw",name:"Synthetic Opponent Draw",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{U}",cmc:2,oracle_text:"Target opponent draws two cards.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(opponentDraw,"card_draw").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"opponent draw must not become source-controller card draw");

const sacrificeDraw=compileCard({id:"syn-sac-draw",oracle_id:"syn-sac-draw",name:"Synthetic Sacrifice Draw",layout:"normal",type_line:"Artifact",mana_cost:"{2}",cmc:2,oracle_text:"{1}, Sacrifice this artifact: Draw two cards.",keywords:[],color_identity:[]});
assert.equal(evaluateRole(sacrificeDraw,"card_draw").adjudication,ADJUDICATION.POSITIVE,"activation cost must not overwrite the draw effect");
assert.equal(sacrificeDraw.faces[0].abilities[0].clauses[0].activationCost.sacrifice,true,"sacrifice remains activation-cost metadata");

const qualifiedWipe=compileCard({id:"syn-qualified-wipe",oracle_id:"syn-qualified-wipe",name:"Synthetic Qualified Wipe",layout:"normal",type_line:"Sorcery",mana_cost:"{3}{W}",cmc:4,oracle_text:"Exile all multicolored permanents.",keywords:[],color_identity:["W"]});
assert.ok(evaluateRole(qualifiedWipe,"board_wipe").score>=.72,"qualified mass permanent exile should be modeled continuously as a wipe");

const protectSecondary=compileCard({id:"syn-protect-secondary",oracle_id:"syn-protect-secondary",name:"Synthetic Land Protection",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{G}",cmc:3,oracle_text:"Until your next turn, all lands you control become 2/2 Elemental creatures with indestructible and haste. They're still lands.",keywords:[],color_identity:["G"]});
assert.equal(evaluateRole(protectSecondary,"protection").adjudication,ADJUDICATION.POSITIVE,"protective keyword in a multi-effect clause must remain role-visible");

const foreignCopyController=compileCard({id:"syn-copy-controller",oracle_id:"syn-copy-controller",name:"Synthetic Controller Copy",layout:"normal",type_line:"Creature — Wizard",mana_cost:"{2}{U}",cmc:3,oracle_text:"{2}{U}: The controller of target instant or sorcery spell copies it. That player may choose new targets for the copy.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(foreignCopyController,"spell_copy").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"spell copy controlled by the target spell controller is not you-copy-spell");

const conditionalRecursion=compileCard({id:"syn-cond-recursion",oracle_id:"syn-cond-recursion",name:"Synthetic Conditional Recursion",layout:"normal",type_line:"Creature — Spirit",mana_cost:"{2}{B}",cmc:3,oracle_text:"At the beginning of your upkeep, if this card is the only creature card in your graveyard, you may return this card to the battlefield.",keywords:[],color_identity:["B"]});
assert.equal(evaluateRole(conditionalRecursion,"recursion").adjudication,ADJUDICATION.POSITIVE,"zone evidence in a trigger condition must remain available to the effect");

const forcedSacrifice=compileCard({id:"syn-forced-sac",oracle_id:"syn-forced-sac",name:"Synthetic Edict",layout:"normal",type_line:"Instant",mana_cost:"{1}{B}",cmc:2,oracle_text:"Target player sacrifices a creature of their choice.",keywords:[],color_identity:["B"]});
assert.equal(evaluateRole(forcedSacrifice,"removal").adjudication,ADJUDICATION.POSITIVE,"forced opponent/player sacrifice is hostile removal");

const selfBounce=compileCard({id:"syn-self-bounce",oracle_id:"syn-self-bounce",name:"Synthetic Self Bounce",layout:"normal",type_line:"Creature — Beast",mana_cost:"{2}{G}",cmc:3,oracle_text:"When this creature enters, return a land you control to its owner's hand.",keywords:[],color_identity:["G"]});
assert.notEqual(evaluateRole(selfBounce,"removal").adjudication,ADJUDICATION.POSITIVE,"self-owned bounce must not be hostile removal");

// Corpus-driven v2 family regressions: these encode general Oracle patterns,
// never individual card-name exceptions.
const labeledTrigger=compileCard({id:"syn-labeled-trigger",oracle_id:"syn-labeled-trigger",name:"Synthetic Ability Word",layout:"normal",type_line:"Creature — Druid",mana_cost:"{2}{G}",cmc:3,oracle_text:"Landfall — Whenever a land you control enters, draw a card.",keywords:["Landfall"],color_identity:["G"]});
assert.equal(labeledTrigger.faces[0].abilities[0].kind,"triggered","ability-word labels must not hide the underlying trigger");
assert.equal(evaluateRole(labeledTrigger,"card_draw").adjudication,ADJUDICATION.POSITIVE);

const labeledSaga=compileCard({id:"syn-saga-label",oracle_id:"syn-saga-label",name:"Synthetic Saga Chapter",layout:"saga",type_line:"Enchantment — Saga",mana_cost:"{2}{U}",cmc:3,oracle_text:"III — Hall of Memory — Draw two cards.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(labeledSaga,"card_draw").adjudication,ADJUDICATION.POSITIVE,"chapter/flavor labels must not hide the effect");

const activatedSelfBounce=compileCard({id:"syn-activated-bounce",oracle_id:"syn-activated-bounce",name:"Synthetic Self Bounce",layout:"normal",type_line:"Creature — Illusion",mana_cost:"{3}{U}",cmc:4,oracle_text:"{2}{U}: Return this creature to its owner's hand.",keywords:[],color_identity:["U"]});
assert.notEqual(evaluateRole(activatedSelfBounce,"removal").adjudication,ADJUDICATION.POSITIVE,"activated self-bounce is not hostile removal");
assert.equal(activatedSelfBounce.faces[0].abilities[0].clauses[0].action,"return");

const tokenMultiplier=compileCard({id:"syn-token-mult",oracle_id:"syn-token-mult",name:"Synthetic Token Multiplier",layout:"normal",type_line:"Enchantment",mana_cost:"{4}{G}",cmc:5,oracle_text:"If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.",keywords:[],color_identity:["G"]});
assert.ok(semanticClauses(tokenMultiplier).some(x=>x.clause.action==="multiply_tokens"),"token replacement multipliers must be explicit semantic facts");

const counterAllAbilities=compileCard({id:"syn-counter-abilities",oracle_id:"syn-counter-abilities",name:"Synthetic Ability Counter",layout:"normal",type_line:"Creature — Wizard",mana_cost:"{2}{U}",cmc:3,oracle_text:"When this creature enters, counter all abilities your opponents control.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(counterAllAbilities,"counterspell").adjudication,ADJUDICATION.POSITIVE,"mass ability counters remain interaction evidence");

const castExiled=compileCard({id:"syn-cast-exiled",oracle_id:"syn-cast-exiled",name:"Synthetic Exile Permission",layout:"normal",type_line:"Creature — Wizard",mana_cost:"{2}{R}",cmc:3,oracle_text:"You may cast this card for as long as it remains exiled.",keywords:[],color_identity:["R"]});
assert.ok(semanticClauses(castExiled).some(x=>x.clause.action==="cast_from_zone"&&x.clause.sourceZone==="exile"));

const paymentPrompt=compileCard({id:"syn-payment-prompt",oracle_id:"syn-payment-prompt",name:"Synthetic Payment Prompt",layout:"normal",type_line:"Creature — Wizard",mana_cost:"{1}{R}",cmc:2,oracle_text:"Whenever you cast a noncreature spell, you may pay {1}.",keywords:[],color_identity:["R"]});
assert.equal(paymentPrompt.status,COVERAGE_STATUS.PARTIAL,"payment prompts should be explicit partial linkage, not total unknowns");
assert.ok(paymentPrompt.unsupportedPatterns.includes("REFERENCE_RESOLUTION_REQUIRED"));

const inflectedMechanic=compileCard({id:"syn-inflected-mechanic",oracle_id:"syn-inflected-mechanic",name:"Synthetic Connive",layout:"normal",type_line:"Creature — Rogue",mana_cost:"{1}{U}",cmc:2,oracle_text:"When this creature enters, it connives.",keywords:["Connive"],color_identity:["U"]});
assert.equal(inflectedMechanic.faces[0].abilities[0].clauses[0].action,"connive","inflected game actions must normalize to their semantic action");

const etbChoice=compileCard({id:"syn-etb-choice",oracle_id:"syn-etb-choice",name:"Synthetic Conditional Land",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"As this land enters, you may pay 3 life.\nIf you don't, it enters tapped.",keywords:[],color_identity:["B"]});
assert.ok(semanticClauses(etbChoice).some(x=>x.clause.action==="enters_tapped"),"referenced ETB-tapped consequence must remain visible");

const copyAbility=compileCard({id:"syn-copy-ability",oracle_id:"syn-copy-ability",name:"Synthetic Ability Copy",layout:"normal",type_line:"Instant",mana_cost:"{U}",cmc:1,oracle_text:"Copy target activated or triggered ability you control.",keywords:[],color_identity:["U"]});
assert.ok(semanticClauses(copyAbility).some(x=>x.clause.action==="copy_ability"));

const graveyardMagnitudeRemoval=compileCard({id:"syn-gy-magnitude-removal",oracle_id:"syn-gy-magnitude-removal",name:"Synthetic Graveyard Magnitude Removal",layout:"normal",type_line:"Instant",mana_cost:"{U}{B}",cmc:2,oracle_text:"Destroy target creature with mana value less than or equal to the number of cards in its controller's graveyard.",keywords:[],color_identity:["U","B"]});
assert.equal(evaluateRole(graveyardMagnitudeRemoval,"removal").adjudication,ADJUDICATION.POSITIVE,"graveyard used only as a magnitude/condition must not hide battlefield removal");
assert.equal(semanticClauses(graveyardMagnitudeRemoval)[0].clause.sourceZone,null);

const foreignControllerDraw=compileCard({id:"syn-controller-draw",oracle_id:"syn-controller-draw",name:"Synthetic Controller Draw",layout:"normal",type_line:"Instant",mana_cost:"{1}{U}",cmc:2,oracle_text:"Return target creature to its owner's hand. Its controller draws a card.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(foreignControllerDraw,"card_draw").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"draw for the affected object's controller is not source-controller draw");

const massBounce=compileCard({id:"syn-mass-bounce",oracle_id:"syn-mass-bounce",name:"Synthetic Mass Bounce",layout:"normal",type_line:"Sorcery",mana_cost:"{3}{U}{U}",cmc:5,oracle_text:"Return all nonland permanents to their owners' hands.",keywords:[],color_identity:["U"]});
assert.ok(evaluateRole(massBounce,"board_wipe").score>=.9,"mass nonland bounce should be a strong sweeper");

const triggeredCopy=compileCard({id:"syn-trigger-copy",oracle_id:"syn-trigger-copy",name:"Synthetic Triggered Copy",layout:"normal",type_line:"Creature — Wizard",mana_cost:"{2}{U}",cmc:3,oracle_text:"Whenever you cast an instant or sorcery spell, copy it.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(triggeredCopy,"spell_copy").adjudication,ADJUDICATION.POSITIVE,"source-controller cast triggers that copy that spell preserve copy agency");

const qualifiedLandWipe=compileCard({id:"syn-land-wipe",oracle_id:"syn-land-wipe",name:"Synthetic Land Wipe",layout:"normal",type_line:"Sorcery",mana_cost:"{3}{R}",cmc:4,oracle_text:"Destroy all nonbasic lands.",keywords:[],color_identity:["R"]});
assert.ok(evaluateRole(qualifiedLandWipe,"board_wipe").score>=.72,"qualified land sweeps must be modeled as board wipes");

const targetedTuck=compileCard({id:"syn-targeted-tuck",oracle_id:"syn-targeted-tuck",name:"Synthetic Tuck",layout:"normal",type_line:"Instant",mana_cost:"{2}{U}",cmc:3,oracle_text:"The owner of target nonland permanent puts it on their choice of the top or bottom of their library.",keywords:[],color_identity:["U"]});
assert.equal(evaluateRole(targetedTuck,"removal").adjudication,ADJUDICATION.POSITIVE,"targeted tuck is hostile removal");

const graveShuffle=compileCard({id:"syn-grave-shuffle",oracle_id:"syn-grave-shuffle",name:"Synthetic Grave Shuffle",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{U}",cmc:2,oracle_text:"Target player shuffles up to four target cards from their graveyard into their library.",keywords:[],color_identity:["U"]});
assert.ok(semanticClauses(graveShuffle).some(x=>x.clause.action==="shuffle_graveyard"&&x.clause.sourceZone==="graveyard"&&x.clause.destinationZone==="library"));

const symmetricRecursion=compileCard({id:"syn-symmetric-recursion",oracle_id:"syn-symmetric-recursion",name:"Synthetic Symmetric Recursion",layout:"normal",type_line:"Sorcery",mana_cost:"{3}{B}{B}",cmc:5,oracle_text:"Each player returns all creature cards from their graveyard to the battlefield.",keywords:[],color_identity:["B"]});
assert.equal(evaluateRole(symmetricRecursion,"recursion").adjudication,ADJUDICATION.POSITIVE,"symmetric graveyard return remains recursion evidence");

const freeCastReferenced=compileCard({id:"syn-free-cast",oracle_id:"syn-free-cast",name:"Synthetic Free Cast",layout:"normal",type_line:"Sorcery",mana_cost:"{5}{U}{U}",cmc:7,oracle_text:"You may cast the other cards without paying their mana costs.",keywords:[],color_identity:["U"]});
assert.equal(freeCastReferenced.status,COVERAGE_STATUS.PARTIAL,"referenced free-cast must be partial, not unknown");
assert.ok(semanticClauses(freeCastReferenced).some(x=>x.clause.action==="cast_referenced_cards"));

const restrictedSpend=compileCard({id:"syn-restricted-spend",oracle_id:"syn-restricted-spend",name:"Synthetic Restricted Spend",layout:"normal",type_line:"Creature — Construct",mana_cost:"{2}",cmc:2,oracle_text:"Spend only mana produced by creatures to cast this spell.",keywords:[],color_identity:[]});
assert.ok(semanticClauses(restrictedSpend).some(x=>x.clause.action==="mana_spending_restriction"));

const gyHate=compileCard({id:"syn-gy-hate",oracle_id:"syn-gy-hate",name:"Synthetic Grave Hate",layout:"normal",type_line:"Artifact",mana_cost:"{1}",cmc:1,oracle_text:"Exile all graveyards.",keywords:[],color_identity:[]});
assert.equal(evaluateRole(gyHate,"graveyard_hate").adjudication,ADJUDICATION.POSITIVE);

const tutorCard=compileCard({id:"syn-tutor",oracle_id:"syn-tutor",name:"Synthetic Tutor",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{B}",cmc:3,oracle_text:"Search your library for a card, put that card into your hand, then shuffle.",keywords:[],color_identity:["B"]});
assert.equal(evaluateRole(tutorCard,"tutor").adjudication,ADJUDICATION.POSITIVE);

const winCard=compileCard({id:"syn-win",oracle_id:"syn-win",name:"Synthetic Win",layout:"normal",type_line:"Enchantment",mana_cost:"{4}{W}",cmc:5,oracle_text:"At the beginning of your upkeep, if you have 50 or more life, you win the game.",keywords:[],color_identity:["W"]});
assert.equal(evaluateRole(winCard,"finisher").adjudication,ADJUDICATION.POSITIVE);

const sacOutlet=compileCard({id:"syn-sac-outlet",oracle_id:"syn-sac-outlet",name:"Synthetic Sac Outlet",layout:"normal",type_line:"Creature — Vampire",mana_cost:"{1}{B}",cmc:2,oracle_text:"Sacrifice another creature: Scry 1.",keywords:[],color_identity:["B"]});
assert.equal(evaluateRole(sacOutlet,"sacrifice_outlet").adjudication,ADJUDICATION.POSITIVE);
assert.equal(evaluateArchetype(sacOutlet,"Aristocrats").adjudication,ADJUDICATION.POSITIVE);

const artifactSupport=compileCard({id:"syn-art-support",oracle_id:"syn-art-support",name:"Synthetic Artifact Support",layout:"normal",type_line:"Creature — Artificer",mana_cost:"{2}{U}",cmc:3,oracle_text:"Whenever an artifact you control enters, draw a card.",keywords:[],color_identity:["U"]});
assert.equal(evaluateArchetype(artifactSupport,"Artifacts").adjudication,ADJUDICATION.POSITIVE,"artifact dependency should create artifact-theme evidence even on a nonartifact card");

const wizardKindred=compileCard({id:"syn-wizard-kindred",oracle_id:"syn-wizard-kindred",name:"Synthetic Wizard",layout:"normal",type_line:"Creature — Human Wizard",mana_cost:"{1}{U}",cmc:2,oracle_text:"Flying",keywords:["Flying"],color_identity:["U"]});
assert.equal(evaluateArchetype(wizardKindred,"Wizard Kindred").adjudication,ADJUDICATION.POSITIVE);

const graveyardSpellCasting=compileCard({id:"syn-spellslinger-cast-zone",oracle_id:"syn-spellslinger-cast-zone",name:"Synthetic Graveyard Spells",layout:"normal",type_line:"Legendary Creature — Wizard",mana_cost:"{1}{U}{B}{R}",cmc:4,oracle_text:"Once during each of your turns, you may cast an instant or sorcery spell from your graveyard.",keywords:[],color_identity:["U","B","R"]});
assert.equal(evaluateArchetype(graveyardSpellCasting,"Spellslinger").adjudication,ADJUDICATION.POSITIVE,"casting instant/sorcery spells from another zone is direct Spellslinger evidence");

const typedDual=compileCard({id:"syn-typed-dual",oracle_id:"syn-typed-dual",name:"Synthetic Typed Dual",layout:"normal",type_line:"Land — Island Mountain",mana_cost:"",cmc:0,oracle_text:"This land enters tapped unless you pay 2 life.",keywords:[],color_identity:["U","R"]});
assert.equal(evaluateRole(typedDual,"mana_source").adjudication,ADJUDICATION.POSITIVE,"basic land types must create intrinsic mana-source semantics even without printed Oracle mana text");
assert.equal(evaluateRole(typedDual,"ramp").adjudication,ADJUDICATION.EXPLICIT_NEGATIVE,"intrinsic land mana remains baseline mana, not structural ramp");
const typedDualMana=semanticClauses(typedDual).find(x=>x.clause.action==="add_mana")?.clause;
assert.deepEqual(typedDualMana?.details?.mana?.colors?.sort(),["R","U"],"intrinsic typed-land mana must preserve color capabilities");
assert.equal(typedDualMana?.magnitude?.manaOutput,1,"a dual land chooses one color per tap rather than producing both at once");

const commanderAnyColor=compileCard({id:"syn-command-land",oracle_id:"syn-command-land",name:"Synthetic Command Land",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"{T}: Add one mana of any color in your commander's color identity.",keywords:[],color_identity:[]});
const commandMana=semanticClauses(commanderAnyColor).find(x=>x.clause.action==="add_mana")?.clause?.details?.mana;
assert.equal(commandMana?.anyColor,true);
assert.equal(commandMana?.commanderIdentity,true);

// v4 role-contract hardening from the first real LAB3 field build.
const ownBlink=compileCard({id:"syn-own-blink",oracle_id:"syn-own-blink",name:"Synthetic Own Blink",layout:"normal",type_line:"Artifact — Equipment",mana_cost:"{3}",cmc:3,oracle_text:"Whenever equipped creature deals combat damage to a player, exile up to one target creature you own, then return that card to the battlefield under your control.",keywords:[],color_identity:[]});
assert.notEqual(evaluateRole(ownBlink,"removal").adjudication,ADJUDICATION.POSITIVE,"blinking a creature you own is not hostile removal");

const selfUncounterable=compileCard({id:"syn-self-uncounterable",oracle_id:"syn-self-uncounterable",name:"Synthetic Long Goodbye",layout:"normal",type_line:"Instant",mana_cost:"{1}{B}",cmc:2,oracle_text:"This spell can't be countered. Destroy target creature with mana value 3 or less.",keywords:[],color_identity:["B"]});
assert.notEqual(evaluateRole(selfUncounterable,"protection").adjudication,ADJUDICATION.POSITIVE,"a spell that only makes itself uncounterable is not deck-level protection");
assert.equal(evaluateRole(selfUncounterable,"removal").adjudication,ADJUDICATION.POSITIVE);

const selfSacLand=compileCard({id:"syn-self-sac-land",oracle_id:"syn-self-sac-land",name:"Synthetic Plaza",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"When this land enters, sacrifice it unless you pay {1}.\n{T}: Add one mana of any color.",keywords:[],color_identity:[]});
assert.notEqual(evaluateRole(selfSacLand,"sacrifice_outlet").adjudication,ADJUDICATION.POSITIVE,"forced/self sacrifice is not a sacrifice outlet");

const alternateSacCost=compileCard({id:"syn-alt-sac-cost",oracle_id:"syn-alt-sac-cost",name:"Synthetic Flare",layout:"normal",type_line:"Instant",mana_cost:"{1}{R}{R}",cmc:3,oracle_text:"You may sacrifice a nontoken red creature rather than pay this spell's mana cost. Copy target instant or sorcery spell.",keywords:[],color_identity:["R"]});
assert.notEqual(evaluateRole(alternateSacCost,"sacrifice_outlet").adjudication,ADJUDICATION.POSITIVE,"one-shot alternate casting cost is not a sacrifice outlet");

const creatureOnlyBlast=compileCard({id:"syn-creature-blast",oracle_id:"syn-creature-blast",name:"Synthetic Star",layout:"normal",type_line:"Sorcery",mana_cost:"{5}{R}{R}",cmc:7,oracle_text:"Synthetic Star deals 20 damage to each creature and each planeswalker.",keywords:[],color_identity:["R"]});
assert.notEqual(evaluateRole(creatureOnlyBlast,"finisher").adjudication,ADJUDICATION.POSITIVE,"large damage confined to permanents is not a player-closing finisher");
