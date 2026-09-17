import { ADJUDICATION, COVERAGE_STATUS, clamp01, uniq } from "./schema.mjs";
import { semanticFacts } from "./compiler.mjs";

export const ROLE_CONTRACT_VERSION=4;
export const ROLE_CONTRACTS=["ramp","mana_source","removal","board_wipe","protection","counterspell","recursion","graveyard_hate","card_draw","card_selection","tutor","spell_copy","cost_reduction","sacrifice_outlet","finisher"];

const topClauses=card=>semanticFacts(card,{includeEmbedded:false}).map(x=>x.fact);
const resultStatus=(card,evidence=[])=>{
  if(evidence.length){
    if(evidence.some(c=>c.status===COVERAGE_STATUS.GAP))return COVERAGE_STATUS.GAP;
    if(evidence.some(c=>c.status===COVERAGE_STATUS.PARTIAL))return COVERAGE_STATUS.PARTIAL;
    return COVERAGE_STATUS.SUPPORTED;
  }
  if(card.status===COVERAGE_STATUS.GAP)return COVERAGE_STATUS.GAP;
  if(card.status===COVERAGE_STATUS.PARTIAL)return COVERAGE_STATUS.PARTIAL;
  return COVERAGE_STATUS.SUPPORTED;
};
const result=(role,{card,positive=[],negative=[],score=0,reason=null,gaps=[]}={})=>{
  const adjudication=positive.length?ADJUDICATION.POSITIVE:negative.length?ADJUDICATION.EXPLICIT_NEGATIVE:ADJUDICATION.NO_EVIDENCE;
  const evidence=positive.length?positive:negative;
  return {
    contract:"role",contractVersion:ROLE_CONTRACT_VERSION,role,status:resultStatus(card,evidence),adjudication,
    score:adjudication===ADJUDICATION.POSITIVE?clamp01(score):0,
    confidence:evidence.length?Math.min(...evidence.map(c=>Number(c.confidence||0))):card.status===COVERAGE_STATUS.GAP?.2:.55,
    reason,dependencies:uniq(evidence.flatMap(c=>c.dependencies||[])),dependencyGroups:evidence.flatMap(c=>c.dependencyGroups||[]),
    evidence:evidence.map(c=>({action:c.action,rawText:c.rawText,actor:c.actor,target:c.target,object:c.object,owner:c.owner,beneficiary:c.beneficiary,sourceZone:c.sourceZone,destinationZone:c.destinationZone,polarity:c.polarity,trigger:c.trigger,status:c.status,magnitude:c.magnitude,activationCost:c.activationCost,details:c.details})),
    coverageGaps:uniq([...gaps,...evidence.flatMap(c=>c.unsupportedPatterns||[])])
  };
};

function ramp(card){
  const clauses=topClauses(card),positive=[],negative=[];let score=0;
  for(const c of clauses){
    if(c.action==="add_mana"){
      if(c.details?.mana?.structuralAcceleration){positive.push(c);score=Math.max(score,c.details.mana.sacrifice?.68:c.details.mana.multiplier?.96:.9);}
      else if(c.status!==COVERAGE_STATUS.GAP)negative.push(c);
    }else if(c.action==="put_land_battlefield"||c.action==="additional_land") {positive.push(c);score=Math.max(score,.94);}
    else if(c.action==="reduce_cost"){
      if(c.costReductionScope==="your_spells"){positive.push(c);score=Math.max(score,.82);} else if(c.costReductionScope==="self_spell")negative.push(c);
    }
  }
  return result("ramp",{card,positive,negative,score,reason:positive.length?"semantic acceleration":"mana/cost text is explicitly non-accelerating at deck-structure level"});
}

function manaSource(card){
  const clauses=topClauses(card),positive=clauses.filter(c=>c.action==="add_mana"&&(Number(c.details?.mana?.output||0)>0||c.details?.mana?.multiplier));
  return result("mana_source",{card,positive,score:positive.length?.95:0,reason:positive.length?"produces or multiplies mana":null});
}

function removal(card){
  const clauses=topClauses(card),positive=[],negative=[];
  for(const c of clauses){
    if(["destroy","exile","return","tuck","destroy_referenced","exile_referenced","tuck_referenced"].includes(c.action)){
      const raw=String(c.rawText||"").toLowerCase(),target=String(c.target||"").toLowerCase();
      const ownObject=c.owner==="you"||/\byou (?:own|control)\b/.test(raw)||/\byou (?:own|control)\b/.test(target)||/\byour (?:creature|permanent|artifact|enchantment|land|planeswalker)\b/.test(target);
      if((c.sourceZone==="graveyard"&&c.owner==="you")||ownObject){negative.push(c);continue;}
      if(c.polarity==="self_resource"||c.polarity==="self_resource_cost"){negative.push(c);continue;}
      if(c.polarity==="hostile_capable")positive.push(c);
    } else if(c.action==="sacrifice"&&c.polarity==="hostile_capable")positive.push(c);
  }
  return result("removal",{card,positive,negative,score:positive.length?.9:0,reason:positive.length?"hostile-capable removal of opposing/target resources":"effect is explicitly self-owned/self-resource movement"});
}

function boardWipe(card){
  const clauses=topClauses(card),mass=clauses.filter(c=>Number(c.magnitude?.sweeperStrength||0)>0),positive=mass.filter(c=>Number(c.magnitude.sweeperStrength)>=.72),negative=[];
  const score=positive.length?Math.max(...positive.map(c=>Number(c.magnitude.sweeperStrength||0))):0;
  return result("board_wipe",{card,positive,negative,score,reason:positive.length?"continuous sweeper strength clears a meaningful board share":mass.length?"mass effect is below structural wipe threshold":null});
}

function protection(card){
  const protectiveKeywords=new Set(["hexproof","indestructible","ward","protection","shroud"]);
  const clauses=topClauses(card),positive=[],negative=[];
  for(const c of clauses){
    if(["phase_out","prevent_damage","redirect_damage","regenerate"].includes(c.action))positive.push(c);
    else if(c.action==="uncounterable"){
      // A spell merely protecting itself from counters does not occupy a deck-level
      // protection slot. Effects that protect other spells/permanents still can.
      if(/^\s*this spell can(?:'t|not) be countered\b/i.test(String(c.rawText||"")))negative.push(c);else positive.push(c);
    }
    else if(c.action==="grant_keyword"&&(c.details?.keywords||[]).some(k=>protectiveKeywords.has(String(k).toLowerCase())))positive.push(c);
    else if(c.action==="targeting_restriction"&&c.polarity==="protective")positive.push(c);
  }
  return result("protection",{card,positive,negative,score:positive.length?.9:0,reason:positive.length?"protects another relevant game object/resource":negative.length?"self-only spell resilience is not deck protection":null});
}

function counterspell(card){const positive=topClauses(card).filter(c=>c.action==="counter");return result("counterspell",{card,positive,score:positive.length?.99:0,reason:positive.length?"counters spell/ability":null});}

function recursion(card){
  const clauses=topClauses(card),positive=[],negative=[];
  for(const c of clauses){
    if(c.sourceZone!=="graveyard")continue;
    if((c.owner==="you"||c.owner==="all_players"||(c.owner==="any"&&c.beneficiary==="you"))&&["hand","battlefield"].includes(c.destinationZone))positive.push(c);
    else if(c.owner==="you"&&c.destinationZone==="exile")negative.push(c);
  }
  return result("recursion",{card,positive,negative,score:positive.length?.95:0,reason:positive.length?"returns own graveyard resource":"moves own graveyard resource away from reuse"});
}

function graveyardHate(card){
  const clauses=topClauses(card),positive=[],negative=[];
  for(const c of clauses){
    if(c.action==="graveyard_hate")positive.push(c);
    else if(c.sourceZone==="graveyard"&&["exile","exile_referenced","shuffle_graveyard"].includes(c.action)){
      if(["opponent","target_player","any","all_players"].includes(c.owner))positive.push(c);
      else if(c.owner==="you")negative.push(c);
    }
  }
  return result("graveyard_hate",{card,positive,negative,score:positive.length?.92:0,reason:positive.length?"disrupts graveyard resources":negative.length?"moves only your own graveyard resources":null});
}

function cardDraw(card){
  const clauses=topClauses(card),positive=clauses.filter(c=>c.action==="draw"&&["you","source_controller"].includes(c.beneficiary)),negative=clauses.filter(c=>c.action==="draw"&&["opponent","target_player","referenced_player","object_controller"].includes(c.beneficiary));
  return result("card_draw",{card,positive,negative,score:positive.length?.92:0,reason:positive.length?"draw effect for source controller":negative.length?"draw beneficiary is another player":null});
}

function cardSelection(card){
  const positive=topClauses(card).filter(c=>["scry","surveil","look_library","reveal","reorder_library"].includes(c.action)&&!["opponent","target_player"].includes(c.beneficiary));
  return result("card_selection",{card,positive,score:positive.length?.7:0,reason:positive.length?"improves card selection without necessarily adding cards":null});
}

function tutor(card){
  const clauses=topClauses(card),positive=clauses.filter(c=>c.action==="search_library"&&["you","source_controller",null].includes(c.beneficiary));
  return result("tutor",{card,positive,score:positive.length?.9:0,reason:positive.length?"searches your library for a constrained or chosen card":null});
}

function spellCopy(card){
  const clauses=topClauses(card),copies=clauses.filter(c=>c.action==="copy_spell"),positive=copies.filter(c=>["you","source_controller"].includes(c.actor)),negative=copies.filter(c=>!["you","source_controller"].includes(c.actor));
  return result("spell_copy",{card,positive,negative,score:positive.length?.93:0,reason:positive.length?"copy agency belongs to source controller":"copy agency explicitly belongs to another player/controller"});
}

function costReduction(card){const clauses=topClauses(card),positive=clauses.filter(c=>c.action==="reduce_cost");return result("cost_reduction",{card,positive,score:positive.length?.9:0,reason:positive.length?"explicit casting cost reduction":null});}

function sacrificeOutlet(card){
  const clauses=topClauses(card),positive=[],negative=[],cardName=String(card?.name||"").toLowerCase();
  for(const c of clauses){
    const ac=c.activationCost||{},cost=String(ac.raw||"").toLowerCase(),raw=String(c.rawText||"").toLowerCase();
    const selfSac=/\bsacrifice (?:this|it)\b/.test(cost)||/\bsacrifice (?:this|it)\b/.test(raw)||(cardName&&cost.includes(`sacrifice ${cardName}`));
    const explicitOther=/\bsacrifice (?:a|an|another|one or more|any number of|x)\b/.test(cost)||/^[^:]{0,120}:\s*sacrifice (?:a|an|another|one or more|any number of|x)\b/.test(raw);
    if(c.trigger==="activated"&&ac.sacrifice&&explicitOther&&!selfSac){positive.push(c);continue;}
    if(c.trigger==="activated"&&c.action==="sacrifice"&&["you","source_controller"].includes(c.actor)&&c.polarity!=="hostile_capable"&&c.polarity!=="self_resource_cost"&&!selfSac){positive.push(c);continue;}
    if((ac.sacrifice||c.action==="sacrifice")&&(selfSac||c.polarity==="self_resource_cost"||c.trigger!=="activated"))negative.push(c);
  }
  return result("sacrifice_outlet",{card,positive,negative,score:positive.length?.88:0,reason:positive.length?"repeatable/activated sacrifice of another resource":negative.length?"self-sacrifice or one-shot cost is not a sacrifice outlet":null});
}

function finisher(card){
  const clauses=topClauses(card),positive=[],negative=[];let score=0;
  for(const c of clauses){
    if(c.action==="win_game"){positive.push(c);score=Math.max(score,1);}
    else if(c.action==="lose_game"&&["opponent","target_player","all_opponents"].includes(c.beneficiary)){positive.push(c);score=Math.max(score,.98);}
    else if(c.action==="extra_turn"){positive.push(c);score=Math.max(score,.86);}
    else if(c.action==="extra_combat"){positive.push(c);score=Math.max(score,.78);}
    else if(c.action==="deal_damage"&&Number(c.magnitude?.damage||0)>=8){
      const target=String(c.target||c.object||"").toLowerCase(),raw=String(c.rawText||"").toLowerCase();
      const hitsPlayers=/player|opponent|any target/.test(target)||/\b(?:player|opponent|any target)\b/.test(raw);
      const permanentOnly=/each creature|planeswalker|target creature|target planeswalker|permanent/.test(target)&&!hitsPlayers;
      if(hitsPlayers&&!permanentOnly){positive.push(c);score=Math.max(score,.75);}else negative.push(c);
    }
  }
  return result("finisher",{card,positive,negative,score,reason:positive.length?"semantic closing-pressure reaches players or explicitly wins":negative.length?"large damage confined to permanents is board control, not a finisher":null});
}

export function evaluateRole(card,role){
  switch(String(role||"").toLowerCase()){
    case "ramp": return ramp(card);
    case "mana_source": return manaSource(card);
    case "removal": return removal(card);
    case "board_wipe": return boardWipe(card);
    case "protection": return protection(card);
    case "counterspell": return counterspell(card);
    case "recursion": return recursion(card);
    case "graveyard_hate": return graveyardHate(card);
    case "card_draw": return cardDraw(card);
    case "card_selection": return cardSelection(card);
    case "tutor": return tutor(card);
    case "spell_copy": return spellCopy(card);
    case "cost_reduction": return costReduction(card);
    case "sacrifice_outlet": return sacrificeOutlet(card);
    case "finisher": return finisher(card);
    default:return {contract:"role",contractVersion:ROLE_CONTRACT_VERSION,role,status:COVERAGE_STATUS.GAP,adjudication:ADJUDICATION.NO_EVIDENCE,score:0,confidence:0,reason:"unsupported role contract",dependencies:[],dependencyGroups:[],evidence:[],coverageGaps:[`ROLE_CONTRACT_UNSUPPORTED:${role}`]};
  }
}

export function evaluateAllRoles(card){return Object.fromEntries(ROLE_CONTRACTS.map(role=>[role,evaluateRole(card,role)]));}
