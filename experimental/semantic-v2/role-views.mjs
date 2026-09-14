import {COVERAGE} from "./schema.mjs";

export const ROLE_VIEW_VERSION=5;
export const ROLE_NAMES=["land_slot","mana_source","ramp","removal","board_wipe","protection","counterspell","recursion","graveyard_hate","card_draw","card_selection","tutor","spell_copy","cost_reduction","sacrifice_outlet","finisher"];

const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
const covWeight=s=>s===COVERAGE.SUPPORTED?1:s===COVERAGE.PARTIAL?.72:0;
const arr=x=>Array.isArray(x)?x:[];
const refKind=x=>x?.kind||null;
const logicIsTrue=x=>!x||x.op==="true";
const predicates=(expr,out=[])=>{if(!expr||typeof expr!=="object")return out;if(expr.op==="predicate")out.push(expr);if(["and","or","at_least","at_most","exactly"].includes(expr.op))for(const x of arr(expr.args))predicates(x,out);if(expr.op==="not")predicates(expr.arg,out);return out;};

function faceFor(card,cap){return arr(card.faces).find(f=>f.id===cap.faceId)||null;}
function accessFor(card,cap){return cap.access||faceFor(card,cap)?.access||{kind:"default"};}
function accessWeight(card,cap){const k=accessFor(card,cap)?.kind;return k==="default"?1:k==="alternative_entry"?.97:k==="granted"?.86:k==="conditional"?.8:k==="state_transition"?.62:.75;}
function capWeight(card,cap){return clamp(Number(cap.confidence??.5)*covWeight(cap.coverage)*accessWeight(card,cap));}
function youLike(ref){return ["you","source_controller"].includes(refKind(ref));}
function hostileLike(ref){return ["opponent","each_opponent","target_opponent","target_player","each_player","referenced_player","object_controller"].includes(refKind(ref));}
function positiveCap(cap){return ["perform","permit","modify"].includes(cap.operator);}
function candidate(card,cap,score,reason){return {capabilityId:cap.id,score:clamp(score*capWeight(card,cap)),rawScore:clamp(score),reason,action:cap.action,operator:cap.operator,access:accessFor(card,cap)?.kind||"default",coverage:cap.coverage,confidence:cap.confidence,requirements:cap.requirements,conditions:cap.conditions,conditional:!logicIsTrue(cap.requirements)||!logicIsTrue(cap.conditions),requirementPredicates:predicates(cap.requirements),conditionPredicates:predicates(cap.conditions)};}
function result(card,role,evidence=[],negative=[]){const ranked=evidence.filter(Boolean).sort((a,b)=>b.score-a.score);return {version:ROLE_VIEW_VERSION,role,adjudication:ranked.length?"positive":negative.length?"explicit_negative":"no_evidence",potentialScore:ranked[0]?.score||0,confidence:ranked.length?Math.min(1,Math.max(...ranked.map(x=>Number(x.confidence||0)))):0,evidence:ranked,negativeEvidence:negative,conditional:Boolean(ranked.some(x=>x.conditional)),requirements:ranked.flatMap(x=>x.requirementPredicates||[]),conditions:ranked.flatMap(x=>x.conditionPredicates||[])};}

function landSlot(card){const ev=[];for(const cap of arr(card.capabilities))if(cap.action==="play_as_land"&&cap.operator==="perform")ev.push(candidate(card,cap,1,"playable as a land from hand"));return result(card,"land_slot",ev);}
function manaSource(card){const ev=[];for(const cap of arr(card.capabilities))if(cap.action==="add_mana"&&cap.operator==="perform")ev.push(candidate(card,cap,.96,"produces mana"));return result(card,"mana_source",ev);}
function ramp(card){const ev=[],neg=[];for(const cap of arr(card.capabilities)){
  if(cap.action==="add_mana"&&cap.operator==="perform"){if(cap.details?.mana?.structuralAcceleration)ev.push(candidate(card,cap,cap.details?.mana?.multiplier?.98:cap.details?.mana?.sacrifice?.68:.9,"structural mana acceleration"));else neg.push({capabilityId:cap.id,reason:"mana production without structural acceleration"});}
  else if(["put_land_battlefield","additional_land"].includes(cap.action)&&positiveCap(cap))ev.push(candidate(card,cap,.94,"accelerates land development"));
  else if(cap.action==="reduce_cost"&&cap.operator==="modify"){const scope=cap.details?.costReductionScope||cap.details?.scope||null;if(scope==="self_spell")neg.push({capabilityId:cap.id,reason:"self-only discount"});else ev.push(candidate(card,cap,.82,"reduces costs of relevant spells"));}
}return result(card,"ramp",ev,neg);}
function removal(card){const ev=[],neg=[];for(const cap of arr(card.capabilities)){
  if(!["destroy","destroy_referenced","exile","exile_referenced","return","move_referenced","tuck","sacrifice"].includes(cap.action)||cap.operator!=="perform")continue;
  const own=youLike(cap.target)||youLike(cap.zones?.owner)||cap.polarity==="self_resource"||cap.polarity==="self_resource_cost";const hostile=hostileLike(cap.target)||cap.polarity==="hostile_capable"||refKind(cap.target)==="symbolic";
  if(own&&!hostile)neg.push({capabilityId:cap.id,reason:"self-resource movement"});else if(hostile||!cap.target)ev.push(candidate(card,cap,.9,"can remove an opposing resource"));
}return result(card,"removal",ev,neg);}
function boardWipe(card){const ev=[];for(const cap of arr(card.capabilities)){const strength=Number(cap.magnitude?.sweeperStrength||0);if(strength>=.72)ev.push(candidate(card,cap,strength,"broad sweeper"));}return result(card,"board_wipe",ev);}
function protection(card){const ev=[],neg=[];for(const cap of arr(card.capabilities)){
  if(["prevent_damage","redirect_damage","regenerate","phase_out"].includes(cap.action)&&positiveCap(cap))ev.push(candidate(card,cap,.9,"protective effect"));
  else if(cap.action==="grant_keyword"&&positiveCap(cap)&&arr(cap.details?.keywords).some(k=>["hexproof","indestructible","ward","protection","shroud"].includes(String(k).toLowerCase())))ev.push(candidate(card,cap,.88,"protective keyword"));
}return result(card,"protection",ev,neg);}
function counterspell(card){const ev=[];for(const cap of arr(card.capabilities))if(["counter","counter_spell","counter_ability"].includes(cap.action)&&cap.operator==="perform")ev.push(candidate(card,cap,.97,"counters spell or ability"));return result(card,"counterspell",ev);}
function recursion(card){const ev=[];for(const cap of arr(card.capabilities)){if(!["return","move_card","put","put_referenced_battlefield","cast_from_zone","play_from_graveyard","cast_from_graveyard"].includes(cap.action)||!positiveCap(cap))continue;const from=cap.zones?.source,to=cap.zones?.destination;if(from==="graveyard"&&["hand","battlefield","stack"].includes(to))ev.push(candidate(card,cap,.94,"reuses graveyard resource"));}return result(card,"recursion",ev);}
function graveyardHate(card){const ev=[];for(const cap of arr(card.capabilities)){const from=cap.zones?.source,owner=refKind(cap.zones?.owner),graveObject=String(cap.object||"").toLowerCase().includes("graveyard");if(["exile","exile_referenced","shuffle_graveyard"].includes(cap.action)&&cap.operator==="perform"&&(from==="graveyard"||graveObject)&&(hostileLike(cap.target)||["target_player","opponent","each_opponent","each_player","any"].includes(owner)||cap.polarity==="hostile_capable"))ev.push(candidate(card,cap,.9,"disrupts opposing graveyard"));}return result(card,"graveyard_hate",ev);}
function cardDraw(card){const ev=[],neg=[];for(const cap of arr(card.capabilities))if(cap.action==="draw"&&cap.operator==="perform"){if(youLike(cap.beneficiary)||youLike(cap.actor))ev.push(candidate(card,cap,cap.details?.replacementResult?.72:.92,"adds cards to controller hand"));else if(hostileLike(cap.beneficiary)||hostileLike(cap.actor))neg.push({capabilityId:cap.id,reason:"draw belongs to another player"});}return result(card,"card_draw",ev,neg);}
function cardSelection(card){const ev=[];for(const cap of arr(card.capabilities))if(["scry","surveil","look_library","reorder_library","reveal"].includes(cap.action)&&positiveCap(cap)&&!hostileLike(cap.beneficiary))ev.push(candidate(card,cap,.72,"improves card selection/information"));return result(card,"card_selection",ev);}
function tutor(card){const ev=[];for(const cap of arr(card.capabilities))if(cap.action==="search_library"&&positiveCap(cap))ev.push(candidate(card,cap,.9,"searches library"));return result(card,"tutor",ev);}
function spellCopy(card){const ev=[],neg=[];for(const cap of arr(card.capabilities))if(["copy_spell","copy"].includes(cap.action)&&cap.operator==="perform"&&["spell","self_spell","referenced_spell"].includes(String(cap.object||""))){if(youLike(cap.actor)||!cap.actor)ev.push(candidate(card,cap,.92,"copies a spell under your agency"));else neg.push({capabilityId:cap.id,reason:"copy agency belongs elsewhere"});}return result(card,"spell_copy",ev,neg);}
function costReduction(card){const ev=[];for(const cap of arr(card.capabilities))if(["reduce_cost","reduce_activation_cost"].includes(cap.action)&&cap.operator==="modify")ev.push(candidate(card,cap,.88,"reduces a cost"));return result(card,"cost_reduction",ev);}
function sacrificeOutlet(card){const ev=[],neg=[];for(const cap of arr(card.capabilities)){
  const sacrificeCosts=arr(cap.costs).filter(x=>x.operation==="sacrifice"),external=sacrificeCosts.some(x=>x.from?.kind==="controlled_permanent"),self=sacrificeCosts.some(x=>x.from?.kind==="source");
  if(cap.trigger==="activated"&&external&&!self)ev.push(candidate(card,cap,.88,"activated sacrifice of another resource"));else if(sacrificeCosts.length||cap.action==="sacrifice")neg.push({capabilityId:cap.id,reason:"self-sacrifice or non-repeatable sacrifice"});
}return result(card,"sacrifice_outlet",ev,neg);}
function finisher(card){const ev=[],neg=[];for(const cap of arr(card.capabilities)){
  if(cap.action==="win_game"&&cap.operator==="perform")ev.push(candidate(card,cap,1,"explicit win condition"));
  else if(cap.action==="lose_game"&&cap.operator==="perform"&&hostileLike(cap.target||cap.beneficiary||cap.actor))ev.push(candidate(card,cap,.98,"causes opponent to lose"));
  else if(cap.action==="extra_turn"&&cap.operator==="perform")ev.push(candidate(card,cap,.86,"extra turn closing pressure"));
  else if(["additional_combat","extra_combat"].includes(cap.action)&&cap.operator==="perform")ev.push(candidate(card,cap,.78,"additional combat closing pressure"));
  else if(cap.action==="deal_damage"&&cap.operator==="perform"){const n=Number(cap.magnitude?.amount??cap.magnitude?.damage??0),k=refKind(cap.target),playerFacing=["player","target_player","target_opponent","opponent","each_opponent","each_player","referenced_player"].includes(k)||(k==="symbolic"&&/player|opponent|any target/i.test(String(cap.target?.value||"")));if(n>=8&&playerFacing)ev.push(candidate(card,cap,.75,"large player-facing damage"));else if(n>=8)neg.push({capabilityId:cap.id,reason:"large damage confined to board objects"});}
}return result(card,"finisher",ev,neg);}

export function deriveRoleViews(card){return {
  land_slot:landSlot(card),mana_source:manaSource(card),ramp:ramp(card),removal:removal(card),board_wipe:boardWipe(card),protection:protection(card),counterspell:counterspell(card),recursion:recursion(card),graveyard_hate:graveyardHate(card),card_draw:cardDraw(card),card_selection:cardSelection(card),tutor:tutor(card),spell_copy:spellCopy(card),cost_reduction:costReduction(card),sacrifice_outlet:sacrificeOutlet(card),finisher:finisher(card)
};}
