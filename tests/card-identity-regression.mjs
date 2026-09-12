import fs from "node:fs";
import assert from "node:assert/strict";
import { normalizeCardName, cardNameAliases, cardNameMatches, getCardAlias, setCardAlias } from "../lib/card-identity.mjs";
import { classifyCard, deriveCardFacts, CLASSIFICATION_VERSION } from "../lib/deck-metrics.mjs";
import { analyzeLandSource, MANA_MODEL_VERSION } from "../lib/collection-deck-builder.mjs";

const meta=(typeLine,oracleText,extra={})=>({typeLine,oracleText,cmc:2,manaCost:"{2}",colorIdentity:[],legalities:{commander:"legal"},...extra});
const classify=(name,typeLine,oracleText,extra={})=>classifyCard({name,meta:meta(typeLine,oracleText,extra)});

// Canonical identity is formatting/face aware without touching display names.
assert.equal(normalizeCardName(" Fire//Ice "),normalizeCardName("Fire // Ice"));
assert.equal(normalizeCardName("Urza’s Saga"),normalizeCardName("Urza's Saga"));
assert.ok(cardNameMatches("Fire // Ice","Fire"));
assert.ok(cardNameMatches("Fire // Ice","Ice"));
assert.deepEqual(cardNameAliases("Fire//Ice"),["fire // ice","fire","ice"]);
const aliasMap=new Map();setCardAlias(aliasMap,"Fire // Ice",{ok:true});
assert.equal(getCardAlias(aliasMap,"Fire")?.ok,true);
assert.equal(getCardAlias(aliasMap,"Ice")?.ok,true);

// Self-bounce is not hostile removal/protection, and artifact-only copy is not Spellslinger.
{
  const text="{1}{U}: Return target artifact you control to its owner's hand.\n{3}, {T}: Copy target artifact spell you control.";
  const c=classify("Self-bounce Artificer","Legendary Creature — Human Artificer Advisor",text);
  const facts=deriveCardFacts({name:"Self-bounce Artificer",meta:meta("Legendary Creature — Human Artificer Advisor",text)});
  assert.ok(c.roleIds.includes("self_bounce"));
  assert.ok(c.roleIds.includes("spell_copy"));
  assert.ok(!c.roleIds.includes("removal"));
  assert.ok(!c.roleIds.includes("protection"));
  assert.deepEqual(facts.copySpellScopes,["artifact"]);
  assert.equal(facts.spellslingerRelevant,false);
  assert.ok(c.dependencies.includes("artifacts"));
  assert.ok(!c.synergyTags.includes("spellslinger"));
}

// A bounce land's mandatory self-return is a tempo cost, not resilience/payoff.
{
  const text="This land enters the battlefield tapped. When this land enters the battlefield, return a land you control to its owner's hand. {T}: Add {U}{R}.";
  const card={name:"Blue-Red Bounce Land",meta:meta("Land",text,{producedMana:["U","R"],cmc:0,manaCost:""})};
  const c=classifyCard(card),land=analyzeLandSource(card,["U","R"]);
  assert.ok(c.roleIds.includes("land")&&c.roleIds.includes("mana_source")&&c.roleIds.includes("mana_fixing"));
  assert.ok(c.roleIds.includes("self_bounce"));
  assert.ok(!c.roleIds.includes("protection"));
  assert.ok(!c.roleIds.includes("payoff"));
  assert.equal(land.entersTapped,true);
  assert.equal(land.effectiveTapped,true);
}

// Resource conversion is not automatically acceleration.
{
  const c=classify("Sacrifice Draw","Instant","As an additional cost to cast this spell, sacrifice an artifact or creature. Draw two cards and create a Treasure token.");
  assert.ok(c.roleIds.includes("card_draw"));
  assert.ok(c.roleIds.includes("token_generation"));
  assert.ok(c.roleIds.includes("sacrifice_outlet"));
  assert.ok(!c.roleIds.includes("ramp"));
  assert.ok(!c.roleIds.includes("mana_fixing"));
}

// Mana-neutral filters do not satisfy ramp; net-positive repeatable rocks do.
{
  const filter=classify("Neutral Filter","Artifact","{1}, {T}: Add one mana of any color.",{producedMana:["W","U","B","R","G"]});
  const rock=classify("Net Positive Rock","Artifact","{1}, {T}: Add {U}{R}.",{producedMana:["U","R"]});
  assert.ok(!filter.roleIds.includes("ramp"));
  assert.ok(filter.roleIds.includes("mana_fixing"));
  assert.ok(rock.roleIds.includes("ramp"));
}

// Repeatable spell-triggered Treasure is legitimate conditional acceleration.
{
  const c=classify("Spell Treasure Engine","Creature — Dwarf Shaman","Whenever you cast or copy an instant or sorcery spell, create a Treasure token.");
  assert.ok(c.roleIds.includes("ramp"));
  assert.ok(c.themeDependencies.includes("spell:instant_sorcery"));
  assert.ok(c.benefitsFrom.includes("spell:instant_sorcery"));
  assert.equal(c.facts.spellslingerRelevant,true);
}

// Opponent-facing words must not leak into our ramp/theme semantics.
{
  const c=classify("Opponent Treasure Counter","Instant","Counter target noncreature spell. Its controller creates two Treasure tokens.");
  const f=deriveCardFacts({name:"Opponent Treasure Counter",meta:meta("Instant","Counter target noncreature spell. Its controller creates two Treasure tokens.")});
  assert.ok(c.roleIds.includes("counterspell"));
  assert.ok(!c.roleIds.includes("ramp"));
  assert.equal(f.spellslingerRelevant,false);
  assert.equal(f.mana.treasureForOpponent,true);
  assert.equal(f.mana.treasureForYou,false);
}

assert.equal(CLASSIFICATION_VERSION,7);
assert.equal(MANA_MODEL_VERSION,5);

// Public/private access must share deck-usage synchronization. Authentication changes
// reach, not the meaning of availability for decks both modes can read.
const server=fs.readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
const usageStart=server.indexOf("function startDeckUsageSync("),usageEnd=server.indexOf("function prefetchDeckSizes(",usageStart),usageSource=server.slice(usageStart,usageEnd);
assert.ok(usageStart>=0&&usageEnd>usageStart,"deck usage sync function must exist");
assert.ok(!usageSource.includes("if(!session.account)"),"public sessions must not bypass usage synchronization");
assert.match(server,/if\(p==="\/api\/public-login"[^]*?registerSession\(sessionId,session\);\s*startDeckUsageSync\(session\);/,"public login must start the same deck-usage sync path");

console.log("card identity + semantic regression: OK");
