import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {validateSemanticV2Card} from "../schema.mjs";

const compile=(raw)=>{const c=compileCardV5(raw);assert.deepEqual(validateSemanticV2Card(c),[],`${raw.name}: schema`);return c;};
const cap=(c,action,operator="perform")=>c.capabilities.filter(x=>x.action===action&&x.operator===operator);

{
  const c=compile({oracle_id:"mdfc",name:"Bloodsoaked Insight // Sanguine Morass",layout:"modal_dfc",color_identity:["B","R"],card_faces:[
    {name:"Bloodsoaked Insight",type_line:"Sorcery",mana_cost:"{5}{B/R}{B/R}",cmc:7,oracle_text:"Target opponent exiles the top three cards of their library. Until the end of your next turn, you may play those cards."},
    {name:"Sanguine Morass",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"This land enters tapped.\n{T}: Add {B} or {R}."}
  ]});
  assert.equal(c.faces[0].access.kind,"alternative_entry");assert.equal(c.faces[1].access.kind,"alternative_entry");
  assert.equal(c.optionGroups[0].id,"face-entry");assert.equal(c.optionGroups[0].policy,"exclusive");
  assert.ok(cap(c,"add_mana").length,"back land retains mana potential");
}
{
  const c=compile({oracle_id:"transform",name:"Primal Amulet // Primal Wellspring",layout:"transform",color_identity:[],card_faces:[
    {name:"Primal Amulet",type_line:"Artifact",mana_cost:"{4}",cmc:4,oracle_text:"Instant and sorcery spells you cast cost {1} less to cast.\nWhenever you cast an instant or sorcery spell, put a charge counter on this artifact. Then if there are four or more charge counters on it, you may remove those counters and transform it."},
    {name:"Primal Wellspring",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"(Transforms from Primal Amulet.)\n{T}: Add one mana of any color."}
  ]});
  assert.equal(c.faces[0].access.kind,"default");assert.equal(c.faces[1].access.kind,"state_transition");
  assert.ok(cap(c,"add_mana").length,"transformed face retains potential");
}
{
  const c=compile({oracle_id:"doom",name:"Doomsday Confluence",layout:"normal",type_line:"Sorcery",mana_cost:"{X}{X}{B}",cmc:1,oracle_text:"Choose X. You may choose the same mode more than once.\n• Each player sacrifices a nonartifact creature of their choice.\n• Create a 3/3 black Dalek artifact creature token with menace.\n• Each opponent discards a card."});
  const g=c.optionGroups.find(x=>x.id.includes("option"));assert.ok(g);assert.equal(g.policy,"repeatable");assert.equal(g.selection.symbol,"X");assert.equal(g.options.length,3);
  assert.ok(g.options.every(o=>o.capabilityIds.length>0),"all modal options link to capabilities");
}
{
  const c=compile({oracle_id:"treasure-token",name:"Treasure Maker",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{B}",cmc:4,oracle_text:"Whenever a creature an opponent controls dies, create a Treasure token."});
  const x=cap(c,"create_token")[0];assert.ok(x);assert.ok(x.details.tokenSubtypes.includes("Treasure"));assert.ok(x.details.tokenCardTypes.includes("Artifact"));
}
{
  const c=compile({oracle_id:"doombot-token",name:"Doom Bot Maker",layout:"normal",type_line:"Creature",mana_cost:"{4}{B}{B}",cmc:6,oracle_text:"When this creature enters, create two 3/3 colorless Robot Villain artifact creature tokens named Doombot."});
  const x=cap(c,"create_token")[0];assert.ok(x);assert.deepEqual(x.details.tokenCardTypes.sort(),["Artifact","Creature"]);assert.ok(x.details.tokenSubtypes.includes("Robot"));assert.ok(x.details.tokenSubtypes.includes("Villain"));assert.equal(x.details.tokenName,"Doombot");
}
{
  const c=compile({oracle_id:"dredge",name:"Stinkweed Imp",layout:"normal",type_line:"Creature — Imp",mana_cost:"{2}{B}",cmc:3,oracle_text:"Dredge 5 (If you would draw a card, you may mill five cards instead. If you do, return this card from your graveyard to your hand.)"});
  assert.equal(cap(c,"draw","perform").length,0,"replacement draw is not positive draw");
  assert.ok(cap(c,"draw","replace").length,"draw replacement is explicit");
  assert.ok(cap(c,"mill").length,"replacement result keeps mill potential");
}
{
  const c=compile({oracle_id:"jace",name:"Jace, Wielder of Mysteries",layout:"normal",type_line:"Legendary Planeswalker — Jace",mana_cost:"{1}{U}{U}{U}",cmc:4,oracle_text:"If you would draw a card while your library has no cards in it, you win the game instead.\n+1: Target player mills two cards. Draw a card.\n−8: Draw seven cards. Then if your library has no cards in it, you win the game."});
  assert.equal(cap(c,"draw","perform").length,2,"independent draw clauses remain real draw");
  assert.ok(cap(c,"draw","replace").length,"replacement relationship is also represented");
  assert.ok(cap(c,"win_game").every(x=>x.conditions.op!=="true"),"conditional win keeps condition");
}
{
  const c=compile({oracle_id:"pain",name:"The Lord of Pain",layout:"normal",type_line:"Legendary Creature",mana_cost:"{3}{B}{R}",cmc:5,oracle_text:"Your opponents can't gain life."});
  assert.equal(cap(c,"gain_life","perform").length,0);const p=cap(c,"gain_life","prohibit");assert.ok(p.length);assert.equal(p[0].actor.kind,"each_opponent");
}
{
  const c=compile({oracle_id:"barb",name:"Barbflare Gremlin",layout:"normal",type_line:"Creature — Gremlin",mana_cost:"{3}{R}",cmc:4,oracle_text:"Whenever a player taps a land for mana, if this creature is tapped, that player adds one mana of any type that land produced. Then that land deals 1 damage to that player."});
  const mana=cap(c,"add_mana")[0];assert.equal(mana.actor.kind,"referenced_player");assert.equal(mana.beneficiary.kind,"referenced_player");
  const dmg=cap(c,"deal_damage")[0];assert.equal(dmg.target.kind,"referenced_player");
}
{
  const c=compile({oracle_id:"contract",name:"Liliana's Contract",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{B}{B}",cmc:5,oracle_text:"At the beginning of your upkeep, if you control four or more Demons with different names, you win the game."});
  const w=cap(c,"win_game")[0];assert.equal(w.conditions.op,"and");assert.ok(JSON.stringify(w.conditions).includes('"count":4'));assert.ok(JSON.stringify(w.conditions).includes("distinct_names"));
}
{
  const c=compile({oracle_id:"sylex",name:"The Filigree Sylex",layout:"normal",type_line:"Legendary Artifact",mana_cost:"{2}",cmc:2,oracle_text:"{T}, Remove ten oil counters from among permanents you control and sacrifice The Filigree Sylex: It deals 10 damage to any target."});
  const d=cap(c,"deal_damage")[0];assert.ok(JSON.stringify(d.requirements).includes("available_counter_pool"));assert.ok(d.costs.some(x=>x.resource==="counter"&&x.amount===10));
}
{
  const c=compile({oracle_id:"altar",name:"Ashnod's Altar",layout:"normal",type_line:"Artifact",mana_cost:"{3}",cmc:3,oracle_text:"Sacrifice a creature: Add {C}{C}."});
  const m=cap(c,"add_mana")[0];assert.ok(m.costs.some(x=>x.from?.kind==="controlled_permanent"&&x.filter?.cardTypes?.includes("Creature")));assert.ok(!m.costs.some(x=>x.from?.kind==="source"&&x.operation==="sacrifice"),"sacrificing a creature is not self-sacrifice");
}

{
  const c=compile({oracle_id:"triome",name:"Savai Triome",layout:"normal",type_line:"Land — Mountain Plains Swamp",mana_cost:"",cmc:0,keywords:["Cycling"],oracle_text:"({T}: Add {R}, {W}, or {B}.)\nThis land enters tapped.\nCycling {3} ({3}, Discard this card: Draw a card.)"});
  assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0,"reminder text must not create phantom gaps");
  assert.equal(cap(c,"draw").length,0,"cycling reminder is not an independent draw capability");
  assert.ok(cap(c,"add_mana").length,"land mana remains represented through structured land semantics");
}
{
  const c=compile({oracle_id:"conundrum",name:"Living Conundrum",layout:"normal",type_line:"Creature — Elemental",mana_cost:"{4}{U}",cmc:5,oracle_text:"If you would draw a card while your library has no cards in it, skip that draw instead."});
  assert.equal(cap(c,"draw","perform").length,0);assert.ok(cap(c,"draw","replace").length,"skip-draw replacement is represented directly");
  assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0,"structured replacement supersedes the unparsed shell");
}
{
  const c=compile({oracle_id:"throttle",name:"Full Throttle",layout:"normal",type_line:"Sorcery",mana_cost:"{4}{R}{R}",cmc:6,oracle_text:"After this main phase, there are two additional combat phases."});
  const x=cap(c,"additional_combat")[0];assert.ok(x);assert.equal(x.magnitude.amount,2);
}
{
  const c=compile({oracle_id:"final-act",name:"Final Act",layout:"normal",type_line:"Sorcery",mana_cost:"{4}{B}{B}",cmc:6,oracle_text:"Choose one or more —\n• Each opponent loses all counters.\n• Destroy each creature with a counter on it."});
  const x=cap(c,"modify_counter","modify")[0];assert.ok(x);assert.equal(x.details.operation,"remove_all");assert.equal(x.target.kind,"each_opponent");
}
{
  const c=compile({oracle_id:"jace-ma",name:"Jace, Memory Adept",layout:"normal",type_line:"Legendary Planeswalker — Jace",mana_cost:"{3}{U}{U}",cmc:5,oracle_text:"−7: Any number of target players each draw twenty cards."});
  const x=cap(c,"draw")[0];assert.ok(x);assert.equal(x.magnitude.amount,20);assert.equal(x.beneficiary.kind,"target_players");
}
{
  const c=compile({oracle_id:"fox",name:"Mr. Foxglove",layout:"normal",type_line:"Legendary Creature — Fox Rogue",mana_cost:"{2}{G}{W}{U}",cmc:5,oracle_text:"Whenever Mr. Foxglove attacks, draw cards equal to the number of cards in defending player's hand minus the number of cards in your hand."});
  assert.ok(cap(c,"draw").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0,"period in a self-name must not leave trigger fragments as gaps");
}


{
  const c=compile({oracle_id:"cast-lock",name:"Cast Lock",layout:"normal",type_line:"Creature",mana_cost:"{2}{G}{G}",cmc:4,oracle_text:"You can't cast noncreature spells."});
  const x=cap(c,"cast_spell","prohibit")[0];assert.ok(x);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"haste-activate",name:"Activation Timing",layout:"normal",type_line:"Artifact",mana_cost:"{3}",cmc:3,oracle_text:"You may activate abilities of creatures you control as though those creatures had haste."});
  const x=cap(c,"activation_timing_permission","permit")[0];assert.ok(x);assert.equal(x.details.timing,"ignore_summoning_sickness");
}
{
  const c=compile({oracle_id:"mana-only",name:"Mana Restriction",layout:"normal",type_line:"Artifact",mana_cost:"{5}",cmc:5,oracle_text:"Spend only mana of the chosen color to activate this ability."});
  const x=cap(c,"mana_restriction","modify")[0];assert.ok(x);assert.equal(x.details.manaRestriction.kind,"spend_only");
}
{
  const c=compile({oracle_id:"win-cond",name:"Conditional Victory",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{W}",cmc:4,oracle_text:"If there are no omen counters on this enchantment, the player with the highest life total wins the game."});
  const x=cap(c,"win_game")[0];assert.ok(x);assert.notEqual(x.requirements.op,"true");assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"case-solve",name:"Case Requirement",layout:"case",type_line:"Enchantment — Case",mana_cost:"{3}{G}",cmc:4,oracle_text:"To solve — You control seven or more lands."});
  const x=cap(c,"case_solve_requirement","modify")[0];assert.ok(x);assert.equal(x.requirements.kind,"case_solve");
}
{
  const c=compile({oracle_id:"grave-keyword",name:"Grave Keyword",layout:"normal",type_line:"Creature",mana_cost:"{1}{B}{G}",cmc:3,oracle_text:"Each creature card in your graveyard has scavenge.\nThe scavenge cost is equal to its mana cost."});
  assert.ok(cap(c,"grant_keyword","modify").some(x=>x.details.keyword==="scavenge"));
  assert.ok(cap(c,"define_keyword_cost","modify").some(x=>x.details.keyword==="scavenge"));
}
{
  const c=compile({oracle_id:"keyword-standalone",name:"Standalone Keyword",layout:"normal",type_line:"Vehicle",mana_cost:"{2}",cmc:2,oracle_text:"Crew 1"});
  assert.ok(cap(c,"has_keyword").some(x=>String(x.details.keyword).toLowerCase()==="crew"));
}


{
  const c=compile({oracle_id:"tuck",name:"Mass Tuck",layout:"normal",type_line:"Sorcery",mana_cost:"{4}{W}{W}",cmc:6,oracle_text:"Put all creatures on the bottom of their owners' libraries."});
  assert.ok(cap(c,"tuck").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"zone-lock",name:"Zone Lock",layout:"normal",type_line:"Artifact",mana_cost:"{1}",cmc:1,oracle_text:"Creature cards in graveyards and libraries can't enter the battlefield."});
  const x=cap(c,"zone_entry_restriction","prohibit")[0];assert.ok(x);assert.equal(x.zones.destination,"battlefield");
}
{
  const c=compile({oracle_id:"counter-both",name:"Counter Both",layout:"normal",type_line:"Instant",mana_cost:"{2}{U}",cmc:3,oracle_text:"Counter up to four target spells and/or abilities."});
  assert.ok(cap(c,"counter_spell").length);assert.ok(cap(c,"counter_ability").length);
}
{
  const c=compile({oracle_id:"trigger-lock",name:"Trigger Lock",layout:"normal",type_line:"Creature",mana_cost:"{1}{W}{B}",cmc:3,oracle_text:"Creatures entering or dying don't cause abilities to trigger."});
  assert.ok(cap(c,"suppress_trigger","prohibit").length);
}
{
  const c=compile({oracle_id:"phase-skip",name:"Phase Skip",layout:"normal",type_line:"Sorcery",mana_cost:"{W}",cmc:1,oracle_text:"Target player skips all combat phases of their next turn."});
  const x=cap(c,"skip_phase","modify")[0];assert.ok(x);assert.equal(x.details.phase,"combat");
}
{
  const c=compile({oracle_id:"phase-add",name:"Phase Add",layout:"normal",type_line:"Enchantment",mana_cost:"{4}{U}{U}",cmc:6,oracle_text:"At the beginning of each of your postcombat main phases, there is an additional beginning phase after this phase."});
  assert.ok(cap(c,"additional_beginning_phase","modify").length);
}
{
  const c=compile({oracle_id:"phase-in-lock",name:"Phase In Lock",layout:"normal",type_line:"Creature",mana_cost:"{3}{W}",cmc:4,oracle_text:"Permanents can't phase in."});
  assert.ok(cap(c,"phase_in","prohibit").length);
}
{
  const c=compile({oracle_id:"player-control",name:"Player Control",layout:"normal",type_line:"Sorcery",mana_cost:"{4}{U}{B}",cmc:6,oracle_text:"You control target opponent during their next combat phase."});
  assert.ok(cap(c,"control_player","modify").length);
}



{
  const c=compile({oracle_id:"type-rewrite",name:"Type Rewrite",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{R}",cmc:3,oracle_text:"Nonbasic lands are Mountains."});
  const x=cap(c,"set_characteristics","modify")[0];assert.ok(x);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"color-rewrite",name:"Color Rewrite",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{B}",cmc:4,oracle_text:"All creatures are black."});
  const x=cap(c,"modify_color","modify")[0];assert.ok(x);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"grant-conspire",name:"Grant Conspire",layout:"normal",type_line:"Creature",mana_cost:"{3}{R/G}",cmc:4,oracle_text:"Each red or green instant or sorcery spell you cast has conspire."});
  assert.ok(cap(c,"grant_keyword","modify").some(x=>String(x.details.keyword).toLowerCase()==="conspire"));
  assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"populate-trigger",name:"Populate Trigger",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{G}",cmc:3,oracle_text:"Whenever you cast a spell, populate."});
  assert.ok(cap(c,"populate","perform").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"extra-counter",name:"Extra Counter",layout:"normal",type_line:"Creature",mana_cost:"{2}{G}",cmc:3,oracle_text:"Other creatures you control enter with an additional +1/+1 counter on them."});
  const x=cap(c,"modify_counter","modify").find(x=>x.details?.operation==="enters_with_additional");assert.ok(x);
}
{
  const c=compile({oracle_id:"min-cast",name:"Minimum Cast",layout:"normal",type_line:"Artifact",mana_cost:"{3}",cmc:3,oracle_text:"As long as this artifact is untapped, each spell that would cost less than three mana to cast costs three mana to cast."});
  assert.ok(cap(c,"minimum_casting_cost","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"mana-flex",name:"Mana Flex",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{G}",cmc:3,oracle_text:"Players may spend mana as though it were mana of any color."});
  assert.ok(cap(c,"mana_spending_flexibility","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"copy-limit",name:"Copy Limit",layout:"normal",type_line:"Creature",mana_cost:"{1}{B}",cmc:2,oracle_text:"A deck can have up to nine cards named Nazgûl."});
  const x=cap(c,"deck_copy_limit_override","modify")[0];assert.ok(x);assert.equal(x.details.limit,9);
}
{
  const c=compile({oracle_id:"attach-only",name:"Attach Only",layout:"normal",type_line:"Artifact — Equipment",mana_cost:"{2}",cmc:2,oracle_text:"This Equipment can be attached only to a creature with toughness 4 or greater."});
  assert.ok(cap(c,"attachment_restriction","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}



{
  const c=compile({oracle_id:"subtype-rewrite",name:"Subtype Rewrite",layout:"normal",type_line:"Creature",mana_cost:"{1}{R}",cmc:2,oracle_text:"Target creature becomes a Coward until end of turn."});
  assert.ok(cap(c,"modify_type","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"color-choice",name:"Color Choice",layout:"normal",type_line:"Creature",mana_cost:"{2}{G}",cmc:3,oracle_text:"Target creature becomes the color or colors of your choice until end of turn."});
  assert.ok(cap(c,"modify_color","modify").length);assert.equal(cap(c,"modify_type").length,0);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"keyword-have",name:"Keyword Have",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{U}",cmc:3,oracle_text:"Creatures you control have skulk."});
  assert.ok(cap(c,"grant_keyword","modify").some(x=>x.details.keyword==="skulk"));
}
{
  const c=compile({oracle_id:"energy-variable",name:"Energy Variable",layout:"saga",type_line:"Enchantment — Saga",mana_cost:"{2}{B}",cmc:3,oracle_text:"III — Pay any amount of {E}."});
  assert.ok(cap(c,"pay_variable_cost").some(x=>x.object==="energy"));
}
{
  const c=compile({oracle_id:"skip-next-combat",name:"Skip Combat",layout:"normal",type_line:"Creature",mana_cost:"{3}{W}",cmc:4,oracle_text:"When this creature enters, target opponent skips their next combat phase."});
  const x=cap(c,"skip_phase","modify")[0];assert.ok(x);assert.equal(x.details.phase,"combat");
}
{
  const c=compile({oracle_id:"life-lock",name:"Life Lock",layout:"normal",type_line:"Artifact Creature",mana_cost:"{8}",cmc:8,oracle_text:"Your life total can't change."});
  assert.ok(cap(c,"modify_life_total","prohibit").length);
}
{
  const c=compile({oracle_id:"foretell-zero",name:"Foretell Zero",layout:"normal",type_line:"Creature",mana_cost:"{2}{W}",cmc:3,oracle_text:"The first card you foretell each turn costs {0} to foretell."});
  assert.ok(cap(c,"set_keyword_cost","modify").some(x=>x.details.keyword==="foretell"));
}
{
  const c=compile({oracle_id:"pile-permission",name:"Pile Permission",layout:"normal",type_line:"Sorcery",mana_cost:"{W}{W}{U}{U}{B}{B}{R}{R}{G}{G}",cmc:10,oracle_text:"You may play lands and cast spells from one of those piles."});
  assert.ok(cap(c,"play_permission","permit").length);assert.ok(cap(c,"cast_permission","permit").length);
}
{
  const c=compile({oracle_id:"damage-keyword",name:"Damage Keyword",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{B/R}",cmc:3,oracle_text:"All damage is dealt as though its source had wither."});
  assert.ok(cap(c,"damage_keyword_override","modify").some(x=>x.details.keyword==="wither"));
}
{
  const c=compile({oracle_id:"attack-alone",name:"Attack Alone",layout:"normal",type_line:"Creature",mana_cost:"{3}{B}{R}",cmc:5,oracle_text:"This creature can only attack alone."});
  assert.ok(cap(c,"attack_restriction","modify").length);
}
{
  const c=compile({oracle_id:"control-replacement",name:"Control Replacement",layout:"normal",type_line:"Instant",mana_cost:"{3}{U}{U}{U}",cmc:6,oracle_text:"If a creature would enter the battlefield under an opponent's control this turn, it enters under your control instead."});
  assert.ok(cap(c,"gain_control","replace").length);
}
{
  const c=compile({oracle_id:"copy-stack",name:"Copy Stack",layout:"normal",type_line:"Instant",mana_cost:"{1}{U}{R}",cmc:3,oracle_text:"Copy any number of target instant and/or sorcery spells."});
  assert.ok(cap(c,"copy_spell").length);
}
{
  const c=compile({oracle_id:"combat-shadow",name:"Shadow Block",layout:"normal",type_line:"Creature",mana_cost:"{1}{W}",cmc:2,oracle_text:"This creature can block creatures with shadow as though it had shadow."});
  assert.ok(cap(c,"block_permission","permit").length);
}
{
  const c=compile({oracle_id:"crew-toughness",name:"Crew Toughness",layout:"normal",type_line:"Creature",mana_cost:"{1}{W}",cmc:2,oracle_text:"This creature crews Vehicles using its toughness rather than its power."});
  assert.ok(cap(c,"power_substitution","modify").length);
}
{
  const c=compile({oracle_id:"counter-cap",name:"Counter Cap",layout:"normal",type_line:"Creature",mana_cost:"{4}{W}{U}",cmc:6,oracle_text:"Rasputin can't have more than seven dream counters on it."});
  assert.ok(cap(c,"counter_limit","modify").length);
}



{
  const c=compile({oracle_id:"chosen-land-type",name:"Chosen Land Type",layout:"normal",type_line:"Artifact",mana_cost:"{2}",cmc:2,oracle_text:"Each land you control becomes that type until end of turn."});
  assert.ok(cap(c,"set_referenced_type","modify").length);
}
{
  const c=compile({oracle_id:"copy-abilities",name:"Alpha",layout:"normal",type_line:"Creature",mana_cost:"{3}{U}",cmc:4,oracle_text:"Alpha has all activated and triggered abilities of the last chosen card."});
  assert.ok(cap(c,"copy_abilities","modify").length);
}
{
  const c=compile({oracle_id:"skip-chosen-phase",name:"Chosen Phase",layout:"normal",type_line:"Creature",mana_cost:"{3}{U}",cmc:4,oracle_text:"The player skips each instance of the chosen step or phase this turn."});
  assert.ok(cap(c,"skip_phase","modify").some(x=>x.details.phase==="chosen"));
}
{
  const c=compile({oracle_id:"single-retarget",name:"Single Retarget",layout:"normal",type_line:"Instant",mana_cost:"{U}",cmc:1,oracle_text:"If target spell has only one target and that target is a creature, change that spell's target to another creature."});
  assert.ok(cap(c,"retarget","modify").length);
}
{
  const c=compile({oracle_id:"conditional-counter",name:"Conditional Counter",layout:"normal",type_line:"Instant",mana_cost:"{3}{W/U}",cmc:4,oracle_text:"Counter up to one target creature spell if {U} was spent to cast this spell."});
  const x=cap(c,"counter_spell")[0];assert.ok(x);assert.notEqual(x.requirements.op,"true");
}
{
  const c=compile({oracle_id:"named-attach",name:"Named Attach",layout:"normal",type_line:"Artifact — Equipment",mana_cost:"{2}",cmc:2,oracle_text:"Banner can be attached only to a legendary creature."});
  assert.ok(cap(c,"attachment_restriction","modify").length);
}
{
  const c=compile({oracle_id:"mana-double",name:"Mana Double",layout:"normal",type_line:"Artifact",mana_cost:"{2}",cmc:2,oracle_text:"{3}, {T}: Double the amount of each type of unspent mana you have."});
  assert.ok(cap(c,"modify_mana_output","modify").some(x=>x.details.factor===2));
}
{
  const c=compile({oracle_id:"foretell-formula",name:"Foretell Formula",layout:"normal",type_line:"Creature",mana_cost:"{4}{W}",cmc:5,oracle_text:"Its foretell cost is its mana cost reduced by {2}."});
  assert.ok(cap(c,"set_keyword_cost","modify").length);
}
{
  const c=compile({oracle_id:"damage-modifier",name:"Damage Modifier",layout:"normal",type_line:"Sorcery",mana_cost:"{X}{B}{B}",cmc:2,oracle_text:"Each creature gets twice -X/-X until end of turn."});
  assert.ok(cap(c,"modify_power_toughness","modify").length);
}
{
  const c=compile({oracle_id:"grave-name",name:"Grave Name",layout:"normal",type_line:"Creature",mana_cost:"{1}{G}",cmc:2,oracle_text:"If this card is in a graveyard, effects from spells named Flame Burst count it as a card named Flame Burst."});
  assert.ok(cap(c,"name_alias","modify").length);
}


// Long-tail hardening batch: modality/access/cost families must be structured,
// not merely removed from the unparsed count.
{
  const c=compile({oracle_id:"choose-up-to",name:"Call Damage Control",layout:"normal",type_line:"Instant",mana_cost:"{2}{W}",cmc:3,oracle_text:"Choose up to two. Return those cards from your graveyard to your hand.\n• Target artifact card.\n• Target creature card.\n• Target enchantment card.\n• Target land card."});
  const g=c.optionGroups[0];assert.ok(g);assert.equal(g.selection.kind,"range");assert.equal(g.selection.minimum,0);assert.equal(g.selection.maximum,2);assert.ok(g.options.every(o=>o.capabilityIds.length));assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"tiered",name:"Vincent's Limit Break",layout:"normal",type_line:"Instant",mana_cost:"{B}",cmc:1,oracle_text:"Tiered (Choose one additional cost.)\nUntil end of turn, target creature you control gains \"When this creature dies, return it to the battlefield tapped under its owner's control\" and has the chosen base power and toughness.\n• Galian Beast — {0} — 3/2.\n• Death Gigas — {1} — 5/2.\n• Hellmasker — {3} — 7/2."});
  const g=c.optionGroups[0];assert.ok(g);assert.equal(g.policy,"exclusive");assert.equal(g.options.length,3);assert.ok(g.options.every(o=>o.capabilityIds.length===2));assert.equal(cap(c,"additional_cost","modify").length,3);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"craft",name:"Craft Test",layout:"transform",type_line:"Artifact",mana_cost:"{2}",cmc:2,oracle_text:"Craft with artifact {1}{U}"});
  assert.ok(cap(c,"craft").length);assert.ok(cap(c,"additional_cost","modify").some(x=>x.details.kind==="craft"));assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"room-door",name:"Room Door",layout:"normal",type_line:"Creature",mana_cost:"{2}{U}",cmc:3,oracle_text:"{T}: Lock or unlock a door of target Room you control. Activate only as a sorcery."});
  assert.ok(cap(c,"modify_room_door","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"direct-retarget",name:"Retarget",layout:"normal",type_line:"Instant",mana_cost:"{1}{U}",cmc:2,oracle_text:"If target spell has only one target and that target is a creature, change that spell's target to another creature."});
  assert.ok(cap(c,"retarget","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"direct-energy",name:"Energy",layout:"normal",type_line:"Creature",mana_cost:"{2}{R}",cmc:3,oracle_text:"Whenever this creature deals combat damage to a creature, if that creature was dealt excess damage this turn, you get X {E}, where X is that excess damage."});
  assert.ok(cap(c,"gain_energy").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"multiple-choice",name:"Multiple Choice",layout:"normal",type_line:"Sorcery",mana_cost:"{X}{U}",cmc:1,oracle_text:"If X is 1, scry 1, then draw a card.\nIf X is 2, you may choose a player. They return a creature they control to its owner's hand.\nIf X is 3, create a 4/4 blue and red Elemental creature token.\nIf X is 4 or more, do all of the above."});
  assert.ok(cap(c,"resolve_prior_effects").length);const bounce=cap(c,"return")[0];assert.ok(bounce);assert.notEqual(bounce.conditions.op,"true");assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"roll-map",name:"Wand",layout:"normal",type_line:"Artifact",mana_cost:"{3}{R}",cmc:4,oracle_text:"{4}, {T}: Roll a d20.\n1—9 | X is one.\n10—19 | X is two.\n20 | X is three."});
  assert.equal(cap(c,"set_variable","modify").length,3);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"harness",name:"The Mind Stone",layout:"normal",type_line:"Legendary Artifact",mana_cost:"{2}{W}",cmc:3,oracle_text:"{5}{W}, {T}: Harness The Mind Stone. (Once harnessed, its ∞ ability is active.)\n∞ — At the beginning of your end step, exile up to one other target nonland permanent you control."});
  assert.ok(cap(c,"harness","modify").length);const x=cap(c,"exile")[0];assert.ok(x);assert.notEqual(x.conditions.op,"true");assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"equipment-state",name:"Dancing Sword",layout:"normal",type_line:"Artifact — Equipment",mana_cost:"{1}{W}",cmc:2,oracle_text:"When equipped creature dies, you may have this Equipment become a 2/1 Construct artifact creature with flying and ward {1}. If you do, it isn't an Equipment."});
  assert.ok(cap(c,"modify_type","modify").some(x=>x.details.subtype==="Equipment"&&x.details.operation==="remove_subtype"));assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}


{
  const c=compile({oracle_id:"effect-exception",name:"Siren Rule",layout:"normal",type_line:"Instant",mana_cost:"{U}",cmc:1,oracle_text:"Ignore this effect for each creature the player didn't control continuously since the beginning of the turn."});
  assert.ok(cap(c,"effect_exception","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"attachment-preserve",name:"Aura Preserve",layout:"normal",type_line:"Enchantment",mana_cost:"{1}{W}",cmc:2,oracle_text:"This effect doesn't remove Auras and Equipment you control that are already attached to it."});
  assert.ok(cap(c,"attachment_preservation","modify").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"stored-dice",name:"Stored Dice",layout:"normal",type_line:"Creature",mana_cost:"{2}{U}",cmc:3,oracle_text:"When this creature enters, roll five six-sided dice and store those results on it.\nAt the beginning of combat on your turn, you may reroll any number of this creature's stored results."});
  assert.ok(cap(c,"roll_dice").length);assert.ok(cap(c,"store_roll_result").length);assert.ok(cap(c,"reroll_dice","permit").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}
{
  const c=compile({oracle_id:"sticker-scope",name:"Sticker Scope",layout:"normal",type_line:"Creature",mana_cost:"{2}{R}",cmc:3,oracle_text:"When this creature enters, you may put an art sticker on a nonland permanent you own."});
  assert.ok(cap(c,"put_sticker").length);assert.equal(c.capabilities.filter(x=>x.action==="unparsed_clause").length,0);
}


// Structured trigger/package-condition regressions from Context Optimizer hardening.
{
  const c=compile({oracle_id:"token-trigger",name:"Token Payoff",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{W}",cmc:3,oracle_text:"Whenever a token enters the battlefield under your control, draw a card."});
  const x=cap(c,"draw")[0];assert.ok(x);assert.match(JSON.stringify(x.requirements),/token_created/);
}
{
  const c=compile({oracle_id:"creature-etb-trigger",name:"ETB Payoff",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{G}",cmc:3,oracle_text:"Whenever another creature enters the battlefield, you gain 1 life."});
  const x=cap(c,"gain_life")[0];assert.ok(x);assert.match(JSON.stringify(x.requirements),/card_characteristic.*creature/);
}
{
  const c=compile({oracle_id:"artifact-gate",name:"Artifact Gate",layout:"normal",type_line:"Instant",mana_cost:"{U}",cmc:1,oracle_text:"Draw a card only if you control an artifact."});
  assert.match(JSON.stringify(c.capabilities),/controlled_permanent.*Artifact/);
}
{
  const c=compile({oracle_id:"time-lord-gate",name:"Time Lord Gate",layout:"normal",type_line:"Artifact",mana_cost:"{2}",cmc:2,oracle_text:"{T}: Add {C}. Activate only if you control a Time Lord."});
  assert.match(JSON.stringify(c.capabilities),/controlled_permanent.*time lord/i);
}
{
  const c=compile({oracle_id:"bobblehead-scale",name:"Bobblehead Scale",layout:"normal",type_line:"Artifact",mana_cost:"{3}",cmc:3,oracle_text:"Draw X cards, where X is the number of Bobbleheads you control."});
  assert.match(JSON.stringify(c.capabilities),/controlled_permanent.*bobblehead/i);
}
{
  const c=compile({oracle_id:"grave-scale",name:"Grave Scale",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{B}",cmc:3,oracle_text:"Create a 2\/2 black Zombie creature token for each creature card in your graveyard."});
  const payload=JSON.stringify(c.capabilities);assert.match(payload,/zone_requirement.*your_graveyard/);assert.match(payload,/card_characteristic.*creature/);
}
{
  const c=compile({oracle_id:"commander-only",name:"Commander Reward",layout:"normal",type_line:"Enchantment",mana_cost:"{1}{W}",cmc:2,oracle_text:"At the beginning of your end step, if you control your commander, draw a card."});
  const payload=JSON.stringify(c.capabilities);assert.match(payload,/commander_state.*controlled/i);assert.doesNotMatch(payload,/controlled_permanent[^}]*subtype[^}]*your commander/i);
}



// Batch 11: package-composition conditions discovered by the Context audit.
{
  const c=compile({oracle_id:"gy-creature-scale",name:"Ghoul Scale",layout:"normal",type_line:"Instant",mana_cost:"{1}{B}",cmc:2,oracle_text:"Target creature gets +X/+X until end of turn, where X is the number of creature cards in your graveyard."});
  const x=cap(c,"modify_power_toughness")[0]||c.capabilities.find(x=>x.action==="change_characteristics");assert.ok(x);const logic=JSON.stringify(x.conditions);assert.match(logic,/zone_requirement.*your_graveyard/);assert.match(logic,/card_characteristic.*creature/);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"gy-spells-threshold",name:"Spell Threshold",layout:"normal",type_line:"Creature",mana_cost:"{1}{R}",cmc:2,oracle_text:"As long as there are two or more instant and/or sorcery cards in your graveyard, this creature gets +1/+0 and has haste."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/zone_requirement.*your_graveyard/);assert.match(logic,/card_characteristic.*instant_sorcery/);assert.match(logic,/\"count\":2/);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"delirium",name:"Delirium Test",layout:"normal",type_line:"Creature",mana_cost:"{1}{B}",cmc:2,oracle_text:"As long as there are four or more card types among cards in your graveyard, this creature gets +2/+2."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/zone_card_type_diversity/);assert.match(logic,/\"count\":4/);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"domain-scale",name:"Domain Test",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{G}",cmc:3,oracle_text:"Target creature gets +1/+1 until end of turn for each basic land type among lands you control."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/basic_land_type_diversity/);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"domain-five",name:"Domain Five",layout:"normal",type_line:"Creature",mana_cost:"{2}{G}",cmc:3,oracle_text:"If there are five basic land types among lands you control, draw a card."});
  const x=cap(c,"draw")[0];assert.ok(x);const logic=JSON.stringify(x.conditions);assert.match(logic,/basic_land_type_diversity/);assert.match(logic,/\"count\":5/);
}
{
  const c=compile({oracle_id:"zombie-threshold",name:"Zombie Threshold",layout:"normal",type_line:"Creature",mana_cost:"{2}{B}",cmc:3,oracle_text:"Activate only if there are at least three Zombie creature cards in your graveyard."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/card_characteristic.*subtype:zombie/i);assert.match(logic,/\"count\":3/);assert.doesNotMatch(logic,/raw_condition/);
}



// Batch 12: Commander-gated spells and conditional land-entry/package families.
{
  const c=compile({oracle_id:"commander-free",name:"Commander Free",layout:"normal",type_line:"Instant",mana_cost:"{3}{B}",cmc:4,oracle_text:"If you control a commander, you may cast this spell without paying its mana cost."});
  const x=cap(c,"cast_referenced_cards")[0]||cap(c,"alternate_cost")[0];assert.ok(x);assert.match(JSON.stringify(x.conditions),/commander_state.*controlled/);assert.doesNotMatch(JSON.stringify(x.conditions),/raw_condition/);
}
{
  const c=compile({oracle_id:"slow-land",name:"Slow Land",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"If you control two or more other lands, this land enters tapped.\n{T}: Add {U}."});
  const x=cap(c,"enters_tapped")[0];assert.ok(x);const logic=JSON.stringify(x.conditions);assert.match(logic,/controlled_permanent.*Land/);assert.match(logic,/\"count\":2/);assert.doesNotMatch(logic,/subtype.*other land/i);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"battle-land",name:"Battle Land",layout:"normal",type_line:"Land — Swamp Mountain",mana_cost:"",cmc:0,oracle_text:"This land enters tapped unless you control two or more basic lands.\n{T}: Add {B} or {R}."});
  const x=cap(c,"enters_tapped")[0];assert.ok(x);const logic=JSON.stringify(x.conditions);assert.match(logic,/\"op\":\"not\"/);assert.match(logic,/\"basic\":true/);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"roads-land",name:"Roads Land",layout:"normal",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"This land enters tapped unless you control a Mount or Vehicle.\n{T}: Add {U}."});
  const x=cap(c,"enters_tapped")[0];assert.ok(x);const logic=JSON.stringify(x.conditions);assert.match(logic,/subtype.*Mount/);assert.match(logic,/subtype.*Vehicle/);assert.doesNotMatch(logic,/raw_condition/);
}
{
  const c=compile({oracle_id:"rat-threshold",name:"Rat Threshold",layout:"normal",type_line:"Creature",mana_cost:"{2}{B}",cmc:3,oracle_text:"If you control five or more Rats, draw a card."});
  const x=cap(c,"draw")[0];assert.ok(x);const logic=JSON.stringify(x.conditions);assert.match(logic,/subtype.*rat/i);assert.match(logic,/\"count\":5/);
}
{
  const c=compile({oracle_id:"snow-threshold",name:"Snow Threshold",layout:"normal",type_line:"Artifact",mana_cost:"{2}",cmc:2,oracle_text:"Activate only if you control four or more snow permanents."});
  assert.match(JSON.stringify(c.capabilities),/supertype.*Snow/);assert.doesNotMatch(JSON.stringify(c.capabilities),/raw_condition/);
}



// Batch 13: referenced-card density, typal-without-fixed-subtype, and optional-cost conditions.
{
  const c=compile({oracle_id:"revealed-creature",name:"Creature Reveal",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{G}",cmc:4,oracle_text:"Reveal the top card of your library. If it's a creature card, put it onto the battlefield."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/card_characteristic.*creature/);assert.doesNotMatch(logic,/raw_condition.*creature card/);
}
{
  const c=compile({oracle_id:"shared-type",name:"Shared Type",layout:"normal",type_line:"Creature",mana_cost:"{3}{B}",cmc:4,oracle_text:"This creature gets +X/+0, where X is the greatest number of creatures you control that have a creature type in common."});
  assert.match(JSON.stringify(c.capabilities),/shared_creature_type/);
}
{
  const c=compile({oracle_id:"lair-cost",name:"Lair Cost",layout:"normal",type_line:"Land — Lair",mana_cost:"",cmc:0,oracle_text:"When this land enters, sacrifice it unless you return a non-Lair land you control to its owner's hand.\n{T}: Add {B}."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/controlled_permanent.*Land/);assert.match(logic,/\"op\":\"not\"/);assert.doesNotMatch(logic,/raw_condition.*non-Lair/i);
}
{
  const c=compile({oracle_id:"desert-gate",name:"Desert Gate",layout:"normal",type_line:"Creature",mana_cost:"{2}{U}",cmc:3,oracle_text:"As long as you control a Desert or there is a Desert card in your graveyard, this creature gets +1/+0."});
  const logic=JSON.stringify(c.capabilities);assert.match(logic,/subtype.*Desert/i);assert.match(logic,/zone_requirement.*your_graveyard/);assert.doesNotMatch(logic,/raw_condition/);
}

console.log("semantic-v2 schema/compiler tests: PASS");

// Batch 14: controlled-permanent grammar must not leak modifiers into subtype namespace.
{
  const c=compile({oracle_id:"b14-other",name:"Other Goblin Scale",layout:"normal",type_line:"Creature — Goblin",mana_cost:"{2}{R}",cmc:3,oracle_text:"This creature gets +1/+1 for each other Goblin you control."});
  const x=cap(c,"modify_power_toughness")[0];assert.ok(x);const j=JSON.stringify(x.conditions);assert.match(j,/"subtype":"goblin"/);assert.doesNotMatch(j,/other goblin/i);
}
{
  const c=compile({oracle_id:"b14-none",name:"No Goblins",layout:"normal",type_line:"Creature",mana_cost:"{2}{B}",cmc:3,oracle_text:"At the beginning of the end step, if you control no Goblins, sacrifice this creature."});
  const x=cap(c,"sacrifice")[0];assert.ok(x);const j=JSON.stringify(x.conditions);assert.match(j,/"op":"not"/);assert.match(j,/"subtype":"goblin"/);assert.doesNotMatch(j,/no goblin/i);
}
{
  const c=compile({oracle_id:"b14-zombies",name:"Zombie Scale",layout:"normal",type_line:"Creature",mana_cost:"{2}{B}",cmc:3,oracle_text:"You gain 1 life for each Zombie you control."});
  const x=cap(c,"gain_life")[0];assert.ok(x);assert.match(JSON.stringify(x.conditions),/"subtype":"zombie"/);assert.doesNotMatch(JSON.stringify(x.conditions),/zomby/i);
}
{
  const c=compile({oracle_id:"b14-state",name:"Attack State",layout:"normal",type_line:"Creature",mana_cost:"{2}{R}",cmc:3,oracle_text:"Activate only if you control an attacking modified creature."});
  const x=cap(c,"activation_restriction")[0];assert.ok(x);const j=JSON.stringify(x.conditions);assert.match(j,/"cardType":"Creature"/);assert.match(j,/"attacking":true/);assert.match(j,/"modified":true/);assert.doesNotMatch(j,/subtype/i);
}
{
  const c=compile({oracle_id:"b14-threshold",name:"Merfolk Threshold",layout:"normal",type_line:"Creature — Merfolk",mana_cost:"{1}{U}",cmc:2,oracle_text:"This creature has indestructible as long as you control at least two other Merfolk."});
  const x=cap(c,"grant_keyword")[0]||cap(c,"keyword_option")[0];assert.ok(x);const j=JSON.stringify(x.conditions);assert.match(j,/"count":2/);assert.match(j,/"subtype":"merfolk"/);assert.doesNotMatch(j,/at least two other merfolk/i);
}
{
  const c=compile({oracle_id:"b14-time-lord",name:"Test Doctor",layout:"normal",type_line:"Legendary Creature — Time Lord Doctor",mana_cost:"{2}{U}",cmc:3,oracle_text:"Vigilance"});
  assert.ok(c.faces[0].subtypes.includes("Time Lord"),"multiword printed subtype remains atomic");assert.ok(!c.faces[0].subtypes.includes("Time"));assert.ok(!c.faces[0].subtypes.includes("Lord"));
}

// Batch 15: final controlled-descriptor integrity regressions.
{
  const c=compile({oracle_id:"b15-fewer",name:"Fewer Lands",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{G}",cmc:2,oracle_text:"If you control four or fewer lands, draw a card."});
  const j=JSON.stringify(cap(c,"draw")[0]?.conditions);assert.match(j,/controlled_count_limit/);assert.match(j,/"comparison":"at_most"/);assert.doesNotMatch(j,/subtype.*or fewer/i);
}
{
  const c=compile({oracle_id:"b15-nonland",name:"Nonland Pair",layout:"normal",type_line:"Creature",mana_cost:"{3}",cmc:3,oracle_text:"When this creature enters, if you control two or more nonland, nontoken permanents with the same name as one another, draw a card."});
  const j=JSON.stringify(cap(c,"draw")[0]?.conditions);assert.match(j,/"excludedCardType":"Land"/);assert.match(j,/"token":false/);assert.doesNotMatch(j,/"subtype":"nonland"/);
}
{
  const c=compile({oracle_id:"b15-commander-plural",name:"Commander Scale",layout:"normal",type_line:"Creature",mana_cost:"{2}{W}",cmc:3,oracle_text:"This creature gets +X/+0, where X is the number of commanders you control."});
  const j=JSON.stringify(c.capabilities);assert.match(j,/commander_state/);assert.doesNotMatch(j,/"subtype":"commander"/);
}
{
  const c=compile({oracle_id:"b15-bolas",name:"Bolas Gate",layout:"normal",type_line:"Sorcery",mana_cost:"{2}{B}",cmc:3,oracle_text:"If you control a Bolas planeswalker, draw a card."});
  const j=JSON.stringify(cap(c,"draw")[0]?.conditions);assert.match(j,/"subtype":"bolas"/);assert.doesNotMatch(j,/"subtype":"bola"/);
}
{
  const c=compile({oracle_id:"b15-eldrazi-spawn",name:"Spawn Gate",layout:"normal",type_line:"Sorcery",mana_cost:"{1}{R}",cmc:2,oracle_text:"If you control an Eldrazi Spawn, draw a card."});
  const j=JSON.stringify(cap(c,"draw")[0]?.conditions);assert.match(j,/"subtype":"Eldrazi"/);assert.match(j,/"subtype":"Spawn"/);assert.doesNotMatch(j,/"subtype":"eldrazi spawn"/i);
}
{
  const c=compile({oracle_id:"b15-self-name",name:"Hivis of the Scale",layout:"normal",type_line:"Creature — Human",mana_cost:"{3}{R}",cmc:4,oracle_text:"Gain control of target Dragon for as long as you control Hivis and Hivis remains tapped."});
  const j=JSON.stringify(c.capabilities);assert.match(j,/source_state/);assert.doesNotMatch(j,/"subtype":"hivis"/);
}
{
  const c=compile({oracle_id:"b17-plurals",name:"Plural Types",layout:"normal",type_line:"Enchantment",mana_cost:"{2}{W}",cmc:3,oracle_text:"As long as you control Auras and Ninjas, prevent all damage that would be dealt to you."});
  const j=JSON.stringify(c.capabilities);assert.match(j,/"subtype":"aura"/);assert.match(j,/"subtype":"ninja"/);assert.doesNotMatch(j,/"subtype":"auras"|"subtype":"ninjas"/);
}
