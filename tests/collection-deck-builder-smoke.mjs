import assert from "node:assert/strict";
import { analyzeLandSource, buildCollectionDeck, themeFacetTags, COLLECTION_BUILDER_VERSION, MANA_MODEL_VERSION } from "../lib/collection-deck-builder.mjs";

const commanderMeta={typeLine:"Legendary Creature — Human Cleric",oracleText:"Whenever one or more tokens enter the battlefield under your control, draw a card.",cmc:4,manaCost:"{2}{W}{W}",colorIdentity:["W"],legalities:{commander:"legal"},ownedQuantity:1};
const candidates=[];
function add(name,typeLine,oracleText,cmc,manaCost,themeAffinity=.55,extra={}){
  candidates.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.65,themeAffinity,efficiencyScore:.45,meta:{typeLine,oracleText,cmc,manaCost,colorIdentity:["W"],legalities:{commander:"legal"},...extra}});
}
for(let i=0;i<14;i++)add(`Ramp ${i}`,"Artifact",`{T}: Add {W}. ${i%2?"Create a 1/1 creature token.":""}`,2,"{2}",.45,{producedMana:["W"]});
for(let i=0;i<14;i++)add(`Draw ${i}`,"Enchantment",`Whenever a creature token enters the battlefield under your control, draw a card.`,3,"{2}{W}",.86);
for(let i=0;i<14;i++)add(`Removal ${i}`,"Instant",`Exile target creature. ${i%2?"Create a 1/1 creature token.":""}`,2,"{1}{W}",.5);
for(let i=0;i<28;i++)add(`Token Maker ${i}`,"Creature — Human",`When this creature enters, create two 1/1 white Soldier creature tokens.`,2+(i%3),i%3?"{2}{W}":"{1}{W}",.92);
for(let i=0;i<10;i++)add(`Finisher ${i}`,"Creature — Angel",`Creatures you control get +2/+2 and have flying. Whenever a creature token attacks, each opponent loses 1 life.`,5,"{3}{W}{W}",.8);
candidates.push({name:"Plains",ownedQuantity:80,availableQuantity:80,commanderAffinity:.2,themeAffinity:0,efficiencyScore:.4,meta:{typeLine:"Basic Land — Plains",oracleText:"{T}: Add {W}.",cmc:0,manaCost:"",colorIdentity:[],producedMana:["W"],legalities:{commander:"legal"}}});

const deck=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates,settings:{themeFocus:78,ramp:"standard",interaction:"standard",curve:"normal",synergyBias:"balanced",protectExistingDecks:true,commanderDependence:"normal",landStyle:"balanced"}});
assert.equal(COLLECTION_BUILDER_VERSION,14);
assert.equal(MANA_MODEL_VERSION,5);
assert.equal(deck.size,100,"builder should create exactly 99 + Commander with sufficient collection");
assert.equal(deck.mainboard[0].primaryCategory,"Commander");
assert.equal(deck.mainboard.reduce((n,c)=>n+Number(c.quantity||1),0),100);
assert.ok(deck.summary.lands>=35&&deck.summary.lands<=41,`land count should remain contextual, got ${deck.summary.lands}`);
assert.ok(deck.roleCounts.ramp>=8,"builder should preserve structural ramp");
assert.ok(deck.roleCounts.interaction>=8,"builder should preserve interaction");
assert.ok(deck.summary.themeDensity>.35,"theme should materially influence the generated deck");
assert.ok(deck.metrics?.metrics?.manaReliability,"generated deck should be auditable by Deck Metrics");
assert.ok(deck.mainboard.some(c=>c.primaryCategory==="Theme Engine"||c.primaryCategory==="Theme Support"||c.primaryCategory==="Theme Payoff"),"theme categories should be visible");
assert.ok(deck.validation?.hardValid,"final legality/ownership invariants must pass before a deck is emitted");
assert.ok(deck.invariants?.commanderExactlyOne&&deck.invariants?.singleton&&deck.invariants?.ownership,"final invariant checks must be exposed in the result");
assert.ok(deck.mainboard.filter(c=>!c.isCommander&&!c.syntheticBasic).some(c=>c.selectionPhase&&Number.isFinite(Number(c.selectionContextScore))),"selected cards must expose the phase/context score that actually admitted them");
console.log(`collection deck builder smoke: ok · size ${deck.size} · lands ${deck.summary.lands} · theme ${Math.round(deck.summary.themeDensity*100)}%`);

const lean=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates,settings:{themeFocus:45,ramp:"heavy",interaction:"standard",curve:"fastest",synergyBias:"efficiency",protectExistingDecks:true,commanderDependence:"normal",landStyle:"lean"}});
const safe=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates,settings:{themeFocus:90,ramp:"standard",interaction:"more",curve:"normal",synergyBias:"synergy",protectExistingDecks:true,commanderDependence:"conservative",landStyle:"safe"}});
assert.ok(safe.targets.lands>lean.targets.lands,`land style/curve/ramp should affect the derived mana base (${safe.targets.lands} vs ${lean.targets.lands})`);
assert.ok(safe.summary.themeDensity>=lean.summary.themeDensity,"higher theme focus should not reduce theme density in the same pool");

const withIllegal=[...candidates,{name:"Off-color Bomb",ownedQuantity:1,availableQuantity:1,commanderAffinity:1,themeAffinity:1,efficiencyScore:1,meta:{typeLine:"Creature — Demon",oracleText:"Win the game.",cmc:1,manaCost:"{B}",colorIdentity:["B"],legalities:{commander:"legal"}}}];
const legality=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:withIllegal,settings:{}});
assert.ok(!legality.mainboard.some(c=>c.name==="Off-color Bomb"),"off-color cards must never enter the generated deck");

const tiny=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:candidates.filter(c=>c.name==="Plains"||/^Token Maker [0-5]$/.test(c.name)),settings:{}});
assert.ok(tiny.size<100,"an insufficient collection must remain incomplete rather than invent cards");
assert.ok(tiny.shortages.some(x=>x.label==="Tamaño del mazo"),"incomplete builds must explicitly report the size shortage");
console.log(`collection builder variants: ok · lean ${lean.targets.lands} lands · safe ${safe.targets.lands} lands`);


// Basics are intentionally unlimited even if the user's collection has none. A three-color
// mana base must not become all-nonbasic, and fetches must have real basic targets.
const triCommander={typeLine:"Legendary Creature — Human Wizard",oracleText:"Whenever you cast an instant or sorcery spell, draw a card.",cmc:4,manaCost:"{1}{G}{W}{U}",colorIdentity:["G","W","U"],legalities:{commander:"legal"},ownedQuantity:1};
const tri=[];
function triAdd(name,typeLine,oracleText,cmc,manaCost,colors=["G","W","U"],extra={}){tri.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.65,themeAffinity:.62,efficiencyScore:.5,meta:{typeLine,oracleText,cmc,manaCost,colorIdentity:colors,legalities:{commander:"legal"},...extra}})}
for(let i=0;i<30;i++)triAdd(`Tri Creature ${i}`,"Creature — Wizard","When this enters, scry 1.",2+(i%4),i%3===0?"{1}{G}":i%3===1?"{1}{W}":"{1}{U}");
for(let i=0;i<16;i++)triAdd(`Tri Instant ${i}`,"Instant","Draw a card.",2,i%3===0?"{1}{G}":i%3===1?"{1}{W}":"{1}{U}");
for(let i=0;i<14;i++)triAdd(`Tri Sorcery ${i}`,"Sorcery","Draw two cards.",3,i%3===0?"{2}{G}":i%3===1?"{2}{W}":"{2}{U}");
for(let i=0;i<12;i++)triAdd(`Tri Rock ${i}`,"Artifact","{T}: Add one mana of any color.",2,"{2}",[],{producedMana:["G","W","U"]});
for(let i=0;i<10;i++)triAdd(`Tri Enchantment ${i}`,"Enchantment","Creatures you control get +1/+1.",3,"{2}{W}",["W"]);
for(let i=0;i<8;i++)triAdd(`Dual Land ${i}`,"Land","{T}: Add {G} or {W}.",0,"",[],{producedMana:["G","W"]});
for(let i=0;i<4;i++)triAdd(`Fetch Land ${i}`,"Land","{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield, then shuffle.",0,"",[],{producedMana:[]});
const triDeck=buildCollectionDeck({commander:"Tri Sage",commanderMeta:triCommander,theme:{name:"Spellslinger",slug:"spellslinger"},candidates:tri,settings:{landStyle:"balanced",curve:"normal"}});
assert.equal(triDeck.size,100,"unlimited basics should let an otherwise sufficient collection reach 100");
assert.ok(triDeck.summary.basicLands>triDeck.summary.nonbasicLands,`basics should be the majority (${triDeck.summary.basicLands} vs ${triDeck.summary.nonbasicLands})`);
assert.ok(triDeck.mainboard.some(c=>c.syntheticBasic&&c.name==="Forest"),"green basics should be injected even when absent from collection");
assert.ok(triDeck.mainboard.some(c=>c.syntheticBasic&&c.name==="Plains"),"white basics should be injected even when absent from collection");
assert.ok(triDeck.mainboard.some(c=>c.syntheticBasic&&c.name==="Island"),"blue basics should be injected even when absent from collection");
assert.ok(triDeck.mana.fetchCount<=7,"fetches should remain capped rather than crowd out basic targets");
assert.ok(Object.values(triDeck.mana.sources).some(Number),"mana source counts should be computed");
assert.ok(Number(triDeck.mana.landDropProbabilities.turn3)>0,"land-drop probability audit should be present");

// An artifact-heavy collection must not be allowed to swamp the entire spell suite when
// enough creatures/instants/sorceries/enchantments exist to build a structurally coherent deck.
const skew=[];
function skewAdd(name,typeLine,text,cmc=2,cost="{2}",themeAffinity=.5,extra={}){skew.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.6,themeAffinity,efficiencyScore:.55,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:["W"],legalities:{commander:"legal"},...extra}})}
for(let i=0;i<80;i++)skewAdd(`Artifact Bias ${i}`,"Artifact",i%2?"{T}: Add {W}.":"Draw a card.",2,"{2}",.9,{producedMana:i%2?["W"]:[]});
for(let i=0;i<30;i++)skewAdd(`Balanced Creature ${i}`,"Creature — Human","When this enters, create a token.",2,"{1}{W}",.65);
for(let i=0;i<15;i++)skewAdd(`Balanced Instant ${i}`,"Instant","Exile target creature.",2,"{1}{W}",.55);
for(let i=0;i<12;i++)skewAdd(`Balanced Sorcery ${i}`,"Sorcery","Draw two cards.",3,"{2}{W}",.55);
for(let i=0;i<10;i++)skewAdd(`Balanced Enchantment ${i}`,"Enchantment","Whenever a token enters, draw a card.",3,"{2}{W}",.6);
const skewDeck=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:skew,settings:{themeFocus:75}});
assert.ok(skewDeck.typeCounts.Artifact<=skewDeck.targets.typeProfile.caps.Artifact,`artifact cap should hold when alternatives exist (${skewDeck.typeCounts.Artifact})`);
assert.ok(skewDeck.typeCounts.Instant>=skewDeck.targets.typeProfile.floors.Instant,`instant floor should be met (${skewDeck.typeCounts.Instant})`);
assert.ok(skewDeck.typeCounts.Sorcery>=skewDeck.targets.typeProfile.floors.Sorcery,`sorcery floor should be met (${skewDeck.typeCounts.Sorcery})`);
assert.ok(skewDeck.typeCounts.Creature>=skewDeck.targets.typeProfile.floors.Creature,`creature floor should be met (${skewDeck.typeCounts.Creature})`);
console.log(`mana + type structure regression: ok · basics ${triDeck.summary.basicLands}/${triDeck.summary.lands} · skew artifacts ${skewDeck.typeCounts.Artifact}`);

// Multi-type regression: Artifact Creatures count as Creature structurally AND Artifact
// for saturation. They must not sneak past the artifact trait cap through the Creature bucket.
const hybrid=[];
function hybridAdd(name,typeLine,text,cmc=2,cost="{2}",themeAffinity=.55,extra={}){hybrid.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.58,themeAffinity,efficiencyScore:.5,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:["W"],legalities:{commander:"legal"},...extra}})}
for(let i=0;i<70;i++)hybridAdd(`Artifact Creature Flood ${i}`,"Artifact Creature — Construct",i%3===0?"When this enters, draw a card.":"Vigilance",2+(i%3),"{2}",.9);
for(let i=0;i<22;i++)hybridAdd(`Hybrid Instant ${i}`,"Instant","Exile target creature.",2,"{1}{W}",.6);
for(let i=0;i<18;i++)hybridAdd(`Hybrid Sorcery ${i}`,"Sorcery","Draw two cards.",3,"{2}{W}",.6);
for(let i=0;i<16;i++)hybridAdd(`Hybrid Enchantment ${i}`,"Enchantment — Aura","Enchant creature. Enchanted creature gets +2/+2 and has flying.",2,"{1}{W}",.72);
for(let i=0;i<18;i++)hybridAdd(`Hybrid Plain Creature ${i}`,"Creature — Human","When this enters, create a token.",2,"{1}{W}",.6);
const hybridDeck=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:hybrid,settings:{themeFocus:70}});
const artifactTrait=Number(hybridDeck.traitCounts?.Artifact||0),artifactTraitCap=Number(hybridDeck.targets.typeProfile?.traitCaps?.Artifact||99);
assert.ok(artifactTrait<=artifactTraitCap,`Artifact Creature overlap must respect artifact trait cap (${artifactTrait}/${artifactTraitCap})`);
assert.ok(hybridDeck.typeCounts.Instant>=hybridDeck.targets.typeProfile.floors.Instant,"hybrid pool must still preserve Instant floor");
assert.ok(hybridDeck.typeCounts.Sorcery>=hybridDeck.targets.typeProfile.floors.Sorcery,"hybrid pool must still preserve Sorcery floor");
assert.ok(hybridDeck.typeCounts.Enchantment>=hybridDeck.targets.typeProfile.floors.Enchantment,"hybrid pool must still preserve Enchantment floor");

// Ramp-quality regression: reliable cheap acceleration should beat conditional combat
// Treasure effects for the ramp slots when both are available.
const rampPool=[];
function rampAdd(name,typeLine,text,cmc,cost,themeAffinity=.35,extra={}){rampPool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.48,themeAffinity,efficiencyScore:.48,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:["W"],legalities:{commander:"legal"},...extra}})}
for(let i=0;i<14;i++)rampAdd(`Reliable Rock ${i}`,"Artifact","{T}: Add {W}.",2,"{2}",.25,{producedMana:["W"]});
for(let i=0;i<18;i++)rampAdd(`Combat Treasure ${i}`,"Artifact — Equipment","Whenever equipped creature deals combat damage to a player, create a Treasure token.",2,"{2}",.65);
for(let i=0;i<26;i++)rampAdd(`Ramp Creature ${i}`,"Creature — Human","When this enters, create a 1/1 token.",2,"{1}{W}",.55);
for(let i=0;i<16;i++)rampAdd(`Ramp Instant ${i}`,"Instant","Exile target creature.",2,"{1}{W}",.45);
for(let i=0;i<14;i++)rampAdd(`Ramp Sorcery ${i}`,"Sorcery","Draw two cards.",3,"{2}{W}",.45);
for(let i=0;i<12;i++)rampAdd(`Ramp Enchantment ${i}`,"Enchantment","Whenever a creature enters, draw a card.",3,"{2}{W}",.5);
const rampDeck=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:rampPool,settings:{ramp:"standard",themeFocus:55}});
const selectedReliable=rampDeck.mainboard.filter(c=>/^Reliable Rock /.test(c.name)).length;
const reliableRampSlots=rampDeck.mainboard.filter(c=>/^Reliable Rock /.test(c.name)&&c.primaryCategory==="Ramp / Fixing").length;
const conditionalRampSlots=rampDeck.mainboard.filter(c=>/^Combat Treasure /.test(c.name)&&c.primaryCategory==="Ramp / Fixing").length;
assert.ok(selectedReliable>=8,`reliable 2MV ramp should fill most ramp demand (${selectedReliable})`);
assert.ok(reliableRampSlots>=8,`reliable rocks should be recognized as strong ramp slots (${reliableRampSlots})`);
assert.equal(conditionalRampSlots,0,`conditional combat Treasure must not masquerade as a reliable ramp slot (${conditionalRampSlots})`);
console.log(`overlap + role-quality regression: ok · artifact traits ${artifactTrait}/${artifactTraitCap} · reliable ramp slots ${reliableRampSlots} · conditional ramp slots ${conditionalRampSlots}`);


// Mana-source capability regression: produced_mana is only raw capability. Conditions,
// filters, fetch timing and ETB costs must change the effective source weight.
{
  const C=["U","B","G"],land=(name,oracleText,producedMana=[])=>({name,meta:{typeLine:"Land",oracleText,producedMana}});
  const plaza=analyzeLandSource(land("Gateway Plaza","Gateway Plaza enters the battlefield tapped. When Gateway Plaza enters the battlefield, sacrifice it unless you pay {1}. {T}: Add one mana of any color.",["W","U","B","R","G"]),C);
  assert.ok(plaza.entryTax&&plaza.effectiveTapped,"Gateway Plaza must expose both ETB tempo and entry tax");
  assert.ok(plaza.sourceWeights.U<1,"entry-tax lands must not count as perfect colored sources");
  const wilds=analyzeLandSource(land("Evolving Wilds","{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle."),C);
  assert.ok(wilds.reliableFetch&&wilds.effectiveTapped&&wilds.sourceWeights.U<1,"cheap fetch-to-tapped-basic must be a real but discounted source");
  const woodland=analyzeLandSource(land("Blighted Woodland","{T}: Add {C}. {3}{G}, {T}, Sacrifice Blighted Woodland: Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.",["C"]),C);
  assert.ok(woodland.lateFetch&&woodland.utility&&woodland.sourceWeights.U<=.2,"late activated fetches must not satisfy early colored-source requirements");
  const cataracts=analyzeLandSource(land("Cascading Cataracts","Indestructible. {T}: Add {C}. {5}, {T}: Add five mana in any combination of colors.",["W","U","B","R","G"]),C);
  assert.equal(cataracts.sourceClass,"expensive-filter");
  assert.ok(cataracts.sourceWeights.U<=.2,"expensive filtering must not be a perfect colored source");
  const crater=analyzeLandSource(land("Meteor Crater","{T}: Choose a color of a permanent you control. Add one mana of that color.",["W","U","B","R","G"]),C);
  assert.ok(crater.conditional&&crater.sourceWeights.U<=.5,"board-state-dependent sources must be discounted");
}

// Voltron's primary win condition is commander combat, so generic finisher quota should
// not force unrelated closers into the list.
{
  const voltron=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Voltron",slug:"voltron"},candidates,settings:{}});
  assert.equal(voltron.targets.finishers,1,"Voltron should use a low generic-finisher quota");
  assert.ok(voltron.mana?.validation?.modelVersion===MANA_MODEL_VERSION,"build must expose mana validation model version");
  assert.ok(typeof voltron.invariants?.manaTargetMet==="boolean","build must expose mana validation as an invariant separate from deck completeness");
}

// Archetype facet regression: a subtype alone is not a strategic capability. Voltron
// attachments must attach to creatures; land/player Auras cannot fill that package.
{
  const landAura={name:"Land Aura Test",meta:{typeLine:"Enchantment — Aura",oracleText:"Enchant land. Enchanted land has '{T}: Add one mana of any color.'"},semantic:{roles:[],facts:{aura:true,auraLand:true,auraCreature:false,attachesToCreature:false}}};
  const creatureAura={name:"Creature Aura Test",meta:{typeLine:"Enchantment — Aura",oracleText:"Enchant creature. Enchanted creature gets +2/+2 and has trample."},semantic:{roles:[{id:"evasion"}],facts:{aura:true,auraLand:false,auraCreature:true,attachesToCreature:true}}};
  assert.ok(!themeFacetTags(landAura,"Voltron").includes("attachment"),"land Auras must not satisfy Voltron attachment targets");
  assert.ok(themeFacetTags(creatureAura,"Voltron").includes("attachment"),"creature Auras must satisfy Voltron attachment targets");
}

// Pure-builder availability regression: callers should not be able to bypass the
// protectExistingDecks contract by forgetting the server-side prefilter.
{
  const occupied={name:"Occupied Premium",ownedQuantity:1,availableQuantity:0,commanderAffinity:1,themeAffinity:1,efficiencyScore:1,meta:{typeLine:"Enchantment",oracleText:"Whenever a creature token enters under your control, draw a card.",cmc:1,manaCost:"{W}",colorIdentity:["W"],legalities:{commander:"legal"}}};
  const protectedDeck=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:[occupied,...candidates],settings:{protectExistingDecks:true}});
  assert.ok(!protectedDeck.mainboard.some(c=>c.name==="Occupied Premium"),"protectExistingDecks must be enforced inside the builder, not only by the server");
  assert.ok(protectedDeck.invariants.availabilityProtected,"final availability invariant must pass in protected mode");

  // With protection OFF, occupied status is informational only. Two otherwise identical
  // cards must receive the same base score regardless of availableQuantity.
  const freeTwin={...occupied,name:"Free Premium",availableQuantity:1};
  const unrestricted=buildCollectionDeck({commander:"Token Matriarch",commanderMeta,theme:{name:"Tokens",slug:"tokens"},candidates:[occupied,freeTwin,...candidates],settings:{protectExistingDecks:false}});
  const diagnostics=unrestricted.audit?.candidateDiagnostics||[];
  const occupiedDiag=diagnostics.find(c=>c.name==="Occupied Premium"),freeDiag=diagnostics.find(c=>c.name==="Free Premium");
  assert.ok(occupiedDiag&&freeDiag,"availability parity fixtures must reach candidate diagnostics");
  assert.equal(occupiedDiag.baseScore,freeDiag.baseScore,"protectExistingDecks=false must not penalize an owned card merely because another deck uses the copy");
}


// Mana source regression: a late reciprocal land-search ability is not an early fetch.
{
  const demolition={name:"Demolition Field Test",meta:{typeLine:"Land",oracleText:"{T}: Add {C}. {2}, {T}, Sacrifice Demolition Field Test: Destroy target nonbasic land an opponent controls. That land's controller may search their library for a basic land card, put it onto the battlefield, then shuffle. You may search your library for a basic land card, put it onto the battlefield, then shuffle.",producedMana:["C"]}};
  const f=analyzeLandSource(demolition,["U","B","G"]);
  assert.equal(f.sourceClass,"late-fetch","activated searches after a costed land ability must be classified as late fetches");
  assert.ok(f.fetchActivationCost>=2,"the activation cost must survive sentence boundaries inside the ability");
  assert.ok(Math.max(...Object.values(f.sourceWeights))<=.2,"late reciprocal land searches must not count as reliable early fixing");
}

// Cross-archetype regression: with the same Commander and collection, explicit Tokens,
// Clones and Ramp profiles must select meaningfully different semantic packages instead
// of collapsing onto one EDHREC/context skeleton.
{
  const ugCommander={typeLine:"Legendary Creature — Serpent",oracleText:"At the beginning of each upkeep, create a 3/3 blue Serpent creature token named Koma's Coil.",cmc:7,manaCost:"{3}{G}{G}{U}{U}",colorIdentity:["U","G"],legalities:{commander:"legal"},ownedQuantity:1};
  const pool=[];
  const addUG=(name,typeLine,oracleText,cmc,manaCost,themeAffinity=.45,extra={})=>pool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.45,themeAffinity,efficiencyScore:.5,meta:{typeLine,oracleText,cmc,manaCost,colorIdentity:["U","G"],legalities:{commander:"legal"},...extra}});
  for(let i=0;i<18;i++)addUG(`Clone Package ${i}`,"Creature — Shapeshifter","You may have this creature enter the battlefield as a copy of any creature on the battlefield.",3+(i%2),i%2?"{2}{U}{U}":"{2}{G}{U}",.36);
  for(let i=0;i<18;i++)addUG(`Token Package ${i}`,"Creature — Merfolk","When this creature enters the battlefield, create two 1/1 blue Merfolk creature tokens.",2+(i%3),"{1}{G}{U}",.36);
  for(let i=0;i<18;i++)addUG(`Ramp Package ${i}`,i%2?"Sorcery":"Creature — Druid",i%2?"Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.":"{T}: Add one mana of any color.",2,i%2?"{1}{G}":"{1}{G}",.36,i%2?{}:{producedMana:["U","G"]});
  for(let i=0;i<18;i++)addUG(`Draw Package ${i}`,"Instant","Draw two cards.",2,"{1}{U}",.34);
  for(let i=0;i<16;i++)addUG(`Interaction Package ${i}`,"Instant","Counter target spell.",2,"{U}{U}",.34);
  for(let i=0;i<18;i++)addUG(`Generic Creature ${i}`,"Creature — Beast","Vigilance.",3,"{2}{G}",.28);
  for(let i=0;i<8;i++)addUG(`Coherent Close ${i}`,"Sorcery","Creatures you control get +3/+3 and gain trample until end of turn.",5,"{3}{G}{G}",.62);
  addUG("Unrelated Lab Maniac","Creature — Human Wizard","If you would draw a card while your library has no cards in it, you win the game instead.",3,"{2}{U}",0);
  pool.push({name:"Island",ownedQuantity:99,availableQuantity:99,themeAffinity:0,commanderAffinity:.1,meta:{typeLine:"Basic Land — Island",oracleText:"{T}: Add {U}.",cmc:0,manaCost:"",colorIdentity:[],producedMana:["U"],legalities:{commander:"legal"}}});
  pool.push({name:"Forest",ownedQuantity:99,availableQuantity:99,themeAffinity:0,commanderAffinity:.1,meta:{typeLine:"Basic Land — Forest",oracleText:"{T}: Add {G}.",cmc:0,manaCost:"",colorIdentity:[],producedMana:["G"],legalities:{commander:"legal"}}});
  const settings={themeFocus:82,ramp:"standard",interaction:"standard",curve:"normal",synergyBias:"balanced",protectExistingDecks:false,commanderDependence:"normal",landStyle:"balanced"};
  const builds=Object.fromEntries(["Tokens","Clones","Ramp"].map(theme=>[theme,buildCollectionDeck({commander:"Koma Test",commanderMeta:ugCommander,theme:{name:theme,slug:theme.toLowerCase()},candidates:pool,settings})]));
  const names=b=>new Set(b.mainboard.filter(c=>!c.isCommander&&c.primaryCategory!=="Land").map(c=>c.name));
  const overlap=(a,b)=>{const A=names(a),B=names(b),same=[...A].filter(x=>B.has(x)).length;return same/Math.max(1,Math.min(A.size,B.size))};
  assert.ok([...names(builds.Tokens)].filter(x=>x.startsWith("Token Package")).length>=12,"Tokens profile should materially prefer token cards");
  assert.ok([...names(builds.Clones)].filter(x=>x.startsWith("Clone Package")).length>=12,"Clones profile should materially prefer copy cards");
  assert.ok([...names(builds.Ramp)].filter(x=>x.startsWith("Ramp Package")).length>=12,"Ramp profile should materially prefer acceleration");
  assert.ok(overlap(builds.Clones,builds.Ramp)<.82,"Clones and Ramp should not collapse onto the same nonland skeleton");
  assert.ok(!builds.Clones.mainboard.some(c=>c.name==="Unrelated Lab Maniac"&&c.selectionPhase?.includes("finishers")),"unsupported alternate-win cards must not be forced in merely to fill a generic finisher quota");
}

// User-selectable basics-first mana policy: keep the overwhelming majority of lands basic
// while still allowing a small number of genuinely useful nonbasics. This is a policy,
// not permission to ignore colored-source validation.
{
  const basicsFirst=buildCollectionDeck({commander:"Tri Sage",commanderMeta:triCommander,theme:{name:"Spellslinger",slug:"spellslinger"},candidates:tri,settings:{landStyle:"basics",curve:"normal"}});
  assert.ok(basicsFirst.summary.basicLands/basicsFirst.summary.lands>=.75,`basics-first should keep at least 75% basics in a 3-color test deck (${basicsFirst.summary.basicLands}/${basicsFirst.summary.lands})`);
  assert.ok(basicsFirst.summary.nonbasicLands<=10,`basics-first should reserve nonbasic slots for a small high-value package (${basicsFirst.summary.nonbasicLands})`);
  assert.equal(basicsFirst.settings.landStyle,"basics");
}

// Spellslinger must change the soft type targets as well as the hard floors/caps; otherwise
// the generic 23-creature desired value quietly pulls a high-theme build back toward creatures.
{
  const spellProfile=triDeck.targets.typeProfile;
  assert.ok(spellProfile.desired.Instant>spellProfile.desired.Creature,"Spellslinger should softly prefer instants over creatures");
  assert.ok(spellProfile.desired.Sorcery>=10,"Spellslinger should carry a meaningful sorcery target");
}

// Reanimator is an explicit archetype, not just a generic creature-engine label. Canonical
// recursion/graveyard semantics must be able to create theme membership without EDHREC alone.
{
  const graveCommander={...triCommander,colorIdentity:["B","G","U"],manaCost:"{3}{B}{G}{U}"};
  const gravePool=[];
  const ga=(name,typeLine,oracleText,cmc,manaCost)=>gravePool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.25,themeAffinity:0,efficiencyScore:.4,meta:{typeLine,oracleText,cmc,manaCost,colorIdentity:["B","G","U"],legalities:{commander:"legal"}}});
  for(let i=0;i<30;i++)ga(`Reanimate ${i}`,"Sorcery",`Return target creature card from your graveyard to the battlefield.`,3,"{2}{B}");
  for(let i=0;i<32;i++)ga(`Grave Creature ${i}`,"Creature — Zombie",`When this dies, mill two cards.`,2,"{1}{B}");
  for(let i=0;i<18;i++)ga(`Grave Draw ${i}`,"Instant",`Draw two cards, then discard a card.`,2,"{1}{U}");
  for(let i=0;i<12;i++)ga(`Grave Ramp ${i}`,"Sorcery",`Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.`,2,"{1}{G}");
  const reanimator=buildCollectionDeck({commander:"Grave Sage",commanderMeta:graveCommander,theme:{name:"Reanimator",slug:"reanimator"},candidates:gravePool,settings:{themeFocus:85,landStyle:"safe"}});
  assert.ok(reanimator.targets.typeProfile.themeFlags.reanimator,"Reanimator must expose an explicit archetype flag");
  assert.ok(reanimator.mainboard.some(c=>c.name.startsWith("Reanimate ")&&c.archetypeAffinity>=.8),"canonical recursion must create strong Reanimator affinity without EDHREC context");
}


// Colored-pip feedback regression: after the first mana base is built, an optional card
// with a genuinely demanding same-color pip load may be replaced by a structurally safe,
// easier-to-cast card. Normal one-pip spells should not cause indiscriminate churn.
{
  const pipCommander={typeLine:"Legendary Creature — Wizard",oracleText:"Whenever you cast a spell, scry 1.",cmc:3,manaCost:"{G}{U}{R}",colorIdentity:["G","U","R"],legalities:{commander:"legal"},ownedQuantity:1};
  const pipPool=[];
  const pa=(name,typeLine,text,cmc,cost,themeAffinity=.58,efficiency=.62,colors=["G","U","R"],extra={})=>pipPool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.6,themeAffinity,efficiencyScore:efficiency,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:colors,legalities:{commander:"legal"},...extra}});
  for(let i=0;i<36;i++)pa(`Pip Creature ${i}`,"Creature — Wizard","When this enters, draw a card.",2+(i%2),i%3===0?"{1}{G}":i%3===1?"{1}{R}":"{1}{U}",.62,.68);
  for(let i=0;i<22;i++)pa(`Pip Instant ${i}`,"Instant","Counter target spell.",2,i%2?"{1}{U}":"{1}{R}",.62,.68);
  for(let i=0;i<18;i++)pa(`Pip Sorcery ${i}`,"Sorcery","Draw two cards.",3,i%2?"{2}{G}":"{2}{R}",.62,.68);
  for(let i=0;i<14;i++)pa(`Pip Rock ${i}`,"Artifact","{T}: Add one mana of any color.",2,"{2}",.55,.65,[],{producedMana:["G","U","R"]});
  for(let i=0;i<12;i++)pa(`Pip Enchantment ${i}`,"Enchantment","Whenever you cast a creature spell, draw a card.",3,"{2}{G}",.60,.66,["G"]);
  pa("Hard Pip Close","Sorcery","Creatures you control get +3/+3 and gain trample until end of turn.",3,"{U}{U}{U}",.78,.72,["U"]);
  for(let i=0;i<8;i++)pa(`Easy Pip Close ${i}`,"Sorcery","Creatures you control get +3/+3 and gain trample until end of turn.",4,"{3}{U}",.64-i*.015,.56-i*.02,["U"]);
  const pipDeck=buildCollectionDeck({commander:"Pip Wizard",commanderMeta:pipCommander,theme:{name:"Balanced / Good Stuff",slug:"balanced"},candidates:pipPool,settings:{themeFocus:55,landStyle:"basics"}});
  assert.ok(pipDeck.mana.castabilitySwaps.some(x=>x.out==="Hard Pip Close"&&x.castabilityAfter>x.castabilityBefore),"post-build castability repair should remove a prescindible triple-pip bottleneck when a safe alternative exists");
  assert.ok(!pipDeck.mainboard.some(c=>c.name==="Hard Pip Close"),"the repaired deck must not keep the removed triple-pip bottleneck");
}

// Basics-first must remain a real mana-base policy after repair: a three-color deck keeps
// the documented high basic floor while still assigning every demanded color.
{
  const basicCommander={typeLine:"Legendary Creature — Wizard",oracleText:"Whenever you cast a spell, scry 1.",cmc:3,manaCost:"{G}{U}{R}",colorIdentity:["G","U","R"],legalities:{commander:"legal"},ownedQuantity:1};
  const pool=[];const add=(name,typeLine,text,cmc,cost,colors,producedMana=[])=>pool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.55,themeAffinity:.5,efficiencyScore:.6,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:colors,producedMana,legalities:{commander:"legal"}}});
  for(let i=0;i<45;i++)add(`Basic Creature ${i}`,"Creature — Wizard","When this enters, scry 1.",2,i%3===0?"{1}{G}":i%3===1?"{1}{U}":"{1}{R}",[i%3===0?"G":i%3===1?"U":"R"]);
  for(let i=0;i<30;i++)add(`Basic Spell ${i}`,"Instant","Draw a card.",2,i%3===0?"{1}{G}":i%3===1?"{1}{U}":"{1}{R}",[i%3===0?"G":i%3===1?"U":"R"]);
  for(let i=0;i<18;i++)add(`Clean Tri ${i}`,"Land","{T}: Add one mana of any color.",0,"",[],["G","U","R"]);
  const deck=buildCollectionDeck({commander:"Basic Wizard",commanderMeta:basicCommander,theme:{name:"Balanced / Good Stuff"},candidates:pool,settings:{landStyle:"basics"}});
  assert.ok(deck.mana.basicCount>=deck.mana.repairBasicFloor,"basics-first repair may never cross its hard basic floor");
  assert.ok(deck.mana.basicRatio>=.75,"three-color basics-first should remain overwhelmingly basic after mana repair");
  for(const c of ["G","U","R"])assert.ok(deck.mana.rawSources[c]>0,`basics-first must still assign ${c} sources`);
}

// X-cost timing regression: XBB finishers are scaling late-game spells, not BB-on-turn-2
// requirements. Fixed-cost double-pip spells keep their real on-curve timing.
{
  const xCommander={typeLine:"Legendary Creature — Wizard",oracleText:"Whenever you cast a spell, draw then discard.",cmc:4,manaCost:"{1}{U}{B}{R}",colorIdentity:["U","B","R"],legalities:{commander:"legal"},ownedQuantity:1};
  const pool=[];const add=(name,typeLine,text,cmc,cost,colors)=>pool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.6,themeAffinity:.55,efficiencyScore:.64,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:colors,legalities:{commander:"legal"}}});
  for(let i=0;i<42;i++)add(`X Creature ${i}`,"Creature — Wizard","When this enters, draw a card.",2,i%3===0?"{1}{U}":i%3===1?"{1}{B}":"{1}{R}",[i%3===0?"U":i%3===1?"B":"R"]);
  for(let i=0;i<34;i++)add(`X Spell ${i}`,"Instant","Counter target spell.",2,i%3===0?"{1}{U}":i%3===1?"{1}{B}":"{1}{R}",[i%3===0?"U":i%3===1?"B":"R"]);
  add("Scaling Drain","Sorcery","Each opponent loses X life and you gain life equal to the life lost this way.",2,"{X}{B}{B}",["B"]);
  const deck=buildCollectionDeck({commander:"X Wizard",commanderMeta:xCommander,theme:{name:"Balanced / Good Stuff"},candidates:pool,settings:{landStyle:"balanced"}});
  assert.ok(deck.mainboard.some(c=>c.name==="Scaling Drain"),"X-cost regression must actually select the scaling finisher");
  const hard=deck.mana.requirements.hardest.B;if(hard?.card==="Scaling Drain"){assert.ok(hard.turn>=6,"X finisher should use a late expected cast turn, not minimum mana value");assert.equal(hard.variableCost,true)}
}

// Quality-guard regression: fixing UU/RR pressure cannot justify downgrading a premium
// interactive spell to a materially weaker one just to maximize a single mana metric.
{
  const guardCommander={typeLine:"Legendary Creature — Wizard",oracleText:"Whenever you cast an instant or sorcery spell, scry 1.",cmc:3,manaCost:"{U}{B}{R}",colorIdentity:["U","B","R"],legalities:{commander:"legal"},ownedQuantity:1};
  const pool=[];const add=(name,typeLine,text,cmc,cost,colors,theme=.58,eff=.60,cmd=.58)=>pool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:cmd,themeAffinity:theme,efficiencyScore:eff,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:colors,legalities:{commander:"legal"}}});
  for(let i=0;i<28;i++)add(`Guard Creature ${i}`,"Creature — Wizard","When this enters, draw then discard.",2,i%3===0?"{1}{U}":i%3===1?"{1}{B}":"{1}{R}",[i%3===0?"U":i%3===1?"B":"R"]);
  for(let i=0;i<18;i++)add(`Guard Instant ${i}`,"Instant","Counter target spell unless its controller pays {2}.",2,i%3===0?"{1}{U}":i%3===1?"{1}{B}":"{1}{R}",[i%3===0?"U":i%3===1?"B":"R"],.54,.52,.52);
  for(let i=0;i<18;i++)add(`Guard Sorcery ${i}`,"Sorcery","Draw two cards, then discard a card.",3,i%2?"{2}{B}":"{2}{R}",[i%2?"B":"R"]);
  for(let i=0;i<12;i++)add(`Guard Rock ${i}`,"Artifact","{T}: Add one mana of any color.",2,"{2}",[],.5,.58,.5);
  add("Premium Counter","Instant","Counter target spell. Draw a card.",2,"{U}{U}",["U"],.96,.98,.96);
  for(let i=0;i<5;i++)add(`Weak Blue Counter ${i}`,"Instant","Counter target spell unless its controller pays {1}.",2,"{1}{U}",["U"],.30,.28,.25);
  const deck=buildCollectionDeck({commander:"Guard Wizard",commanderMeta:guardCommander,theme:{name:"Spellslinger",slug:"spellslinger"},candidates:pool,settings:{themeFocus:75,landStyle:"balanced"}});
  assert.ok(deck.mainboard.some(c=>c.name==="Premium Counter"),"premium UU interaction should survive the castability repair quality guard");
  assert.ok(!deck.mana.castabilitySwaps.some(x=>x.out==="Premium Counter"),"mana repair must not trade premium interaction for a materially weaker one");
  for(const swap of deck.mana.castabilitySwaps||[]){
    if(Number(swap.pips||0)>=3||!(swap.tacticalOut||[]).length)continue;
    assert.ok((swap.tacticalOut||[]).some(tag=>(swap.tacticalIn||[]).includes(tag)),`ordinary double-pip repair must preserve tactical function: ${swap.out} -> ${swap.in}`);
  }
}

// Commander Spellbook atomic-package regression: an exact, legal, complete package must
// enter as a unit and remain complete through later role/mana repair passes.
{
  const comboPool=[];
  const comboCommander={typeLine:"Legendary Creature — Human Wizard",oracleText:"Whenever you cast a creature spell, put a +1/+1 counter on this creature.",cmc:3,manaCost:"{G}{U}{R}",colorIdentity:["G","U","R"],legalities:{commander:"legal"},ownedQuantity:1};
  const ca=(name,typeLine,text,cmc=2,cost="{1}{G}",colors=["G","U","R"],extra={})=>comboPool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.55,themeAffinity:.35,efficiencyScore:.48,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:colors,legalities:{commander:"legal"},...extra}});
  ca("Loop Familiar","Creature — Drake","When this creature enters, return another creature you control to its owner's hand.",2,"{1}{U}",["U"]);
  ca("Cost Reducer","Artifact","Creature spells you cast cost {1} less to cast.",2,"{2}",[]);
  for(let i=0;i<34;i++)ca(`Combo Creature ${i}`,"Creature — Beast","When this enters, scry 1.",2+(i%3),i%2?"{1}{G}":"{1}{U}");
  for(let i=0;i<18;i++)ca(`Combo Instant ${i}`,"Instant","Counter target spell.",2,"{1}{U}",["U"]);
  for(let i=0;i<14;i++)ca(`Combo Sorcery ${i}`,"Sorcery","Draw two cards.",3,"{2}{U}",["U"]);
  for(let i=0;i<12;i++)ca(`Combo Rock ${i}`,"Artifact","{T}: Add one mana of any color.",2,"{2}",[],{producedMana:["G","U","R"]});
  for(let i=0;i<12;i++)ca(`Combo Enchantment ${i}`,"Enchantment","Whenever a creature enters, draw a card.",3,"{2}{G}",["G"]);
  const exactVariant={id:"spellbook-test-1",pieces:[{name:"Combo Sage",quantity:1,mustBeCommander:true},{name:"Loop Familiar",quantity:1,mustBeCommander:false},{name:"Cost Reducer",quantity:1,mustBeCommander:false}],hasTemplates:false,commanderIncluded:true,commanderPieces:["Combo Sage"],legalities:{commander:true},produces:[{name:"Infinite creature casts"}],infinite:true,popularity:50};
  const comboDeck=buildCollectionDeck({commander:"Combo Sage",commanderMeta:comboCommander,theme:{name:"Combo",slug:"combo"},candidates:comboPool,comboCandidates:[exactVariant],settings:{comboPolicy:"infinite",landStyle:"balanced",protectExistingDecks:true}});
  assert.equal(comboDeck.combo?.id,"spellbook-test-1","infinite policy should select a complete exact Spellbook package when available");
  assert.equal(comboDeck.combo?.engineVersion,2,"selected combo metadata must match combo engine v2");
  assert.ok(comboDeck.invariants.comboComplete,"selected combo must survive every later repair/swap stage intact");
  assert.equal(comboDeck.targets.finishers,1,"a selected infinite combo is the primary win condition and should reduce generic finisher pressure");
  assert.equal(comboDeck.winConditions?.infiniteCombo,1,"a complete infinite combo must count as an explicit win condition");
  assert.ok(comboDeck.winConditions?.effective>=1,"effective win conditions must include the complete infinite package");
  for(const name of ["Loop Familiar","Cost Reducer"]){const row=comboDeck.mainboard.find(c=>c.name===name);assert.ok(row,`${name} must be present`);assert.equal(row.primaryCategory,"Combo Piece");assert.match(row.selectionPhase,/^combo:spellbook-test-1$/)}
  const incomplete=buildCollectionDeck({commander:"Combo Sage",commanderMeta:comboCommander,theme:{name:"Combo",slug:"combo"},candidates:comboPool.filter(c=>c.name!=="Cost Reducer"),comboCandidates:[exactVariant],settings:{comboPolicy:"infinite",landStyle:"balanced",protectExistingDecks:true}});
  assert.equal(incomplete.combo,null,"an unavailable exact piece must prevent the combo package from being selected");
  assert.ok(incomplete.shortages.some(x=>x.label==="Combo infinito"),"missing combo availability must be reported instead of inserting a partial package");
  assert.equal(incomplete.validation.combo.required,true,"requested infinite combo must remain required even when no complete package is available");
  assert.equal(incomplete.validation.combo.selected,false,"unavailable combo must not be marked selected");
  assert.equal(incomplete.validation.combo.complete,false,"requested but unavailable combo must not be marked complete");
  assert.equal(incomplete.validation.valid,true,"strategy failure must not make an otherwise legal 100-card deck illegal");
  assert.equal(incomplete.invariants.comboComplete,false,"strategy invariant must expose the unsatisfied combo plan");
}
console.log("combo package regression: ok");

// Structural-priority regression: a soft high-theme target may not block an achievable
// structural repair, and repairing one role may never cannibalize another role that is
// already at/near its achieved floor. This models the generic failure exposed by Koma:
// a finisher repair must not remove a scarce wipe merely to protect theme density.
{
  const commander={typeLine:"Legendary Creature — Human",oracleText:"Whenever a creature enters under your control, scry 1.",cmc:4,manaCost:"{2}{W}{W}",colorIdentity:["W"],legalities:{commander:"legal"},ownedQuantity:1};
  const pool=[];const add=(name,typeLine,text,cmc,cost,theme=.92,extra={})=>pool.push({name,ownedQuantity:1,availableQuantity:1,commanderAffinity:.58,themeAffinity:theme,efficiencyScore:.55,meta:{typeLine,oracleText:text,cmc,manaCost:cost,colorIdentity:["W"],legalities:{commander:"legal"},...extra}});
  for(let i=0;i<12;i++)add(`Structure Rock ${i}`,"Artifact","{T}: Add {W}.",2,"{2}",.9,{producedMana:["W"]});
  for(let i=0;i<12;i++)add(`Structure Draw ${i}`,"Enchantment","Whenever a creature enters, draw a card.",3,"{2}{W}");
  for(let i=0;i<12;i++)add(`Structure Removal ${i}`,"Instant","Exile target creature.",2,"{1}{W}");
  for(let i=0;i<8;i++)add(`Structure Protection ${i}`,"Instant","Target creature you control gains indestructible until end of turn.",1,"{W}");
  for(let i=0;i<28;i++)add(`Structure Theme ${i}`,"Creature — Citizen","When this enters, create a 1/1 white creature token.",2+(i%3),"{1}{W}",.97);
  add("Slow Wipe A","Sorcery","Destroy all creatures.",6,"{4}{W}{W}",0);
  add("Slow Wipe B","Sorcery","Exile all creatures.",6,"{4}{W}{W}",0);
  const deck=buildCollectionDeck({commander:"Structure Commander",commanderMeta:commander,theme:{name:"Tokens",slug:"tokens"},candidates:pool,settings:{themeFocus:95,ramp:"standard",interaction:"standard",curve:"normal",landStyle:"balanced"}});
  assert.ok(deck.roleCounts.wipes>=1.1,`high Theme Focus must not veto an available second structural wipe (${deck.roleCounts.wipes})`);
  assert.ok(deck.mainboard.some(c=>c.name==="Slow Wipe A")&&deck.mainboard.some(c=>c.name==="Slow Wipe B"),"both available structural wipes should survive later role repairs");
  for(const trade of deck.audit?.structuralTradeoffs||[]){assert.ok(trade.themeDelta<0,"only real theme concessions belong in structuralTradeoffs");assert.equal(trade.reason,"structural-role-over-soft-theme");}
}
console.log("structural priority regression: ok");
