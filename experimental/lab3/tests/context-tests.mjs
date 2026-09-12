import assert from "node:assert/strict";
import { compileCardV5 } from "../../semantic-v2/compiler.mjs";
import { runtimeRecordFromSemanticV2 } from "../runtime-index.mjs";
import { cardProfile, analyzeDeckContext, themeContractFor, themeSupportForCard, themeModeForCard, decorateEdhrecThemesForLab3, buildContextState, profileSupportContribution } from "../deck-context.mjs";

const raw=(id,name,type_line,mana_cost,oracle_text,color_identity=[])=>({id,oracle_id:id,name,layout:"normal",type_line,mana_cost,cmc:(mana_cost.match(/\{/g)||[]).length,oracle_text,keywords:[],color_identity,legalities:{commander:"legal"}});
const spell=runtimeRecordFromSemanticV2(compileCardV5(raw("ctx-spell","Context Spell","Instant","{U}","Draw a card.",["U"])));
const payoff=runtimeRecordFromSemanticV2(compileCardV5(raw("ctx-payoff","Context Payoff","Creature — Wizard","{2}{U}","Whenever you cast an instant or sorcery spell, draw a card.",["U"])));
const artifactSupport=runtimeRecordFromSemanticV2(compileCardV5(raw("ctx-art","Artifact Support","Creature — Artificer","{2}{U}","Whenever an artifact you control enters, draw a card.",["U"])));
const wizard=runtimeRecordFromSemanticV2(compileCardV5(raw("ctx-wiz","Wizard Body","Creature — Human Wizard","{1}{U}","Flying",["U"])));

assert.ok(spell.signals.produces.includes("card:instant_sorcery"));
const pSpell=cardProfile(spell,{theme:"Spellslinger"}),pPayoff=cardProfile(payoff,{theme:"Spellslinger"});
let ctx=analyzeDeckContext([pSpell,pPayoff],{theme:"Spellslinger"});
const payoffCtx=ctx.cards.find(x=>x.card.oracleId==="ctx-payoff");
assert.ok(payoffCtx.dependencySatisfaction>0,"spell payoff should see an instant/sorcery supply");
assert.ok(payoffCtx.contextualSynergy>0);
assert.ok(payoffCtx.dependencySatisfaction<.5,"one instant/sorcery should not satisfy the reliability floor as if the package were complete");
assert.ok(ctx.summary.packageLinks>=1,"producer→consumer package links should be exposed");
assert.ok(ctx.summary.dependencyCoverage>=0&&ctx.summary.dependencyCoverage<=1);
const supportCtx=buildContextState([pPayoff]);
assert.ok(profileSupportContribution(pSpell,supportCtx)>0,"an enabler should gain contextual value when it supplies a demanded signal");

const noSpellCtx=analyzeDeckContext([pPayoff],{theme:"Spellslinger"});
assert.ok(noSpellCtx.cards[0].dependencySatisfaction<ctx.cards.find(x=>x.card.oracleId==="ctx-payoff").dependencySatisfaction,"dependency satisfaction must improve when the needed family is present");

assert.equal(themeContractFor(artifactSupport,"Artifacts").adjudication,"positive");
assert.equal(themeContractFor(wizard,"Wizard Kindred").adjudication,"positive");
assert.equal(themeSupportForCard(payoff,"Storm").supported,true,"known semantic aliases should remain selectable");
assert.equal(themeSupportForCard(wizard,"Wheels").supported,false,"unknown labels still must not fabricate a semantic contract");
assert.equal(themeModeForCard(wizard,"Wheels").mode,"external_fallback","unknown EDHREC themes must remain selectable through an explicit external fallback mode");
const fallbackProfile=cardProfile(wizard,{theme:"Wheels",themeMode:"external_fallback",external:{themeAffinity:.8}});
assert.equal(fallbackProfile.semanticTheme,0,"external fallback must not fabricate semantic theme evidence");
assert.ok(fallbackProfile.themeScore>.75,"strong EDHREC theme-page evidence must be usable when no dedicated semantic contract exists");
assert.equal(fallbackProfile.themeEvidenceSource,"edhrec_external_fallback");
const rawTags=[{name:"Wheels",slug:"wheels",count:1200},{name:"Spellslinger",slug:"spellslinger",count:900},{name:"Discard",slug:"discard",count:700}];
const decorated=decorateEdhrecThemesForLab3(payoff,rawTags,{limit:18});
assert.deepEqual(decorated.map(x=>x.name),rawTags.map(x=>x.name),"LAB3 must preserve the EDHREC theme list/order instead of filtering unsupported contracts");
assert.equal(decorated[0].mode,"external_fallback");
assert.equal(decorated[1].mode,"semantic");
assert.equal(themeContractFor(wizard,"Balanced / Good Stuff").status,"supported","balanced fallback must be an explicit neutral contract");

console.log("LAB3 deck context tests: OK");
