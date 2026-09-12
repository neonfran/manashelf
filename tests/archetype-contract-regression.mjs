import assert from "node:assert/strict";
import { classifyCard, deriveCardFacts, CLASSIFICATION_VERSION } from "../lib/deck-metrics.mjs";
import { archetypeAffinity, themeEvidence, inferArchetypeSignals } from "../lib/archetype-contracts.mjs";
import { buildCollectionDeck, COLLECTION_BUILDER_VERSION } from "../lib/collection-deck-builder.mjs";

const meta=(typeLine,oracleText,extra={})=>({typeLine,oracleText,cmc:extra.cmc??3,manaCost:extra.manaCost??"{2}{U}",colorIdentity:extra.colorIdentity??["U"],keywords:extra.keywords??[],legalities:{commander:"legal"},...extra});
const semantic=(name,typeLine,oracleText,extra={})=>{const m=meta(typeLine,oracleText,extra);return {name,meta:m,semantic:classifyCard({name,meta:m}),themeAffinity:extra.themeAffinity??.75}};

assert.equal(CLASSIFICATION_VERSION,7);
assert.equal(COLLECTION_BUILDER_VERSION,14);

// One semantic representation must support different archetype judgments without reparsing
// the card differently for each deck.
{
  const merfolk=semantic("Subtype Cast Engine","Enchantment","Whenever you cast a Merfolk spell, create a 1/1 blue Merfolk creature token.");
  assert.equal(merfolk.semantic.facts.spellslingerRelevant,false,"a subtype-restricted cast trigger is not generic Spellslinger evidence");
  assert.ok(merfolk.semantic.themeDependencies.includes("spell:subtype:merfolk"),"the subtype restriction must survive as a dependency");
  assert.equal(archetypeAffinity(merfolk,"Spellslinger"),0,"Merfolk-cast text must not become Spellslinger");
  assert.ok(archetypeAffinity(merfolk,"Merfolk")>.7,"the same semantic fact should be strongly relevant to the matching kindred theme");
}
{
  const typedKindred=semantic("Typed Kindred Engine","Enchantment","Whenever you cast a Merfolk creature spell, draw a card.");
  assert.ok(typedKindred.semantic.themeDependencies.includes("spell:creature"),"card type restriction must survive alongside subtype");
  assert.ok(typedKindred.semantic.themeDependencies.includes("spell:subtype:merfolk"),"subtype restriction must survive alongside card type");
  assert.equal(archetypeAffinity(typedKindred,"Spellslinger"),0);
  assert.ok(archetypeAffinity(typedKindred,"Merfolk")>.7);
}
{
  const singleInstant=semantic("Instant Cast Engine","Enchantment","Whenever you cast an instant spell, draw a card.");
  assert.ok(singleInstant.semantic.themeDependencies.includes("spell:instant_sorcery"),"single instant/sorcery wording must map to the spell domain instead of a fake subtype");
  assert.ok(archetypeAffinity(singleInstant,"Spellslinger")>.7);
}
{
  const artifact=semantic("Artifact Cast Engine","Enchantment","Whenever you cast an artifact spell, draw a card.");
  assert.equal(archetypeAffinity(artifact,"Spellslinger"),0);
  assert.ok(archetypeAffinity(artifact,"Artifacts")>.7,"artifact-cast payoff should fit Artifacts without being mislabeled Spellslinger");
}
{
  const historic=semantic("Historic Cast Engine","Enchantment","Whenever you cast a historic spell, draw a card.");
  assert.equal(archetypeAffinity(historic,"Spellslinger"),0);
  assert.ok(archetypeAffinity(historic,"Historic")>.7,"historic-spell dependency must map to Historic, not all spell decks");
}
{
  const creature=semantic("Creature Cast Engine","Enchantment","Whenever you cast a creature spell, draw a card.");
  assert.equal(archetypeAffinity(creature,"Spellslinger"),0);
}
{
  const theft=semantic("Borrowed Spell Engine","Creature — Rogue","Whenever you cast a noncreature spell you don't own, create two Treasure tokens.");
  assert.equal(theft.semantic.facts.spellslingerRelevant,false);
  assert.ok(theft.semantic.themeDependencies.includes("ownership:not_owned"),"ownership restriction must remain explicit");
  assert.ok(theft.semantic.roleDependencies.ramp.includes("ownership:not_owned"),"conditional Treasure ramp must retain the same ownership prerequisite");
  assert.equal(archetypeAffinity(theft,"Spellslinger"),0);
}

// Non-cast triggers keep their own event prerequisite; the effect is not treated as free
// repeatable value merely because it creates a useful resource.
{
  const combatTreasure=semantic("Combat Treasure Fixture","Creature — Pirate","Whenever Combat Treasure Fixture attacks, create a Treasure token.",{keywords:[]});
  assert.equal(combatTreasure.semantic.facts.spellslingerRelevant,false);
  assert.ok((combatTreasure.semantic.roleDependencyGroups.ramp||[]).some(g=>g.includes("combat")));
  assert.ok((combatTreasure.semantic.roleDependencyGroups.token_generation||[]).some(g=>g.includes("combat")));
}

// Keywords come from authoritative metadata, not accidental words in a card name/Oracle line.
{
  const named=semantic("Storm Captain Fixture","Creature — Pirate","Whenever Storm Captain Fixture attacks, create a Treasure token.",{keywords:[]});
  assert.equal(named.semantic.facts.spellslingerRelevant,false,"the word Storm in a card name must not manufacture the Storm mechanic");
  const actual=semantic("Actual Keyword Fixture","Sorcery","Draw two cards.",{keywords:["Storm"]});
  assert.equal(actual.semantic.facts.spellslingerRelevant,true);
  assert.ok(archetypeAffinity(actual,"Spellslinger")>.7,"authoritative Storm metadata should be valid Spellslinger evidence");
}

// Ability scope must be local. A one-shot draw ability and a separate harmful spell trigger
// cannot merge into a fictitious repeatable draw engine.
{
  const split=semantic("Split Ability Fixture","Enchantment","When this enchantment enters, draw three cards.\nWhenever you cast a spell, sacrifice this enchantment.");
  assert.ok(split.semantic.roleIds.includes("card_draw"));
  assert.ok(!split.semantic.roleIds.includes("engine"),"unrelated abilities may not lend their trigger/effect to each other");
  assert.equal(archetypeAffinity(split,"Spellslinger"),0,"a harmful cast trigger is not a Spellslinger payoff");
}

// Copy and cost-reduction effects preserve the spell domain they actually affect.
{
  const artifactCopy=semantic("Artifact Copy Fixture","Creature — Artificer","{3}, {T}: Copy target artifact spell you control.");
  const instantCopy=semantic("Instant Copy Fixture","Instant","Copy target instant or sorcery spell you control.");
  assert.equal(archetypeAffinity(artifactCopy,"Spellslinger"),0);
  assert.ok(archetypeAffinity(instantCopy,"Spellslinger")>.6);
  const creatureReducer=semantic("Creature Reducer Fixture","Artifact","Green creature spells you cast cost {1} less to cast.",{colorIdentity:[]});
  const spellReducer=semantic("Spell Reducer Fixture","Creature — Wizard","Instant and sorcery spells you cast cost {1} less to cast.");
  assert.equal(archetypeAffinity(creatureReducer,"Spellslinger"),0);
  assert.ok(spellReducer.semantic.roleDependencies.ramp.includes("spell:instant_sorcery"));
  assert.ok(archetypeAffinity(spellReducer,"Spellslinger")>.6);
}

// Equipment/Aura contracts must not collapse back to "all artifacts/enchantments".
{
  const rock=semantic("Plain Artifact Fixture","Artifact","{T}: Add {U}.",{colorIdentity:[],producedMana:["U"]});
  const sword=semantic("Equipment Fixture","Artifact — Equipment","Equipped creature gets +2/+2. Equip {2}.",{colorIdentity:[]});
  const enchant=semantic("Plain Enchantment Fixture","Enchantment","At the beginning of your upkeep, scry 1.");
  const aura=semantic("Aura Fixture","Enchantment — Aura","Enchant creature. Enchanted creature gets +2/+2.");
  assert.equal(archetypeAffinity(rock,"Equipment"),0,"Equipment theme must not mean every artifact");
  assert.ok(archetypeAffinity(sword,"Equipment")>.8);
  assert.equal(archetypeAffinity(enchant,"Auras"),0,"Aura theme must not mean every enchantment");
  assert.ok(archetypeAffinity(aura,"Auras")>.8);
}

// Ability-local dependencies must not poison independent functions on the same card.
{
  const mixedResource=semantic("Independent Resource Fixture","Enchantment","Draw two cards.\nWhenever you cast a Merfolk spell, create a 1/1 blue Merfolk creature token.");
  assert.ok(mixedResource.semantic.roleIds.includes("card_draw"));
  assert.ok((mixedResource.semantic.roleDependencyGroups.resources||[]).some(g=>g.length===0),"unconditional draw must retain an unconditional resource path");
  assert.ok((mixedResource.semantic.roleDependencyGroups.token_generation||[]).some(g=>g.includes("spell:subtype:merfolk")),"the Merfolk prerequisite must stay attached to token generation only");
  assert.equal(archetypeAffinity(mixedResource,"Spellslinger"),0,"an unrelated restricted cast trigger must not make the permanent Spellslinger");
}
{
  const mixedRamp=semantic("Independent Ramp Fixture","Artifact","{T}: Add {U}.\nWhenever you cast a Merfolk spell, create a 1/1 blue Merfolk creature token.",{colorIdentity:[],producedMana:["U"]});
  assert.ok(mixedRamp.semantic.roleIds.includes("ramp"));
  assert.ok((mixedRamp.semantic.roleDependencyGroups.ramp||[]).some(g=>g.length===0),"unconditional mana acceleration must remain an independent ramp path");
  assert.ok((mixedRamp.semantic.roleDependencyGroups.token_generation||[]).some(g=>g.includes("spell:subtype:merfolk")));
}

// Multiple abilities that satisfy the same role are alternatives, not one giant conjunction.
{
  const alternate=semantic("Alternative Path Fixture","Enchantment","Whenever you cast an instant or sorcery spell, draw a card.\nWhenever you cast a Merfolk spell, draw a card.");
  const groups=alternate.semantic.roleDependencyGroups.resources||[];
  assert.ok(groups.some(g=>g.includes("spell:instant_sorcery")));
  assert.ok(groups.some(g=>g.includes("spell:subtype:merfolk")));
  assert.ok(archetypeAffinity(alternate,"Spellslinger")>.7,"the compatible ability must remain strong even when another ability has an unrelated prerequisite");
}

// Context/EDHREC evidence can rank semantically coherent cards but cannot manufacture a strong
// archetype hit when the canonical semantics say the card belongs to another spell domain.
{
  const wrong=semantic("High Context Wrong Scope","Enchantment","Whenever you cast an artifact spell, draw a card.",{themeAffinity:1});
  const e=themeEvidence(wrong,"Spellslinger",1);
  assert.equal(e.archetype,0);
  assert.ok(e.effective<.3,`external context must not overpower a semantic mismatch (${e.effective})`);
}

// Builder-level regression: false cast-domain cards may still enter for a real structural role
// or type floor, but they cannot enter as Spellslinger theme seed/density and restricted ramp
// cannot crowd out reliable acceleration.
{
  const commanderMeta=meta("Legendary Creature — Human Wizard","During each of your turns, you may cast an instant or sorcery spell from your graveyard.",{cmc:4,manaCost:"{1}{U}{B}{R}",colorIdentity:["U","B","R"]});
  const pool=[];
  const add=(name,typeLine,oracleText,cmc,manaCost,themeAffinity=.75,extra={})=>pool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.45,themeAffinity,efficiencyScore:.58,meta:meta(typeLine,oracleText,{cmc,manaCost,colorIdentity:["U","B","R"],...extra})});
  for(let i=0;i<24;i++)add(`Core Instant ${i}`,"Instant","Draw a card.",2,"{1}{U}",.62);
  for(let i=0;i<12;i++)add(`Core Payoff ${i}`,"Creature — Wizard","Whenever you cast an instant or sorcery spell, draw a card.",3,"{2}{U}",.58);
  for(let i=0;i<12;i++)add(`Reliable Rock ${i}`,"Artifact","{T}: Add one mana of any color.",2,"{2}",.28,{colorIdentity:[],producedMana:["U","B","R"]});
  for(let i=0;i<12;i++)add(`Core Removal ${i}`,"Instant","Destroy target creature.",2,"{1}{B}",.55);
  for(let i=0;i<4;i++)add(`Core Wipe ${i}`,"Sorcery","Destroy all creatures.",4,"{2}{B}{B}",.44);
  for(let i=0;i<8;i++)add(`Core Protection ${i}`,"Instant","Target creature you control gains indestructible until end of turn.",1,"{U}",.42);
  for(let i=0;i<8;i++)add(`Wrong Subtype ${i}`,"Enchantment","Whenever you cast a Merfolk spell, create a 1/1 blue Merfolk creature token.",3,"{2}{U}",1);
  for(let i=0;i<8;i++)add(`Wrong Reducer ${i}`,"Artifact","Green creature spells you cast cost {1} less to cast.",3,"{3}",1,{colorIdentity:[]});
  for(let i=0;i<6;i++)add(`Borrowed Ramp ${i}`,"Creature — Rogue","Whenever you cast a noncreature spell you don't own, create two Treasure tokens.",4,"{1}{U}{B}{R}",1);
  const deck=buildCollectionDeck({commander:"Semantic Wizard",commanderMeta,theme:{name:"Spellslinger",slug:"spellslinger"},candidates:pool,settings:{themeFocus:85,ramp:"standard",interaction:"standard",curve:"normal",synergyBias:"balanced",protectExistingDecks:false,landStyle:"balanced"}});
  const wrongTheme=deck.mainboard.filter(c=>(c.name.startsWith("Wrong ")||c.name.startsWith("Borrowed "))&&["theme-seed","theme-density"].includes(c.selectionPhase));
  assert.deepEqual(wrongTheme.map(c=>c.name),[],"wrong spell domains must never be selected to satisfy Spellslinger theme density");
  assert.ok(deck.mainboard.filter(c=>c.name.startsWith("Reliable Rock")).length>=8,"reliable generic acceleration must not be crowded out by unsupported conditional ramp");
  assert.ok(deck.roleCounts.ramp>=8,"structural ramp must remain healthy after semantic gating");
}

console.log("archetype contract regression: OK");


// Local theme fallback must be a view over the same contract evaluator, not a second regex classifier.
{
  const merfolkLord=semantic("Local Merfolk Fixture","Legendary Creature — Merfolk Wizard","Whenever you cast a Merfolk creature spell, create a 1/1 blue Merfolk creature token.");
  const signals=inferArchetypeSignals(merfolkLord).map(x=>x.name);
  assert.ok(signals.some(x=>/Kindred: Merfolk/i.test(x)),"local fallback inference must use the same contracts for subtype dependencies");
  assert.ok(!signals.includes("Spellslinger"),"local fallback must not resurrect Merfolk-cast as Spellslinger");
}
