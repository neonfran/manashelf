import assert from "node:assert/strict";
import {buildDeckMetrics,parseManaCost} from "../lib/deck-metrics.mjs";

const mk=(name,typeLine,oracleText,cmc,manaCost,producedMana=[],quantity=1)=>({name,quantity,meta:{typeLine,oracleText,cmc,manaCost,producedMana}});

assert.deepEqual(parseManaCost("{2}{W}{U}"),{
  tokens:["2","W","U"],pips:{W:1,U:1,B:0,R:0,G:0,C:0},generic:2,variable:false,colors:["W","U"],coloredPips:2
});

const cards=[];
for(let i=0;i<36;i++)cards.push(mk(`Forest ${i+1}`,"Basic Land — Forest","{T}: Add {G}.",0,"",["G"]));
for(let i=0;i<10;i++)cards.push(mk(`Ramp ${i+1}`,"Sorcery","Search your library for a basic land card, put it onto the battlefield tapped.",2,"{1}{G}"));
for(let i=0;i<8;i++)cards.push(mk(`Draw ${i+1}`,"Sorcery","Draw two cards.",3,"{2}{G}"));
for(let i=0;i<8;i++)cards.push(mk(`Removal ${i+1}`,"Instant","Destroy target creature.",2,"{1}{G}"));
for(let i=0;i<25;i++)cards.push(mk(`Dragon ${i+1}`,"Creature — Dragon","Flying. Whenever this creature attacks, it deals 2 damage to each opponent.",5,"{4}{G}"));
cards.push(mk("Commander","Legendary Creature — Dragon","Flying. Dragon spells you cast cost {1} less.",6,"{5}{G}"));
while(cards.length<100)cards.push(mk(`Mana Rock ${cards.length}`,"Artifact","{T}: Add {G}.",2,"{2}",["G"]));

const out=buildDeckMetrics(cards,{commanderName:"Commander",tribalType:"Dragon",iterations:1000,deckSignature:"smoke"});
assert.equal(out.engine.metricsVersion,1);
assert.equal(out.classifications.length,100);
assert.equal(out.metrics.manaReliability.landCount,36);
assert.equal(out.metrics.interactionDensity.count,8);
assert.ok(out.metrics.manaReliability.landDropT3>0.7);
assert.ok(out.metrics.earlyDevelopment.productiveT2>0.4);
assert.ok(out.metrics.goldfishDevelopment.byTurn.length===7);
assert.ok(out.metrics.effectiveManaValue.adjustedAverage<=out.metrics.effectiveManaValue.printedAverage);
console.log("Deck Metrics smoke test: OK");

// Regression: semantic rules must distinguish who receives Treasures, constrained counters,
// death-return resilience, and “can't be regenerated” reminder text.
{
  const { classifyCard } = await import("../lib/deck-metrics.mjs");
  const mk=(name,typeLine,oracleText,cmc=2)=>({name,typeLine,oracleText,cmc,manaCost:"{1}{U}"});
  const negate=classifyCard(mk("Negate","Instant","Counter target noncreature spell."));
  assert.ok(negate.roleIds.includes("counterspell"),"Negate-style constrained counters must count as interaction");
  const offer=classifyCard(mk("An Offer You Can't Refuse","Instant","Counter target noncreature spell. Its controller creates two Treasure tokens.",1));
  assert.ok(offer.roleIds.includes("counterspell"),"counter role must survive opponent-Treasure rider");
  assert.ok(!offer.roleIds.includes("ramp"),"Treasure created for an opponent/controller must not count as ramp");
  const fake=classifyCard(mk("Fake Your Own Death","Instant","Until end of turn, target creature gets +2/+0 and gains ‘When this creature dies, return it to the battlefield under its owner's control tapped.’ When that creature enters the battlefield this turn, you create a Treasure token.",2));
  assert.ok(fake.roleIds.includes("recursion"),"Feign Death-style return effects must count as resilience/recursion");
  const pongify=classifyCard(mk("Pongify","Instant","Destroy target creature. It can't be regenerated. Its controller creates a 3/3 green Ape creature token.",1));
  assert.ok(!pongify.roleIds.includes("protection"),"‘can't be regenerated’ must not create a false protection role");

  const offerReminder=classifyCard(mk("An Offer Reminder","Instant","Counter target noncreature spell. Its controller creates two Treasure tokens. (It's an artifact with \"{T}, Sacrifice this artifact: Add one mana of any color.\")",1));
  assert.ok(!offerReminder.roleIds.includes("ramp"),"Treasure reminder text must not manufacture a ramp role");
  const lore=classifyCard(mk("Nature's Lore","Sorcery","Search your library for a Forest card, put that card onto the battlefield, then shuffle.",2));
  assert.ok(lore.roleIds.includes("ramp"),"Forest-card tutors to the battlefield must count as land ramp");
  const chainweb=classifyCard(mk("Chainweb Aracnir","Creature — Spider","Escape—{3}{G}, Exile four other cards from your graveyard. Chainweb Aracnir escapes with three +1/+1 counters on it.",1));
  assert.ok(!chainweb.roleIds.includes("graveyard_hate"),"self-graveyard exile costs must not count as graveyard hate");
  const crypt=classifyCard(mk("Graveyard Test","Artifact","{T}: Exile target card from an opponent's graveyard.",1));
  assert.ok(crypt.roleIds.includes("graveyard_hate"),"opponent graveyard exile must count as graveyard hate");
  const takeDown=classifyCard(mk("Take Down","Sorcery","Choose one — Destroy target creature with flying; or Take Down deals 1 damage to each creature with flying.",1));
  assert.ok(!takeDown.roleIds.includes("board_wipe"),"selective sweepers must not count as full board wipes");
  assert.ok(takeDown.roleIds.includes("partial_sweeper"),"selective sweepers should remain visible as partial interaction");

  const opponentToken=classifyCard(mk("Opponent Token Test","Instant","Destroy target creature. Its controller creates a 3/3 green Beast creature token.",2));
  assert.ok(!opponentToken.roleIds.includes("token_generation"),"tokens created for an opponent/controller must not satisfy your token-generation theme");
  assert.ok(!opponentToken.synergyTags.includes("token"),"opponent token riders must not create a token-synergy tag");
  const antiFlyer=classifyCard(mk("Anti Flyer Test","Instant","Destroy target creature with flying.",2));
  assert.ok(!antiFlyer.roleIds.includes("evasion"),"mentioning flying on a removal target must not make the spell an evasion card");
  const artifactHate=classifyCard(mk("Artifact Hate Test","Instant","Destroy target artifact.",2));
  assert.ok(!artifactHate.synergyTags.includes("artifact"),"artifact removal must not masquerade as artifact-theme support");
  const enchantmentHate=classifyCard(mk("Enchantment Hate Test","Instant","Exile target enchantment.",2));
  assert.ok(!enchantmentHate.synergyTags.includes("enchantment"),"enchantment removal must not masquerade as enchantment-theme support");
  const fullWipe=classifyCard(mk("Full Wipe Test","Sorcery","Destroy all creatures.",4));
  assert.ok(fullWipe.roleIds.includes("board_wipe"),"unrestricted mass creature destruction must count as a board wipe");
  const selectiveWipe=classifyCard(mk("Selective Wipe Test","Sorcery","Destroy all nonlegendary creatures.",4));
  assert.ok(!selectiveWipe.roleIds.includes("board_wipe"),"qualified mass removal must not count as a full board wipe");
  assert.ok(selectiveWipe.roleIds.includes("partial_sweeper"),"qualified mass removal should remain visible as a partial sweeper");
  const escapeAura=classifyCard(mk("Escape Aura Test","Enchantment — Aura","Enchant creature. Enchanted creature gets +2/-1. Escape—{2}{B}, Exile three other cards from your graveyard. (You may cast this card from your graveyard for its escape cost.)",1));
  assert.ok(escapeAura.roleIds.includes("recursion"),"Escape should remain recognized as graveyard replay/resilience");
  assert.ok(!escapeAura.roleIds.includes("impulse_draw")&&!escapeAura.roleIds.includes("card_advantage"),"Escape reminder text must not masquerade as impulse draw/card advantage");
}

// v4 regression: canonical archetype facts must distinguish clone/copy effects, token
// multipliers, narrow mass removal, land tutors and rules references to the Commander.
{
  const { classifyCard } = await import("../lib/deck-metrics.mjs");
  const mk2=(name,typeLine,oracleText,cmc=2,manaCost="{2}")=>({name,typeLine,oracleText,cmc,manaCost});
  const adrix=classifyCard(mk2("Adrix and Nev Test","Legendary Creature — Merfolk Wizard","If one or more tokens would be created under your control, twice that many of those tokens are created instead.",4,"{2}{G}{U}"));
  assert.ok(adrix.roleIds.includes("token_support"),"token replacement/doubling effects must be explicit token support");
  assert.ok(adrix.facts.tokenMultiplier,"token multiplier fact must be exposed canonically");
  const metamorph=classifyCard(mk2("Phyrexian Metamorph Test","Artifact Creature — Phyrexian Shapeshifter","You may have this creature enter the battlefield as a copy of any artifact or creature on the battlefield, except it's an artifact in addition to its other types.",4,"{3}{U/P}"));
  assert.ok(metamorph.roleIds.includes("clone")&&metamorph.facts.clonePermanent,"permanent copy effects must be recognized as clones");
  const major=classifyCard(mk2("Double Major Test","Instant","Copy target creature spell you control, except it isn't legendary if the spell is legendary.",2,"{G}{U}"));
  assert.ok(major.roleIds.includes("spell_copy"),"spell-copy effects must be explicit");
  assert.ok(!major.roleIds.includes("clone"),"copying a creature spell must not masquerade as a permanent clone");
  const signet=classifyCard(mk2("Arcane Signet Test","Artifact","{T}: Add one mana of any color in your commander's color identity.",2,"{2}"));
  assert.ok(!signet.dependencies.includes("commander"),"Commander color-identity rules text is not a battlefield dependency");
  const reverent=classifyCard(mk2("Reverent Silence Test","Sorcery","Destroy all enchantments.",4,"{3}{G}"));
  assert.ok(reverent.roleIds.includes("mass_removal"),"narrow mass removal must remain visible as interaction");
  assert.ok(!reverent.roleIds.includes("board_wipe"),"enchantment-only sweepers must not satisfy structural board-wipe quotas");
  const lore2=classifyCard(mk2("Nature's Lore Test 2","Sorcery","Search your library for a Forest card, put that card onto the battlefield, then shuffle.",2,"{1}{G}"));
  assert.ok(lore2.roleIds.includes("land_tutor"),"land ramp searches must have a dedicated land-tutor role");
  assert.ok(!lore2.roleIds.includes("tutor"),"land ramp must not inflate generic tutor counts");

  const night=classifyCard(mk2("Night of Souls Betrayal Test","Legendary Enchantment","All creatures get -1/-1.",4,"{2}{B}{B}"));
  assert.ok(!night.roleIds.includes("board_wipe"),"a static -1/-1 effect must not satisfy a structural board-wipe quota");
  assert.ok(night.roleIds.includes("partial_sweeper"),"a static -1/-1 effect should remain visible as a partial sweeper");
  const vapors=classifyCard(mk2("Mephitic Vapors Test","Sorcery","All creatures get -1/-1 until end of turn. Cycling {2}.",3,"{2}{B}"));
  assert.ok(!vapors.roleIds.includes("board_wipe"),"a fixed temporary -1/-1 effect must not count as a full wipe");
  assert.ok(vapors.roleIds.includes("partial_sweeper"),"fixed temporary shrink should remain partial interaction");
  const mutilate=classifyCard(mk2("Mutilate Test","Sorcery","All creatures get -1/-1 until end of turn for each Swamp you control.",4,"{2}{B}{B}"));
  assert.ok(mutilate.roleIds.includes("board_wipe"),"scalable -N/-N sweepers tied to board state must remain structural wipes");

  const incidental=classifyCard(mk2("Incidental Treasure Test","Creature — Human","When this creature enters, create a Treasure token.",2,"{1}{R}"));
  const repeatable=classifyCard(mk2("Repeatable Token Test","Enchantment","Whenever you cast an instant or sorcery spell, create a 1/1 blue Bird creature token with flying.",3,"{2}{U}"));
  assert.ok(incidental.facts.tokenIncidental&&!incidental.facts.tokenRepeatable,"one-shot single-token creation must be marked incidental");
  assert.ok(repeatable.facts.tokenRepeatable&&!repeatable.facts.tokenIncidental,"repeatable triggered token creation must be distinguished from incidental token text");
}
