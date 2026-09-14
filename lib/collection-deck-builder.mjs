// ManaShelf LAB 2 — collection-first Commander deck builder.
// Experimental by design: deterministic, auditable heuristics; no LLM deck construction.
// v8: authoritative Scryfall legality/color identity arrives before this module; here we
// compose canonical card semantics, archetype profiles, Commander/context evidence,
// role quality, support dependencies, curve, mana, structural diversity and diminishing
// returns. EDHREC is contextual/ranking evidence, not the definition of an archetype.

import { applySemanticClassification, buildDeckMetrics, inferProducedMana, parseManaCost, deriveManaAccelerationFacts } from "./deck-metrics.mjs";
import { cardIdentityKey } from "./card-identity.mjs";
import { availableComboPackages, comboPackageBaseScore, normalizeComboPolicy, COMBO_ENGINE_VERSION } from "./combo-engine.mjs";
import { themeFlags, archetypeKind, themeEvidence, themeDependencyBaseline, archetypeDependencyGroups } from "./archetype-contracts.mjs";

export const COLLECTION_BUILDER_VERSION = 14;
export const MANA_MODEL_VERSION = 5;

const COLORS=["W","U","B","R","G"];
const BASIC_BY_COLOR={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest",C:"Wastes"};
const BASIC_TYPE_BY_COLOR={W:"Basic Land — Plains",U:"Basic Land — Island",B:"Basic Land — Swamp",R:"Basic Land — Mountain",G:"Basic Land — Forest",C:"Basic Land"};
const BASIC_NAMES=new Set(["plains","island","swamp","mountain","forest","wastes","snow-covered plains","snow-covered island","snow-covered swamp","snow-covered mountain","snow-covered forest"]);
const TYPE_KEYS=["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle","Other"];
const TRAIT_KEYS=["Artifact","Enchantment","Equipment","Aura"];
const ROLE_KEYS=["ramp","resources","interaction","wipes","resilience","finishers"];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const round=(n,d=2)=>Number((Number(n)||0).toFixed(d));
const key=cardIdentityKey;
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const metaOf=c=>c?.meta||{};
const typeOf=c=>String(metaOf(c).typeLine||c?.typeLine||"");
const textOf=c=>String(metaOf(c).oracleText||c?.oracleText||"");
const cmcOf=c=>Number(metaOf(c).cmc??c?.cmc??0)||0;
const manaCostOf=c=>String(metaOf(c).manaCost??c?.manaCost??"");
const roleIds=c=>(c?.semantic?.roles||[]).map(r=>r?.id||r);
const hasRole=(c,r)=>roleIds(c).includes(r);
const isLand=c=>/\bland\b/i.test(typeOf(c).split("//")[0]);
const isBasic=c=>/\bbasic land\b/i.test(typeOf(c))||BASIC_NAMES.has(key(c?.name));
const allowsMultiple=c=>isBasic(c)||/a deck can have any number of cards named|a deck can have up to (?:nine|\d+) cards named/i.test(textOf(c));
const colorSubset=(cardColors,commanderColors)=>{const allowed=new Set(commanderColors||[]);return (cardColors||[]).every(c=>allowed.has(c))};

function normalizedSettings(input={}){
  return {
    themeFocus:Math.max(0,Math.min(100,Number(input.themeFocus??72))),
    ramp:["standard","more","heavy"].includes(input.ramp)?input.ramp:"standard",
    interaction:["standard","more"].includes(input.interaction)?input.interaction:"standard",
    curve:["normal","lower","fastest"].includes(input.curve)?input.curve:"normal",
    synergyBias:["synergy","balanced","efficiency"].includes(input.synergyBias)?input.synergyBias:"balanced",
    protectExistingDecks:input.protectExistingDecks!==false,
    commanderDependence:["conservative","normal","all-in"].includes(input.commanderDependence)?input.commanderDependence:"normal",
    comboPolicy:normalizeComboPolicy(input.comboPolicy),
    landStyle:["basics","safe","balanced","lean"].includes(input.landStyle)?input.landStyle:"balanced"
  };
}

function contextThemeAffinity(card){return clamp(card?.contextThemeAffinity??card?.themeAffinity??0)}

function typeBucket(card){
  const t=typeOf(card);
  // Exclusive structural bucket. Overlapping characteristics live in cardTraits().
  for(const x of ["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle"])if(new RegExp(`\\b${x}\\b`,`i`).test(t))return x;
  return "Other";
}
function cardTraits(card){
  const t=typeOf(card),out=[];
  for(const x of TRAIT_KEYS)if(new RegExp(`\\b${x}\\b`,`i`).test(t))out.push(x);
  return out;
}

function typeStructureProfile(themeName,nonlandSlots){
  const f=themeFlags(themeName);
  const floors={Creature:16,Instant:6,Sorcery:5,Artifact:5,Enchantment:4,Planeswalker:0,Battle:0,Other:0};
  const caps={Creature:32,Instant:18,Sorcery:16,Artifact:18,Enchantment:16,Planeswalker:6,Battle:4,Other:8};
  const desired={Creature:23,Instant:9,Sorcery:8,Artifact:10,Enchantment:7,Planeswalker:0,Battle:0,Other:3};
  const traitCaps={Artifact:24,Enchantment:22,Equipment:16,Aura:16};
  if(f.voltron){
    Object.assign(floors,{Creature:12,Instant:8,Sorcery:5,Artifact:8,Enchantment:7});
    Object.assign(caps,{Creature:26,Instant:20,Sorcery:15,Artifact:20,Enchantment:20,Planeswalker:3});
    // Voltron should normally devote substantial space to protection/evasion/auras/equipment,
    // not default to a creature pile. These are soft targets, not quotas.
    Object.assign(desired,{Creature:15,Instant:11,Sorcery:7,Artifact:14,Enchantment:11,Planeswalker:0,Battle:0,Other:2});
    Object.assign(traitCaps,{Artifact:22,Enchantment:22,Equipment:15,Aura:15});
  }else{
    if(f.artifacts){Object.assign(floors,{Creature:13,Instant:5,Sorcery:4,Artifact:14,Enchantment:3});Object.assign(caps,{Creature:30,Artifact:28,Instant:18,Sorcery:15});traitCaps.Artifact=34}
    if(f.spells){Object.assign(floors,{Creature:9,Instant:11,Sorcery:9,Artifact:4,Enchantment:3});Object.assign(caps,{Creature:22,Instant:25,Sorcery:22,Artifact:14,Enchantment:12});Object.assign(desired,{Creature:14,Instant:16,Sorcery:13,Artifact:8,Enchantment:6,Planeswalker:0,Battle:0,Other:3})}
    if(f.enchantments){Object.assign(floors,{Creature:13,Instant:5,Sorcery:4,Artifact:3,Enchantment:14});Object.assign(caps,{Creature:28,Enchantment:28,Artifact:12});traitCaps.Enchantment=34}
    if(f.creatures){floors.Creature=23;caps.Creature=38;floors.Instant=5;floors.Sorcery=4}
    if(f.creatureEngine){floors.Creature=Math.max(floors.Creature,19);caps.Creature=Math.max(caps.Creature,34)}
    if(f.reanimator){Object.assign(floors,{Creature:20,Instant:6,Sorcery:8,Artifact:4,Enchantment:4});Object.assign(caps,{Creature:36,Instant:16,Sorcery:18,Artifact:16,Enchantment:16});Object.assign(desired,{Creature:26,Instant:7,Sorcery:10,Artifact:7,Enchantment:7,Planeswalker:0,Battle:0,Other:3})}
  }
  const floorTotal=Object.values(floors).reduce((n,x)=>n+x,0);
  if(floorTotal>nonlandSlots*.72){const factor=(nonlandSlots*.72)/floorTotal;for(const k of TYPE_KEYS)floors[k]=Math.floor((floors[k]||0)*factor)}
  return {floors,caps,desired,traitCaps,themeFlags:f};
}

function targetProfile(commanderMeta,settings,themeName=""){
  const commanderCmc=Number(commanderMeta?.cmc||0),tf=themeFlags(themeName);
  let lands=38;
  if(commanderCmc>=5)lands++;
  if(commanderCmc>=7)lands++;
  if(tf.lands)lands+=2;
  if(settings.curve==="lower")lands--;
  if(settings.curve==="fastest")lands--;
  if(settings.landStyle==="safe")lands++;
  if(settings.landStyle==="lean")lands--;
  lands=Math.round(Math.max(35,Math.min(41,lands)));
  let ramp=settings.ramp==="heavy"?14:settings.ramp==="more"?12:10;
  if(commanderCmc>=6)ramp++;
  const interaction=settings.interaction==="more"?13:10;
  const resources=settings.curve==="fastest"?11:10;
  const wipes=settings.interaction==="more"?3:2;
  let resilience=settings.commanderDependence==="conservative"?6:settings.commanderDependence==="all-in"?3:4;
  let finishers=settings.curve==="fastest"?3:2;
  if(tf.voltron){resilience=Math.max(resilience,7);finishers=1}
  const nonlands=99-lands;
  const theme=Math.round(Math.max(15,Math.min(nonlands-12,18+(settings.themeFocus/100)*20)));
  return {lands,ramp,resources,interaction,wipes,resilience,finishers,theme,nonlands,typeProfile:typeStructureProfile(themeName,nonlands)};
}

function rawRoleFlags(card){
  const ids=roleIds(card),has=(...xs)=>xs.some(x=>ids.includes(x)),t=textOf(card).toLowerCase();
  // Cost reduction is only generic ramp when it reduces casting costs. Equip/activation
  // discounts are theme efficiency, not mana acceleration for the deck's ramp quota.
  const spellReduction=has("cost_reduction")&&/(?:spells? you cast[^.]{0,70}cost|costs? [^.]{0,45}less to cast|affinity for|convoke)/.test(t)&&!/equip(?:ped)?|activated abilit/.test(t);
  const pureRampTutor=has("ramp")&&has("tutor")&&!has("card_draw","card_selection","impulse_draw","card_advantage","recursion");
  return {
    ramp:has("ramp")||spellReduction,
    // Do not double-count a land-to-battlefield ramp spell as generic card resources just
    // because the semantic parser also calls it a tutor.
    resources:has("card_draw","card_selection","impulse_draw","card_advantage","recursion")||(has("tutor")&&!pureRampTutor),
    interaction:has("removal","counterspell","board_wipe","mass_removal","partial_sweeper","graveyard_hate","artifact_removal","enchantment_removal","creature_removal","planeswalker_removal","land_interaction"),
    wipes:has("board_wipe"),
    resilience:has("protection","recursion"),
    finishers:has("finisher")
  };
}
function edhrecPower(card){
  const ti=clamp(card.edhrecThemeInclusion??0),ts=clamp(Math.max(0,Number(card.edhrecThemeSynergy||0))),bi=clamp(card.edhrecBaseInclusion??0),bs=clamp(Math.max(0,Number(card.edhrecBaseSynergy||0)));
  return clamp(.5*ti+.22*ts+.18*bi+.10*bs);
}
function rampQuality(card){
  const raw=rawRoleFlags(card);if(!raw.ramp)return 0;
  const t=textOf(card).toLowerCase(),functional=t.replace(/\([^()]{0,320}\)/g," "),mv=cmcOf(card),ids=roleIds(card),mf=card?.semantic?.facts?.mana||deriveManaAccelerationFacts(card);
  let q=0;
  if(ids.includes("cost_reduction")){
    const castingReduction=/(?:spells? you cast[^.]{0,70}cost|costs? [^.]{0,45}less to cast|affinity for|convoke)/.test(functional)&&!/equip(?:ped)?|activated abilit/.test(functional);
    if(castingReduction){
      let r=mv<=2?.72:mv===3?.60:.42;
      const reqs=card?.semantic?.facts?.costReductionRequirements||[];
      if(reqs.length){
        let breadth=1;
        for(const req of reqs){
          if(req.ownership==="not_owned")breadth=Math.min(breadth,.30);
          for(const scope of req.scopes||[]){
            if(scope==="instant_sorcery")breadth=Math.min(breadth,.96);
            else if(scope==="noncreature")breadth=Math.min(breadth,.88);
            else if(scope==="any")breadth=Math.min(breadth,1);
            else if(scope==="creature")breadth=Math.min(breadth,.68);
            else if(scope==="artifact"||scope==="enchantment"||scope==="historic"||scope==="legendary"||scope==="commander")breadth=Math.min(breadth,.58);
            else if(scope.startsWith("subtype:"))breadth=Math.min(breadth,.42);
          }
          if((req.colors||[]).length)breadth*=.58;
        }
        r*=breadth;
      }else if(/you don(?:'|’)t own|from exile|commander spells?|specific type|chosen type/.test(functional))r*=.45;
      q=Math.max(q,r);
    }
  }
  if(mf.landRamp)q=Math.max(q,mv<=2?.96:mv===3?.80:mv===4?.60:.42);
  if(mf.additionalLand)q=Math.max(q,mv<=2?.78:mv===3?.66:.48);
  if(mf.repeatablePositiveActivation){
    const best=Math.max(1,Number(mf.bestActivatedNet||1));
    let r=mv<=1?.98:mv===2?.93:mv===3?.72:mv===4?.48:.30;
    if(best>=2)r=Math.min(1,r+.05);
    if((mf.activated||[]).some(x=>x.requiresOtherTap))r*=.62;
    q=Math.max(q,r);
  }
  if(mf.oneShotPositiveActivation)q=Math.max(q,mv<=1?.68:mv===2?.48:.32);
  if(Number(mf.ritualNet||0)>0){let r=mv<=1?.76:mv===2?.66:mv===3?.48:.34;if(Number(mf.ritualNet||0)>=2)r+=.06;q=Math.max(q,r)}
  if(mf.treasureRepeatable||mf.triggeredMana){
    const deps=mf.dependencies||[mf.dependency].filter(Boolean);let r=.42;
    if(deps.includes("ownership:not_owned"))r=.22;
    else if(deps.includes("spell:instant_sorcery"))r=.74;
    else if(deps.includes("spell:noncreature"))r=.66;
    else if(deps.includes("spell:any"))r=.56;
    else if(deps.some(x=>["spell:artifact","spell:enchantment","spell:historic","spell:legendary","artifacts","enchantments","lands"].includes(x)))r=.50;
    else if(deps.includes("spell:creature")||deps.includes("creatures"))r=.46;
    else if(deps.some(x=>String(x).startsWith("spell:subtype:")))r=.34;
    else if(deps.includes("combat"))r=.36;else if(deps.includes("opponent_actions"))r=.30;else if(deps.includes("external_events"))r=.34;
    if(mv>=4)r-=.08;if(mv>=5)r-=.08;q=Math.max(q,r);
  }
  if(mf.treasureVariable&&!mf.treasureRepeatable){let r=(mf.dependencies||[]).includes("ownership:not_owned")?.28:mf.dependency==="opponent_actions"?.46:.54;if(mv>=4)r-=.10;q=Math.max(q,r)}
  if(mf.treasureOneShot&&!mf.treasureRepeatable&&!mf.treasureVariable&&Number(mf.treasureCount||0)>=2)q=Math.max(q,mv<=2?.50:mv===3?.42:.28);
  // A one-Treasure cantrip/resource spell and a mana-neutral filter are useful, but neither
  // is acceleration. Keeping them at zero prevents structural ramp quotas from being filled
  // by cards whose mana output merely refunds part of their own cost.
  q+=edhrecPower(card)*.10;
  return clamp(q);
}
function resourceQuality(card){
  const raw=rawRoleFlags(card);if(!raw.resources)return 0;
  const t=textOf(card).toLowerCase(),mv=cmcOf(card);let q=mv<=2?.72:mv===3?.68:mv===4?.55:.42;
  if(/draw (?:two|three|four|x|\d+) cards/.test(t)||/whenever [^.]{0,90}(?:draw a card|you may draw)/.test(t))q+=.18;
  if(/draw a card/.test(t)&&!/whenever|at the beginning|each/.test(t))q-=.08;
  if(/search your library for (?:a|an) [^.]{0,70} card/.test(t))q+=.13;
  if(/return [^.]{0,80} from your graveyard/.test(t))q+=.08;
  q+=edhrecPower(card)*.12;return clamp(q);
}
function interactionQuality(card){
  const raw=rawRoleFlags(card);if(!raw.interaction)return 0;
  const t=textOf(card).toLowerCase(),ids=roleIds(card),mv=cmcOf(card);let q=mv<=1?.93:mv===2?.88:mv===3?.74:mv===4?.58:.40;
  if(ids.includes("partial_sweeper")){
    if(/each creature with flying|creatures? with flying/.test(t))q=Math.min(q,.34);
    else if(/mana value \d+ or less|power \d+ or less|toughness \d+ or less/.test(t))q=Math.min(q,.62);
    else q=Math.min(q,.58);
  }
  if(/counter target [^.]{0,45}spell/.test(t)||/exile target (?:nonland )?permanent/.test(t)||/destroy target (?:nonland )?permanent/.test(t))q+=.08;
  if(/only if|unless its controller pays|with mana value|power .* or less/.test(t))q-=.10;
  q+=edhrecPower(card)*.10;return clamp(q);
}
function wipeQuality(card){
  if(!rawRoleFlags(card).wipes)return 0;
  const t=textOf(card).toLowerCase(),mv=cmcOf(card);let q=mv<=4?.9:mv===5?.75:.58;
  if(/saga/.test(typeOf(card).toLowerCase())||/\ni{1,3} —|\ni{1,3} —/.test(t))q*=.78;
  q+=edhrecPower(card)*.08;return clamp(q);
}
function roleQuality(card,role){
  const raw=rawRoleFlags(card);if(!raw[role])return 0;
  if(role==="ramp")return rampQuality(card);
  if(role==="resources")return resourceQuality(card);
  if(role==="interaction")return interactionQuality(card);
  if(role==="wipes")return wipeQuality(card);
  if(role==="resilience")return clamp((cmcOf(card)<=2?.88:cmcOf(card)<=4?.70:.52)+edhrecPower(card)*.10);
  if(role==="finishers"){
    const a=clamp(card.archetypeAffinity??0),ctx=contextThemeAffinity(card),cmd=clamp(card.commanderAffinity??0),deps=card?.semantic?.dependencies||[];
    let q=.27+a*.38+Math.min(.75,ctx)*.11+cmd*.08+edhrecPower(card)*.16;
    const t=textOf(card).toLowerCase().replace(/\([^()]{0,320}\)/g," ");
    if(/extra combat|additional combat|double .*power|double .*damage|triple .*damage|creatures you control[^.]{0,120}get \+[x0-9*]+\/\+[x0-9*]+[^.]{0,100}(?:trample|flying|menace|double strike)/.test(t))q+=.15;
    if(deps.includes("library_empty")||deps.includes("varied_mana_values"))q*=a>=.45||ctx>=.55?.82:.42;
    if(a<.18&&ctx<.20&&cmd<.25&&edhrecPower(card)<.18)q*=.55;
    return clamp(q);
  }
  return 0;
}
function roleContribution(card,role){const q=roleQuality(card,role);return q>=.82?1:q>=.66?.82:q>=.50?.58:q>=.38?.30:0}
function roleFlags(card){const raw=rawRoleFlags(card),out={};for(const k of ROLE_KEYS)out[k]=raw[k]&&roleContribution(card,k)>0;return out}
function functionalDensity(card){const meaningful=roleIds(card).filter(r=>!["land","mana_source","threat","payoff"].includes(r));return clamp((new Set(meaningful).size)/3,0,1)}
function curveFit(card,settings){const mv=cmcOf(card);if(settings.curve==="fastest")return mv<=2?1:mv===3?.82:mv===4?.55:mv===5?.25:.05;if(settings.curve==="lower")return mv<=2?.95:mv===3?1:mv===4?.8:mv===5?.48:.2;return mv<=2?.82:mv<=4?1:mv===5?.78:mv===6?.52:.3}
function manaFit(card,commanderColors){const p=parseManaCost(manaCostOf(card));if(!p.coloredPips)return 1;const distinct=p.colors.length,stress=p.coloredPips+Math.max(0,distinct-1)*.55,colorCount=Math.max(1,(commanderColors||[]).length),mv=Math.max(1,cmcOf(card)),maxPip=Math.max(...COLORS.map(c=>Number(p.pips[c]||0)));let fit=1-(stress-1)*(.10+.035*Math.max(0,colorCount-2));if(colorCount>=3&&maxPip>=2&&mv<=2)fit-=.16;if(colorCount>=3&&maxPip>=3&&mv<=4)fit-=.10;return clamp(fit,.30,1)}
function dependencyPenalty(card,settings){const deps=card.semantic?.globalDependencies||[];let p=0;if(deps.includes("commander"))p+=settings.commanderDependence==="conservative"?.22:settings.commanderDependence==="normal"?.09:0;if(deps.includes("ownership:not_owned"))p+=.12;if(deps.some(x=>String(x).startsWith("spell:subtype:")))p+=.05;if(deps.includes("library_empty")&&Number(card.archetypeAffinity||0)<.45&&contextThemeAffinity(card)<.55)p+=.30;if(deps.includes("varied_mana_values")&&Number(card.archetypeAffinity||0)<.45&&contextThemeAffinity(card)<.55)p+=.18;if(deps.length>=3)p+=.05;return p}
function scoreWeights(settings){let w={commander:.23,theme:.25,role:.18,functional:.10,curve:.08,mana:.06,availability:.04,edhrec:.06};const tf=(settings.themeFocus-70)/100;w.theme+=tf*.16;w.commander+=tf*.04;w.functional-=tf*.06;w.curve-=tf*.04;if(settings.synergyBias==="synergy"){w.theme+=.08;w.edhrec+=.05;w.commander+=.04;w.functional-=.05;w.curve-=.03}if(settings.synergyBias==="efficiency"){w.theme-=.07;w.commander-=.03;w.edhrec-=.02;w.functional+=.05;w.curve+=.04;w.mana+=.02}for(const k of Object.keys(w))w[k]=Math.max(.01,w[k]);const total=Object.values(w).reduce((n,x)=>n+x,0);for(const k of Object.keys(w))w[k]/=total;return w}
function baseCandidateScore(card,settings,commanderColors,weights=null){const w=weights||scoreWeights(settings),commander=clamp(card.commanderAffinity??0),theme=clamp(card.effectiveThemeAffinity??card.themeAffinity??0),functional=functionalDensity(card),curve=curveFit(card,settings),mana=manaFit(card,commanderColors),owned=Number(card.ownedQuantity||0)>0,availability=settings.protectExistingDecks?(Number(card.availableQuantity||0)>0?1:owned?.25:0):(owned?1:0),roleBest=Math.max(...ROLE_KEYS.map(r=>roleQuality(card,r)),0);return w.commander*commander+w.theme*theme+w.functional*functional+w.curve*curve+w.mana*mana+w.availability*availability+w.edhrec*edhrecPower(card)+w.role*roleBest*.55-dependencyPenalty(card,settings)}
function deficits(counts,targets){return {ramp:Math.max(0,targets.ramp-counts.ramp),resources:Math.max(0,targets.resources-counts.resources),interaction:Math.max(0,targets.interaction-counts.interaction),wipes:Math.max(0,targets.wipes-counts.wipes),resilience:Math.max(0,targets.resilience-counts.resilience),finishers:Math.max(0,targets.finishers-counts.finishers),theme:Math.max(0,targets.theme-counts.theme)}}

export function themeFacetTags(card,themeName=""){
  const tf=themeFlags(themeName);if(!tf.voltron)return [];
  const type=typeOf(card).toLowerCase(),text=textOf(card).toLowerCase().replace(/\([^()]{0,320}\)/g," "),ids=roleIds(card),facts=card?.semantic?.facts||{},out=[];
  // "Aura" alone is not enough: land/player Auras must not satisfy Voltron attachment
  // targets. Equipment and Auras/effects that actually attach to creatures do.
  if(facts.attachesToCreature||/\bequipment\b/.test(type)||/attach [^.]{0,80} to (?:target |a |that )?creature|equipped creature|enchanted creature/.test(text))out.push("attachment");
  if(ids.includes("evasion"))out.push("evasion");
  if(ids.includes("protection"))out.push("protection");
  if(/combat damage.*(?:player|opponent)|whenever .* deals combat damage/.test(text)||ids.includes("damage_engine"))out.push("combat_payoff");
  if(/(?:equipped|enchanted|target|this) creature[^.]{0,100}gets? \+[1-9x*]|double strike|double .* power|base power/.test(text))out.push("pump");
  if(facts.commanderSupport)out.push("commander_support");
  return uniq(out);
}
function themeFacetTargets(themeName=""){return themeFlags(themeName).voltron?{attachment:9,evasion:5,protection:5,combat_payoff:4,pump:6,commander_support:3}:{}}
function incrementFacetCounts(counts,card,themeName,delta=1){for(const f of themeFacetTags(card,themeName))counts[f]=(counts[f]||0)+delta}
function incrementSupportCounts(counts,card,delta=1){
  const facts=card?.semantic?.facts||{},tags=new Set(card?.semantic?.synergyTags||[]);
  if(typeBucket(card)==="Creature")counts.creatures=(counts.creatures||0)+delta;
  if(cardTraits(card).includes("Artifact"))counts.artifacts=(counts.artifacts||0)+delta;
  if(cardTraits(card).includes("Enchantment"))counts.enchantments=(counts.enchantments||0)+delta;
  if(facts.tokenForYou||facts.tokenSupport||roleIds(card).includes("token_generation"))counts.tokens=(counts.tokens||0)+delta;
  if(facts.ownGraveyard||tags.has("graveyard"))counts.graveyard=(counts.graveyard||0)+delta;
  if(tags.has("lands")||facts.additionalLand||roleIds(card).includes("land_tutor"))counts.lands=(counts.lands||0)+delta;
  counts.tags=counts.tags||{};for(const tag of card?.semantic?.produces||[])counts.tags[tag]=(counts.tags[tag]||0)+delta;
}
function dependencyTagSupport(dep,supportCounts,themeName=""){
  const tags=supportCounts?.tags||{},baseline=themeDependencyBaseline(dep,themeName),count=Number(tags[dep]||0);
  let target=10;if(dep==="spell:any")target=20;else if(dep==="spell:instant_sorcery")target=14;else if(dep==="spell:noncreature"||dep==="spell:creature")target=16;else if(dep.startsWith("spell:subtype:"))target=8;else if(dep.startsWith("spell:color:"))target=10;
  return Math.max(baseline,clamp(count/target));
}
function dependencyValue(dep,state,settings,themeName=""){
  const f=themeFlags(themeName),s=state?.supportCounts||{};
  if(dep==="commander")return settings.commanderDependence==="all-in"?1:settings.commanderDependence==="normal"?.78:.58;
  if(dep==="creatures")return Math.max((f.creatureEngine||f.tokens||f.voltron) ? .62 : 0,clamp((s.creatures||0)/14));
  if(dep==="artifacts")return Math.max(f.artifacts ? .68 : 0,clamp((s.artifacts||0)/9));
  if(dep==="enchantments")return Math.max(f.enchantments ? .68 : 0,clamp((s.enchantments||0)/9));
  if(dep==="tokens")return Math.max(f.tokens ? .78 : 0,clamp((s.tokens||0)/6));
  if(dep==="graveyard")return Math.max(/graveyard|reanimator/.test(String(themeName).toLowerCase()) ? .72 : 0,clamp((s.graveyard||0)/6));
  if(dep==="lands")return Math.max(f.lands?.72:0,clamp((s.lands||0)/10));
  if(dep.startsWith("spell:")||dep==="ownership:not_owned")return dependencyTagSupport(dep,s,themeName);
  if(dep==="combat")return Math.max((f.voltron||f.creatures)?.52:0,clamp((s.creatures||0)/18)*.72);
  if(dep==="lifegain_events")return f.lifegain?.68:.28;
  if(dep==="opponent_actions")return .24;
  if(dep==="external_events")return .32;
  if(dep==="conditional_event")return .40;
  if(dep==="library_empty")return /mill|self[- ]?mill|draw/.test(String(themeName).toLowerCase()) ? .62 : .08;
  if(dep==="varied_mana_values")return .28;
  return .55;
}
function dependencyGroupSupport(group,state,settings,themeName=""){
  const deps=uniq(group||[]);if(!deps.length)return 1;
  // Within one ability/path every requirement is conjunctive, so its weakest prerequisite
  // is the bottleneck.
  return Math.min(...deps.map(dep=>dependencyValue(dep,state,settings,themeName)));
}
function dependencySupport(card,state,settings,themeName="",role=null){
  const semantic=card?.semantic||{},globalDeps=semantic.globalDependencies||[];
  const globalSupport=dependencyGroupSupport(globalDeps,state,settings,themeName);
  let groups=role?(semantic.roleDependencyGroups?.[role]||[]):archetypeDependencyGroups(card,themeName);
  // Backward-compatible fallback for cached/older semantic objects.
  if(!groups.length){const flat=role?(semantic.roleDependencies?.[role]||[]):[];if(flat.length)groups=[flat]}
  // Different abilities are alternative paths: one supported independent ability is enough
  // to keep the role/theme usable. This avoids letting a secondary conditional clause poison
  // an otherwise valid function.
  const scopedSupport=groups.length?Math.max(...groups.map(g=>dependencyGroupSupport(g,state,settings,themeName))):1;
  return Math.min(globalSupport,scopedSupport);
}

function specializationPenalty(card,themeName="",settings={}){
  const kind=archetypeKind(themeName);if(kind==="generic")return 0;const a=clamp(card.archetypeAffinity??0);if(a>=.30)return 0;const ids=new Set(roleIds(card)),facts=card?.semantic?.facts||{};let p=0;
  if(ids.has("clone")||ids.has("spell_copy")||facts.clonePermanent||facts.copySpell)p=Math.max(p,.11);
  if(ids.has("token_support")||facts.tokenMultiplier)p=Math.max(p,.085);
  if(ids.has("tribal_payoff"))p=Math.max(p,.11);
  // Token creation is broadly useful, so only a light mismatch penalty applies outside
  // token-centric themes; copy/tribal packages are more strategy-specific.
  if(ids.has("token_generation")&&kind!=="tokens")p=Math.max(p,.045);
  return p*(.75+Math.max(0,Number(settings.themeFocus||70))/200);
}

function candidateDynamicScore(card,state,targets,settings,commanderColors,themeName,weights=null,focusRole=null,focusFacet=null){
  const w=weights||scoreWeights(settings),{counts,typeCounts,traitCounts,facetCounts}=state;let score=baseCandidateScore(card,settings,commanderColors,w),d=deficits(counts,targets),raw=rawRoleFlags(card),theme=Number(card.effectiveThemeAffinity ?? card.themeAffinity ?? 0),themeDepSupport=dependencySupport(card,state,settings,themeName);
  for(const k of ROLE_KEYS){
    const q=roleQuality(card,k),roleDepSupport=dependencySupport(card,state,settings,themeName,k),hasRoleDeps=(card?.semantic?.roleDependencyGroups?.[k]||[]).some(g=>(g||[]).length>0)||(card?.semantic?.globalDependencies||[]).length>0;
    if(raw[k]&&d[k]>0)score+=q*Math.min(1,d[k]/Math.max(1,targets[k]))*.16*(hasRoleDeps?(.45+.55*roleDepSupport):1);
    // Diminishing returns: once a role is already comfortably covered, the next copy
    // must earn its slot through theme/efficiency instead of riding the same role label.
    if(q>=.5&&Number(counts[k]||0)>Number(targets[k]||0)+.8){
      const over=Number(counts[k]||0)-Number(targets[k]||0);
      const ceiling=k==="ramp"?.22:.14,scale=k==="ramp"?.17:.11;score-=Math.min(ceiling,.035+over/Math.max(1,targets[k])*scale)*q;
    }
  }
  if(focusRole){const focusDep=dependencySupport(card,state,settings,themeName,focusRole),hasFocusDeps=(card?.semantic?.roleDependencyGroups?.[focusRole]||[]).some(g=>(g||[]).length>0)||(card?.semantic?.globalDependencies||[]).length>0;score+=roleQuality(card,focusRole)*.48*(hasFocusDeps?Math.max(.08,focusDep):1)}
  if(theme>=.45&&d.theme>0)score+=theme*.10*Math.max(.25,themeDepSupport);
  if(focusFacet&&themeFacetTags(card,themeName).includes(focusFacet))score+=.18+theme*.08;
  if(archetypeDependencyGroups(card,themeName).some(g=>(g||[]).length>0)||(card?.semantic?.globalDependencies||[]).length)score-=Math.max(0,1-themeDepSupport)*.12;
  score-=specializationPenalty(card,themeName,settings);
  const overlap=ROLE_KEYS.filter(k=>raw[k]&&d[k]>0&&roleQuality(card,k)>=.5).length;if(overlap>=2)score+=Math.min(.12,(overlap-1)*.05);
  const tb=typeBucket(card),floor=targets.typeProfile?.floors?.[tb]||0,desired=targets.typeProfile?.desired?.[tb]||floor,cap=targets.typeProfile?.caps?.[tb]??99,current=typeCounts[tb]||0;
  if(current<floor)score+=.08*Math.min(2,(floor-current)/Math.max(1,floor)+.5);
  else if(desired&&current<desired)score+=.045*Math.min(1,(desired-current)/Math.max(1,desired));
  if(desired&&current>desired+1)score-=Math.min(.16,.035+(current-desired)/Math.max(1,desired)*.10);
  if(current>=cap)score-=.42+.04*(current-cap);
  for(const tr of cardTraits(card)){const tc=targets.typeProfile?.traitCaps?.[tr]??99,now=traitCounts[tr]||0;if(now>=tc)score-=.45+.04*(now-tc);else if(now>=tc*.82)score-=.06}
  const facetTargets=themeFacetTargets(themeName),facets=themeFacetTags(card,themeName);let saturatedFacets=0;for(const f of facets){const target=facetTargets[f]||0,now=facetCounts[f]||0;if(target&&now>=target+2)saturatedFacets++}if(saturatedFacets)score-=Math.min(.10,.035*saturatedFacets);
  if(theme<.18&&counts.theme<targets.theme)score-=.035;
  return score;
}

function strongestRole(card){let best=null,q=0;for(const r of ROLE_KEYS){const x=roleQuality(card,r);if(x>q){q=x;best=r}}return {role:best,quality:q}}
function cardCategory(card){
  if(card.isCommander)return "Commander";if(card.comboPiece)return "Combo Piece";if(isLand(card))return "Land";
  const theme=Number(card.effectiveThemeAffinity ?? card.themeAffinity ?? 0),sr=strongestRole(card);
  if(theme>=.64&&hasRole(card,"engine"))return "Theme Engine";
  if(theme>=.64&&(hasRole(card,"payoff")||hasRole(card,"tribal_payoff")))return "Theme Payoff";
  if(sr.role==="ramp"&&sr.quality>=.5)return "Ramp / Fixing";
  if(sr.role==="resources"&&sr.quality>=.5)return "Draw / Resources";
  if(sr.role==="interaction"&&sr.quality>=.5)return "Interaction";
  if(sr.role==="wipes"&&sr.quality>=.5)return "Board Wipe";
  if(sr.role==="resilience"&&sr.quality>=.5)return "Protection / Recursion";
  if(sr.role==="finishers"&&sr.quality>=.5)return "Finisher";
  if(theme>=.45)return "Theme Support";return "Utility";
}
function incrementCounts(counts,card,delta=1){for(const k of ROLE_KEYS)counts[k]+=roleContribution(card,k)*delta;if(Number(card.effectiveThemeAffinity ?? card.themeAffinity ?? 0)>=.45)counts.theme+=delta}
function incrementType(typeCounts,card,delta=1){const t=typeBucket(card);typeCounts[t]=(typeCounts[t]||0)+delta}
function incrementTraits(traitCounts,card,delta=1){for(const t of cardTraits(card))traitCounts[t]=(traitCounts[t]||0)+delta}

function chooseComboPackage(comboCandidates,pool,settings,themeName="",commander="",commanderColors=[]){
  const policy=normalizeComboPolicy(settings.comboPolicy);if(policy==="off"||!comboCandidates?.length)return null;
  const available=availableComboPackages(comboCandidates,pool,{commander,commanderColors,policy,protectExistingDecks:settings.protectExistingDecks,maxPieces:6});
  let best=null;
  for(const pkg of available){
    // First release only locks singleton exact-card packages. A variant requiring multiple
    // copies or a generic template is skipped until the builder can prove that substitution.
    if(pkg.nonCommanderPieces.some(p=>Number(p.quantity||1)!==1))continue;
    const cards=pkg.nonCommanderPieces.map(p=>p.card).filter(Boolean);if(!cards.length)continue;
    const themeMean=cards.reduce((n,c)=>n+Number(c.effectiveThemeAffinity??c.themeAffinity??0),0)/cards.length;
    const commanderMean=cards.reduce((n,c)=>n+Number(c.commanderAffinity||0),0)/cards.length;
    const efficiencyMean=cards.reduce((n,c)=>n+Number(c.efficiencyScore||0),0)/cards.length;
    const functionalMean=cards.reduce((n,c)=>n+Math.max(...ROLE_KEYS.map(r=>roleQuality(c,r)),0),0)/cards.length;
    const coherence=Math.max(themeMean,commanderMean*.78)+functionalMean*.08;
    if(policy==="synergistic"&&coherence<.28)continue;
    const totalMv=cards.reduce((n,c)=>n+cmcOf(c),0),score=comboPackageBaseScore(pkg,{policy})+themeMean*.28+commanderMean*.14+efficiencyMean*.08+functionalMean*.08-Math.max(0,totalMv-8)*.008;
    const candidate={...pkg,score:round(score,3),themeMean:round(themeMean,3),commanderMean:round(commanderMean,3),efficiencyMean:round(efficiencyMean,3),functionalMean:round(functionalMean,3),totalManaValue:round(totalMv,1)};
    if(!best||candidate.score>best.score)best=candidate;
  }
  if(!best)return null;
  const total=best.nonCommanderPieces.length;best.nonCommanderPieces.forEach((p,i)=>{p.card.comboPiece={comboId:best.id,index:i+1,total,infinite:Boolean(best.infinite),produces:(best.produces||[]).map(x=>x.name),url:best.url||null}});
  return best;
}

function comboCompleteness(mainboard,comboPackage,policy="off"){
  const required=normalizeComboPolicy(policy)!=="off";
  if(!comboPackage)return {required,selected:false,complete:!required,missing:[],reason:required?"no-complete-package":null};
  const quantities=new Map((mainboard||[]).map(c=>[key(c.name),Number(c.quantity||1)])),missing=[];
  for(const p of comboPackage.pieces||[]){if(p.mustBeCommander||key(p.name)===key(mainboard?.find(c=>c.isCommander)?.name))continue;if((quantities.get(key(p.name))||0)<Number(p.quantity||1))missing.push({name:p.name,required:Number(p.quantity||1),found:quantities.get(key(p.name))||0})}
  return {required:true,selected:true,complete:missing.length===0,missing,reason:missing.length?"selected-package-incomplete":null};
}

function selectNonlands(candidates,targets,settings,commanderColors,themeName="",comboPackage=null){
  const pool=candidates.filter(c=>!isLand(c)),weights=scoreWeights(settings),selected=[],selectedKeys=new Set();
  const state={counts:{ramp:0,resources:0,interaction:0,wipes:0,resilience:0,finishers:0,theme:0},typeCounts:Object.fromEntries(TYPE_KEYS.map(k=>[k,0])),traitCounts:Object.fromEntries(TRAIT_KEYS.map(k=>[k,0])),facetCounts:{},supportCounts:{creatures:0,artifacts:0,enchantments:0,tokens:0,graveyard:0,lands:0,tags:{}}};
  const trace=new Map(),structuralTradeoffs=[],lockedKeys=new Set((comboPackage?.nonCommanderPieces||[]).filter(p=>!isLand(p.card)).map(p=>key(p.name)));
  const add=(card,{phase="general-fill",focusRole=null,focusFacet=null,replaces=null,gain=null}={})=>{
    if(!card||selectedKeys.has(key(card.name))||selected.length>=targets.nonlands)return false;
    const contextScore=candidateDynamicScore(card,state,targets,settings,commanderColors,themeName,weights,focusRole,focusFacet);
    selected.push(card);selectedKeys.add(key(card.name));
    trace.set(key(card.name),{phase,focusRole,focusFacet,contextScoreAtSelection:round(contextScore,3),replaces:replaces?.name||null,gain:gain==null?null:round(gain,3)});
    incrementCounts(state.counts,card,1);incrementType(state.typeCounts,card,1);incrementTraits(state.traitCounts,card,1);incrementFacetCounts(state.facetCounts,card,themeName,1);incrementSupportCounts(state.supportCounts,card,1);return true
  };
  const remove=card=>{if(lockedKeys.has(key(card?.name)))return false;incrementCounts(state.counts,card,-1);incrementType(state.typeCounts,card,-1);incrementTraits(state.traitCounts,card,-1);incrementFacetCounts(state.facetCounts,card,themeName,-1);incrementSupportCounts(state.supportCounts,card,-1);selected.splice(selected.indexOf(card),1);selectedKeys.delete(key(card.name));trace.delete(key(card.name));return true};
  const underCap=c=>{const t=typeBucket(c),cap=targets.typeProfile?.caps?.[t]??99;if((state.typeCounts[t]||0)>=cap)return false;for(const tr of cardTraits(c)){const tc=targets.typeProfile?.traitCaps?.[tr]??99;if((state.traitCounts[tr]||0)>=tc)return false}return true};
  const best=(predicate=()=>true,{respectCaps=true,focusRole=null,focusFacet=null}={})=>{let winner=null,winnerScore=-Infinity;for(const c of pool){if(selectedKeys.has(key(c.name))||!predicate(c)||(respectCaps&&!underCap(c)))continue;const score=candidateDynamicScore(c,state,targets,settings,commanderColors,themeName,weights,focusRole,focusFacet);if(score>winnerScore||(score===winnerScore&&edhrecPower(c)>edhrecPower(winner))||(score===winnerScore&&edhrecPower(c)===edhrecPower(winner)&&cmcOf(c)<cmcOf(winner))){winner=c;winnerScore=score}}return winner};

  // 0) A selected combo is an atomic package. Lock every exact nonland piece before any
  // theme/role quota so later repair and quality passes cannot silently dismantle it.
  if(comboPackage){for(const p of comboPackage.nonCommanderPieces||[]){if(isLand(p.card))continue;add(p.card,{phase:`combo:${comboPackage.id}`})}}

  // 1) Seed the theme with its best-supported cards, not every textual false positive.
  const themeSeed=Math.min(Math.max(8,Math.round(targets.theme*.30)),Math.max(8,targets.nonlands-42));
  for(let i=0;i<themeSeed;i++){const c=best(x=>Number(x.effectiveThemeAffinity ?? x.themeAffinity ?? 0)>=.52);if(!c)break;add(c,{phase:"theme-seed"})}

  // 2) For themes with explicit strategic facets (currently Voltron), cover the package
  // before generic fill: attachments, evasion, protection, payoffs, pump, commander support.
  const facetTargets=themeFacetTargets(themeName);
  for(const [facet,target] of Object.entries(facetTargets)){
    let guard=0;while(selected.length<targets.nonlands&&(state.facetCounts[facet]||0)<target&&guard++<80){const c=best(x=>themeFacetTags(x,themeName).includes(facet),{focusFacet:facet});if(!c)break;add(c,{phase:`facet:${facet}`,focusFacet:facet})}
  }

  // 3) Fill functional minima one role at a time. A weak "ramp" label no longer satisfies
  // the same amount as a cheap, reliable accelerant; roleContribution() is quality-weighted.
  let guard=0;
  while(selected.length<targets.nonlands&&guard++<320){const d=deficits(state.counts,targets),needs=ROLE_KEYS.filter(k=>d[k]>.12);if(!needs.length)break;needs.sort((a,b)=>(d[b]/Math.max(1,targets[b]))-(d[a]/Math.max(1,targets[a])));const need=needs[0];const c=best(x=>roleContribution(x,need)>0,{focusRole:need});if(!c)break;add(c,{phase:`role:${need}`,focusRole:need})}

  // 4) Type-diversity floors, while overlapping trait caps prevent Artifact Creatures from
  // satisfying Creature floors and simultaneously flooding the deck with artifacts.
  for(const t of ["Instant","Sorcery","Enchantment","Creature","Artifact"]){const floor=targets.typeProfile?.floors?.[t]||0;guard=0;while(selected.length<targets.nonlands&&(state.typeCounts[t]||0)<floor&&guard++<100){const c=best(x=>typeBucket(x)===t);if(!c)break;add(c,{phase:`type-floor:${t}`})}}

  // 5) Bring theme density to target using cards with meaningful theme evidence.
  guard=0;while(selected.length<targets.nonlands&&state.counts.theme<targets.theme&&guard++<220){const c=best(x=>Number(x.effectiveThemeAffinity ?? x.themeAffinity ?? 0)>=.42);if(!c)break;add(c,{phase:"theme-density"})}

  // 6) Fill under caps; only break caps if the collection genuinely cannot complete 99.
  while(selected.length<targets.nonlands){const c=best();if(!c)break;add(c,{phase:"general-fill"})}
  while(selected.length<targets.nonlands){const c=best(()=>true,{respectCaps:false});if(!c)break;add(c,{phase:"cap-fallback"})}

  // 7) Repair structural roles. Structural floors outrank soft theme density: a high
  // Theme Focus may choose the flexible slots, but it cannot veto an achievable ramp/wipe/
  // interaction/etc. repair. Every theme concession is recorded as an explicit trade-off.
  for(let pass=0;pass<16;pass++){
    const d=deficits(state.counts,targets);let changed=false;
    for(const need of ROLE_KEYS){
      if(d[need]<=.12)continue;
      const incoming=best(x=>roleContribution(x,need)>0,{focusRole:need})||best(x=>roleContribution(x,need)>0,{respectCaps:false,focusRole:need});if(!incoming)continue;
      const sacrificeCost=c=>candidateDynamicScore(c,state,targets,settings,commanderColors,themeName,weights)+Number(c.effectiveThemeAffinity??c.themeAffinity??0)*.10+ROLE_KEYS.reduce((n,r)=>n+(r===need?0:roleContribution(c,r))*.08,0);
      const outgoing=selected.slice().sort((a,b)=>sacrificeCost(a)-sacrificeCost(b)).find(c=>{
        if(lockedKeys.has(key(c.name)))return false;
        if(roleContribution(incoming,need)<=roleContribution(c,need)+.05)return false;
        const outType=typeBucket(c),inType=typeBucket(incoming),floors=targets.typeProfile?.floors||{},projectedTypes={...state.typeCounts};projectedTypes[outType]=(projectedTypes[outType]||0)-1;projectedTypes[inType]=(projectedTypes[inType]||0)+1;if(Number(projectedTypes[outType]||0)<Number(floors[outType]||0))return false;
        for(const role of ROLE_KEYS){if(role===need)continue;const before=Number(state.counts[role]||0),after=before-roleContribution(c,role)+roleContribution(incoming,role),floor=Math.min(Number(targets[role]||0),before);if(after+.15<floor)return false}
        const facetTargets=themeFacetTargets(themeName),facetProjected={...state.facetCounts};incrementFacetCounts(facetProjected,c,themeName,-1);incrementFacetCounts(facetProjected,incoming,themeName,1);for(const [facet,target] of Object.entries(facetTargets))if(Number(state.facetCounts[facet]||0)>=target&&Number(facetProjected[facet]||0)<target)return false;
        return true;
      });
      if(!outgoing)continue;
      const themeBefore=Number(state.counts.theme||0),outTheme=Number(outgoing.effectiveThemeAffinity??outgoing.themeAffinity??0)>=.45?1:0,inTheme=Number(incoming.effectiveThemeAffinity??incoming.themeAffinity??0)>=.45?1:0;remove(outgoing);add(incoming,{phase:`role-repair:${need}`,focusRole:need,replaces:outgoing});const themeAfter=Number(state.counts.theme||0);
      if(themeAfter<themeBefore)structuralTradeoffs.push({role:need,out:outgoing.name,in:incoming.name,themeBefore,themeAfter,themeDelta:inTheme-outTheme,reason:"structural-role-over-soft-theme"});changed=true;
    }
    if(!changed)break;
  }

  // 8) Quality upgrade pass. Greedy construction can lock in an early mediocre card before
  // a better option is considered for a later role. Compare selected cards against the
  // remaining pool and accept only material upgrades that preserve floors, role targets,
  // trait caps and strategic facets. This is the builder-side equivalent of the obvious
  // IN/OUT upgrade that should not have been discovered only after construction.
  const canSwap=(outgoing,incoming)=>{
    if(!outgoing||!incoming||lockedKeys.has(key(outgoing.name))||selectedKeys.has(key(incoming.name)))return false;
    const outType=typeBucket(outgoing),inType=typeBucket(incoming),floors=targets.typeProfile?.floors||{},caps=targets.typeProfile?.caps||{},traitCaps=targets.typeProfile?.traitCaps||{};
    const projectedType={...state.typeCounts};projectedType[outType]=(projectedType[outType]||0)-1;projectedType[inType]=(projectedType[inType]||0)+1;
    if((floors[outType]||0)&&projectedType[outType]<(floors[outType]||0))return false;
    if(projectedType[inType]>(caps[inType]??99))return false;
    const projectedTraits={...state.traitCounts};for(const tr of cardTraits(outgoing))projectedTraits[tr]=(projectedTraits[tr]||0)-1;for(const tr of cardTraits(incoming))projectedTraits[tr]=(projectedTraits[tr]||0)+1;
    for(const [tr,count] of Object.entries(projectedTraits))if(count>(traitCaps[tr]??99))return false;
    for(const role of ROLE_KEYS){const projected=Number(state.counts[role]||0)-roleContribution(outgoing,role)+roleContribution(incoming,role);if(projected+0.15<Math.min(Number(targets[role]||0),Number(state.counts[role]||0)))return false}
    const themeProjected=Number(state.counts.theme||0)-(Number(outgoing.effectiveThemeAffinity ?? outgoing.themeAffinity ?? 0)>=.45?1:0)+(Number(incoming.effectiveThemeAffinity ?? incoming.themeAffinity ?? 0)>=.45?1:0);if(themeProjected<Math.min(Number(targets.theme||0),Number(state.counts.theme||0)))return false;
    const facetTargets=themeFacetTargets(themeName),facetProjected={...state.facetCounts};incrementFacetCounts(facetProjected,outgoing,themeName,-1);incrementFacetCounts(facetProjected,incoming,themeName,1);for(const [facet,target] of Object.entries(facetTargets))if(Number(state.facetCounts[facet]||0)>=target&&Number(facetProjected[facet]||0)<target)return false;
    return true;
  };
  for(let pass=0;pass<12;pass++){
    let bestSwap=null;
    for(const outgoing of selected){
      const outScore=candidateDynamicScore(outgoing,state,targets,settings,commanderColors,themeName,weights);
      for(const incoming of pool){
        if(!canSwap(outgoing,incoming))continue;
        const inScore=candidateDynamicScore(incoming,state,targets,settings,commanderColors,themeName,weights);
        const roleGain=Math.max(...ROLE_KEYS.map(r=>roleQuality(incoming,r)-roleQuality(outgoing,r)),0),edhGain=edhrecPower(incoming)-edhrecPower(outgoing),gain=(inScore-outScore)+Math.max(0,roleGain)*.08+Math.max(0,edhGain)*.07;
        if(gain>.085&&(!bestSwap||gain>bestSwap.gain))bestSwap={outgoing,incoming,gain};
      }
    }
    if(!bestSwap)break;remove(bestSwap.outgoing);add(bestSwap.incoming,{phase:"quality-upgrade",replaces:bestSwap.outgoing,gain:bestSwap.gain});
  }
  return {selected,...state,selectionTrace:Object.fromEntries(trace),structuralTradeoffs};
}

function basicCard(color){const c=COLORS.includes(color)?color:"C",name=BASIC_BY_COLOR[c];return {name,quantity:99,ownedQuantity:99,availableQuantity:99,syntheticBasic:true,commanderAffinity:.18,themeAffinity:0,efficiencyScore:.6,meta:{typeLine:BASIC_TYPE_BY_COLOR[c],oracleText:`{T}: Add {${c}}.`,cmc:0,manaCost:"",colorIdentity:c==="C"?[]:[c],producedMana:[c],legalities:{commander:"legal"}}}}
function injectUnlimitedBasics(candidates,commanderColors){const wanted=(commanderColors||[]).length?commanderColors:["C"],byName=new Map(candidates.map(c=>[key(c.name),c])),out=[...candidates];for(const color of wanted){const b=basicCard(color),k=key(b.name),existing=byName.get(k);if(existing){existing.ownedQuantity=Math.max(99,Number(existing.ownedQuantity||0));existing.availableQuantity=Math.max(99,Number(existing.availableQuantity||0));existing.syntheticBasic=true;if(!existing.meta?.producedMana?.length)existing.meta={...(existing.meta||{}),...b.meta}}else{out.push(b);byName.set(k,b)}}return out}

function computeDemand(cards,commanderMeta,commanderColors){const raw=Object.fromEntries(COLORS.map(c=>[c,0]));for(const card of [...cards,{name:"Commander",meta:commanderMeta}]){const p=parseManaCost(manaCostOf(card)),mv=Math.max(1,cmcOf(card)),urgency=1+Math.max(0,4-mv)*.28;for(const c of COLORS)raw[c]+=Number(p.pips[c]||0)*urgency}let total=(commanderColors||[]).reduce((n,c)=>n+(raw[c]||0),0);if(total<=0){for(const c of commanderColors||[])raw[c]=1;total=Math.max(1,(commanderColors||[]).length)}const share={};for(const c of COLORS)share[c]=(commanderColors||[]).includes(c)?(raw[c]||0)/total:0;return {raw,share}}
function choose(n,k){if(k<0||k>n)return 0;k=Math.min(k,n-k);let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}
function hyperAtLeast(deckSize,successes,draws,needed){if(needed<=0)return 1;if(successes<needed)return 0;const n=Math.min(draws,deckSize),den=choose(deckSize,n);let p=0;for(let i=needed;i<=Math.min(successes,n);i++)p+=choose(successes,i)*choose(deckSize-successes,n-i)/den;return clamp(p,0,1)}
const sourceNeedCache=new Map();
function sourcesNeeded(pips,turn,reliability=.85){const k=`${pips}:${turn}:${reliability}`,cached=sourceNeedCache.get(k);if(cached)return cached;const draws=7+Math.max(0,Math.min(7,turn)-1);let needed=99;for(let sources=Math.max(1,pips);sources<=60;sources++){if(hyperAtLeast(99,sources,draws,pips)>=reliability){needed=sources;break}}sourceNeedCache.set(k,needed);return needed}
function expectedCastTurn(card){
  const base=Math.max(1,Math.min(7,Math.ceil(cmcOf(card)||1))),cost=manaCostOf(card);if(!/\{X\}/i.test(cost))return base;
  const ids=new Set(roleIds(card));
  // X is normally a scaling knob, not a promise to cast the spell for X=0. Finisher/payoff
  // X-spells are evaluated as mid/late-game cards; utility X-spells still get an earlier
  // but non-minimum target. This prevents XBB finishers from manufacturing a BB-on-T2 alarm.
  if(ids.has("finisher")||ids.has("payoff")||ids.has("threat")||ids.has("damage_engine"))return Math.max(base,6);
  if(ids.has("interaction")||ids.has("removal")||ids.has("counterspell")||ids.has("tutor")||ids.has("ramp"))return Math.max(base,3);
  return Math.max(base,4);
}
function computeColorRequirements(cards,commanderMeta,commanderColors){const required=Object.fromEntries(COLORS.map(c=>[c,0])),hardest=Object.fromEntries(COLORS.map(c=>[c,null]));for(const card of [...cards,{name:"Commander",meta:commanderMeta,isCommander:true}]){const p=parseManaCost(manaCostOf(card)),turn=expectedCastTurn(card);for(const c of commanderColors||[]){const pips=Number(p.pips[c]||0);if(!pips)continue;const need=sourcesNeeded(Math.min(3,pips),Math.max(turn,Math.min(3,pips)),.85);if(need>required[c]){required[c]=need;hardest[c]={card:card.name||"Commander",pips,turn,need,variableCost:/\{X\}/i.test(manaCostOf(card))}}}}return {required,hardest,reliability:.85}}

function adjustLandTargetFromSelection(initialTarget,cards,targets,settings,themeName=""){
  const nonlands=(cards||[]).filter(c=>!isLand(c)),avgMv=nonlands.length?nonlands.reduce((n,c)=>n+cmcOf(c),0)/nonlands.length:0;
  const counts={ramp:0,resources:0,interaction:0,wipes:0,resilience:0,finishers:0,theme:0};for(const c of nonlands)incrementCounts(counts,c,1);
  const cheapRamp=nonlands.filter(c=>cmcOf(c)<=2&&roleQuality(c,"ramp")>=.7).length,cheapResources=nonlands.filter(c=>cmcOf(c)<=2&&roleQuality(c,"resources")>=.65).length,tf=themeFlags(themeName);
  let target=Number(initialTarget||38);const reasons=[];
  if(avgMv>=4.05){target+=2;reasons.push(`curva alta (${round(avgMv,2)} MV)`)}else if(avgMv>=3.45){target+=1;reasons.push(`curva media-alta (${round(avgMv,2)} MV)`)}else if(avgMv<=2.45){target-=1;reasons.push(`curva baja (${round(avgMv,2)} MV)`)}
  if(cheapRamp>=10&&avgMv<3.6){target-=1;reasons.push(`${cheapRamp} piezas fiables de ramp de MV≤2`)}else if(cheapRamp<6){target+=1;reasons.push(`poco ramp temprano fiable (${cheapRamp} de MV≤2)`)}
  if(cheapResources>=8&&avgMv<3){target-=1;reasons.push(`${cheapResources} fuentes baratas de recursos`)}
  if(tf.lands){target=Math.max(target,39);reasons.push("theme centrado en tierras")}
  if(settings.landStyle==="safe")target=Math.max(target,38);if(settings.landStyle==="lean")target=Math.min(target,37);
  return {baseTarget:Number(initialTarget||38),target:Math.max(35,Math.min(41,Math.round(target))),avgMv:round(avgMv,2),ramp:round(counts.ramp,1),cheapRamp,cheapResources,reasons};
}

function fetchColorsFromText(text,commanderColors){
  const t=String(text||"").toLowerCase();
  if(!/search your library/.test(t))return [];
  if(/landcycling/.test(t)&&!/put (?:it|that card|those cards) onto the battlefield/.test(t))return [];
  const hasLandSearch=/basic land card|\b(?:plains|island|swamp|mountain|forest)\b[^.]{0,85}(?:card|onto the battlefield)/.test(t);
  if(!hasLandSearch)return [];
  if(/basic land card/.test(t))return [...(commanderColors||[])];
  const map={plains:"W",island:"U",swamp:"B",mountain:"R",forest:"G"},out=[];
  for(const [word,color] of Object.entries(map))if(new RegExp(`\\b${word}\\b`).test(t))out.push(color);
  return uniq(out).filter(c=>(commanderColors||[]).includes(c));
}
function activationCostBefore(text,needle){
  const idx=text.indexOf(needle);if(idx<0)return {generic:0,colored:0,total:0};
  // A search can occur in a later sentence of the same activated ability (Demolition
  // Field-style wording). Walk back to the most recent ability colon first; sentence
  // punctuation after that colon must not erase the activation cost.
  const colon=text.lastIndexOf(":",idx);
  let prefix="";
  if(colon>=0){const abilityStart=Math.max(text.lastIndexOf("\n",colon),text.lastIndexOf(".",colon-1));prefix=text.slice(abilityStart+1,colon)}
  else{const start=Math.max(text.lastIndexOf(".",idx),text.lastIndexOf("\n",idx),text.lastIndexOf(";",idx));prefix=text.slice(start+1,idx)}
  const tokens=[...prefix.matchAll(/\{([^}]+)\}/g)].map(m=>m[1].toUpperCase());
  let generic=0,colored=0;
  for(const token of tokens){if(/^\d+$/.test(token))generic+=Number(token);else if(COLORS.includes(token)||token==="C")colored++}
  return {generic,colored,total:generic+colored};
}
export function analyzeLandSource(card,commanderColors=[]){
  const colors=(commanderColors||[]).filter(c=>COLORS.includes(c)),t=textOf(card).toLowerCase().replace(/\([^()]{0,320}\)/g," ");
  const rawProduced=inferProducedMana(card).filter(c=>COLORS.includes(c)&&colors.includes(c)),fetchColors=fetchColorsFromText(t,colors),fetch=fetchColors.length>0;
  const fetchCost=fetch?activationCostBefore(t,"search your library"):{generic:0,colored:0,total:0};
  const lateFetch=fetch&&fetchCost.total>0;
  const fetchPutsTapped=fetch&&/search your library[^.]{0,240}(?:put|puts?)[^.]{0,140}(?:onto the battlefield|battlefield)[^.]{0,60}tapped/.test(t);
  const entersTapped=/\benters (?:the battlefield )?tapped\b/.test(t)&&!/enters (?:the battlefield )?tapped unless/.test(t);
  const entryTax=/(?:when|as) [^.]{0,70} enters[^.]{0,110}sacrifice (?:it|this land)[^.]{0,70}unless you pay|enters[^.]{0,120}sacrifice (?:it|this land)[^.]{0,70}unless you pay/.test(t);
  const filterMatch=t.match(/\{(\d+)\}[^.]{0,55}\{t\}[^.]{0,110}add [^.]{0,100}(?:mana of any color|combination of colors)/),filterActivationCost=filterMatch?Number(filterMatch[1]||0):0;
  const filtering=filterActivationCost>0;
  const expensiveFiltering=filtering&&filterActivationCost>=2;
  const permanentColorCondition=/color of a permanent you control/.test(t),opponentCondition=/land an opponent controls could produce|color among permanents an opponent controls/.test(t),commanderCondition=/commander(?:'|’)s color identity/.test(t);
  const restrictedSpend=/spend this mana only|only to cast|only to activate|chosen type|creature spell|commander spell|legendary spell/.test(t);
  const conditionReasons=[];
  if(permanentColorCondition)conditionReasons.push("requires-colored-permanent");
  if(opponentCondition)conditionReasons.push("depends-on-opponent");
  if(commanderCondition)conditionReasons.push("commander-identity");
  if(restrictedSpend)conditionReasons.push("restricted-spend");
  if(filtering)conditionReasons.push(expensiveFiltering?"expensive-filter":"filter");
  if(entryTax)conditionReasons.push("entry-tax");
  if(lateFetch)conditionReasons.push("late-fetch");
  const sourceWeights={};
  for(const c of rawProduced){
    let w=1;
    if(permanentColorCondition)w=Math.min(w,.42);
    if(opponentCondition)w=Math.min(w,.84);
    if(commanderCondition)w=Math.min(w,.96);
    if(restrictedSpend)w=Math.min(w,.58);
    if(filtering)w=Math.min(w,expensiveFiltering?.18:.45);
    if(entryTax)w=Math.min(w,.72);
    sourceWeights[c]=w;
  }
  for(const c of fetchColors){
    let w=lateFetch?.16:(fetchPutsTapped?.82:.94);
    sourceWeights[c]=Math.max(Number(sourceWeights[c]||0),w);
  }
  const sourceColors=Object.keys(sourceWeights).filter(c=>sourceWeights[c]>0),effectiveTapped=entersTapped||(!lateFetch&&fetchPutsTapped),maxWeight=Math.max(0,...Object.values(sourceWeights));
  let sourceClass="unrestricted";
  if(lateFetch)sourceClass="late-fetch";else if(filtering)sourceClass=expensiveFiltering?"expensive-filter":"filter";else if(permanentColorCondition||opponentCondition||restrictedSpend)sourceClass="conditional";else if(fetch)sourceClass=fetchPutsTapped?"fetch-tapped":"fetch";else if(entryTax)sourceClass="entry-tax";
  const utility=!sourceColors.length||maxWeight<.30;
  return {rawProduced,direct:rawProduced,fetchColors,sourceColors,sourceWeights,fetch,reliableFetch:fetch&&!lateFetch,lateFetch,fetchActivationCost:fetchCost.total,fetchPutsTapped,fetchTargetValid:!fetch||fetchColors.length>0,entersTapped,effectiveTapped,entryTax,anyColor:/any color|combination of colors/.test(t),conditional:permanentColorCondition||opponentCondition||restrictedSpend,filtering,filterActivationCost,restrictedSpend,utility,searchesBasic:fetch&&/basic land card/.test(t),sourceClass,reasons:conditionReasons};
}
function nonlandManaSupport(nonlands,requirements,commanderColors=[]){
  const colors=(commanderColors||[]).filter(c=>COLORS.includes(c)),support=Object.fromEntries(COLORS.map(c=>[c,0])),details=[];
  for(const card of nonlands||[]){
    const mv=cmcOf(card),rq=roleQuality(card,"ramp"),produced=inferProducedMana(card).filter(c=>colors.includes(c)),ids=roleIds(card);
    for(const color of colors){
      const hard=requirements?.hardest?.[color],turn=Math.max(1,Number(hard?.turn||3));let weight=0,reason=null;
      if(produced.includes(color)&&rq>=.5&&mv<turn){weight=mv<=1?.78:mv<=2?.56:mv<=3?.38:.22;weight*=Math.max(.55,rq);reason="mana-permanent"}
      if(ids.includes("land_tutor")&&rq>=.5&&mv<turn){const w=(mv<=2?.46:mv===3?.34:.22)*Math.max(.6,rq);if(w>weight){weight=w;reason="land-ramp"}}
      if(weight>0){support[color]+=weight;details.push({name:card.name,color,weight:round(weight,2),turn,reason})}
    }
  }
  for(const c of colors)support[c]=round(Math.min(6,support[c]),1);
  return {support,details};
}
function basicRatioTarget(colorCount,settings){if(settings.landStyle==="basics")return colorCount<=1?.94:colorCount===2?.88:colorCount===3?.84:colorCount===4?.80:.76;if(colorCount<=1)return settings.landStyle==="lean"?.68:.72;if(colorCount===2)return settings.landStyle==="safe"?.60:settings.landStyle==="lean"?.53:.56;if(colorCount===3)return settings.landStyle==="safe"?.57:settings.landStyle==="lean"?.51:.54;return settings.landStyle==="safe"?.53:.51}
function repairBasicFloor(target,colorCount,settings){if(settings.landStyle==="basics")return Math.max(1,Math.ceil(target*(colorCount<=1?.90:colorCount===2?.82:colorCount===3?.78:.72)));if(colorCount<=1)return Math.max(1,Math.floor(target*.58));if(colorCount===2)return settings.landStyle==="safe"?12:settings.landStyle==="lean"?8:10;if(colorCount===3)return settings.landStyle==="safe"?9:settings.landStyle==="lean"?6:7;return settings.landStyle==="safe"?7:5}

function selectLands(landCandidates,target,nonlands,commanderMeta,commanderColors,settings,themeName="",comboPackage=null){
  const colors=(commanderColors||[]).filter(c=>COLORS.includes(c)),colorCount=Math.max(1,colors.length),demand=computeDemand(nonlands,commanderMeta,colors),requirements=computeColorRequirements(nonlands,commanderMeta,colors),nonlandSupportInfo=nonlandManaSupport(nonlands,requirements,colors),nonlandSupport=nonlandSupportInfo.support;
  const candidates=injectUnlimitedBasics(landCandidates,colors),basics=candidates.filter(isBasic),nonbasics=candidates.filter(c=>!isBasic(c));
  const basicRatio=basicRatioTarget(colorCount,settings),minBasics=Math.min(target,Math.max(1,Math.ceil(target*basicRatio))),nominalMaxNonbasics=Math.max(0,target-minBasics),selectedNonbasics=[],sources=Object.fromEntries(COLORS.map(c=>[c,0])),rawSources=Object.fromEntries(COLORS.map(c=>[c,0])),facts=new Map(nonbasics.map(c=>[key(c.name),analyzeLandSource(c,colors)]));
  const remaining=new Map(nonbasics.map(c=>[key(c.name),allowsMultiple(c)?Math.max(1,Number(c.availableQuantity||c.ownedQuantity||1)):1]));
  const forcedLandPieces=(comboPackage?.nonCommanderPieces||[]).filter(p=>isLand(p.card)),forcedNonbasic=forcedLandPieces.filter(p=>!isBasic(p.card)),forcedBasics=forcedLandPieces.filter(p=>isBasic(p.card)),forcedBasicKeys=new Set(forcedBasics.map(p=>key(p.name))),maxNonbasics=Math.max(nominalMaxNonbasics,forcedNonbasic.length);
  const tf=themeFlags(themeName),fetchCap=Math.min(maxNonbasics,colorCount<=1?3:colorCount===2?6:7)+(tf.lands?2:0),tapCap=Math.min(maxNonbasics,settings.landStyle==="basics"?2:settings.landStyle==="safe"?4:6),utilityCap=Math.min(maxNonbasics,colorCount>=4?1:3);let fetchCount=0,tapCount=0,utilityCount=0;
  for(const p of forcedNonbasic){const c=p.card,f=facts.get(key(c.name))||analyzeLandSource(c,colors);selectedNonbasics.push(c);remaining.set(key(c.name),Math.max(0,(remaining.get(key(c.name))||0)-1));if(f.fetch)fetchCount++;if(f.effectiveTapped)tapCount++;if(f.utility)utilityCount++;for(const col of f.sourceColors){rawSources[col]++;sources[col]+=Number(f.sourceWeights?.[col]??1)}}
  const desiredFor=c=>Math.min(target,Math.max(Math.max(0,Number(requirements.required[c]||0)-Number(nonlandSupport[c]||0)),Math.ceil(target*(demand.share[c]||0)*1.12)));
  const scoreLand=c=>{const f=facts.get(key(c.name))||analyzeLandSource(c,colors);if(f.fetch&&!f.fetchTargetValid)return -999;let score=0;for(const color of f.sourceColors){const wanted=Math.max(1,desiredFor(color)),def=Math.max(0,wanted-sources[color]),weight=Number(f.sourceWeights?.[color]??1);score+=(def/Math.max(1,wanted)*2.5+(demand.share[color]||0)*.85)*weight}if(f.sourceColors.length>1)score+=.16*Math.min(4,f.sourceColors.length-1);if(f.anyColor&&!f.conditional&&!f.filtering)score+=.24;if(f.fetch)score+=.12;if(f.effectiveTapped)score-=.30;if(f.entryTax)score-=.55;if(f.conditional)score-=.16;if(f.filtering)score-=f.filterActivationCost>=2?.36:.22;if(f.utility)score-=colorCount>=3?.55:.22;if(Number(c.themeAffinity||0)>=.55)score+=tf.lands?.28:.05;return score};
  while(selectedNonbasics.length<maxNonbasics){const available=nonbasics.filter(c=>{if((remaining.get(key(c.name))||0)<=0)return false;const f=facts.get(key(c.name));if(f.fetch&&fetchCount>=fetchCap)return false;if(f.effectiveTapped&&tapCount>=tapCap)return false;if(f.utility&&utilityCount>=utilityCap)return false;return scoreLand(c)>0.12});if(!available.length)break;available.sort((a,b)=>scoreLand(b)-scoreLand(a)||Number(b.themeAffinity||0)-Number(a.themeAffinity||0));const c=available[0],f=facts.get(key(c.name));selectedNonbasics.push(c);remaining.set(key(c.name),(remaining.get(key(c.name))||0)-1);if(f.fetch)fetchCount++;if(f.effectiveTapped)tapCount++;if(f.utility)utilityCount++;for(const col of f.sourceColors){rawSources[col]++;sources[col]+=Number(f.sourceWeights?.[col]??1)}}
  const selectedBasics=forcedBasics.map(p=>p.card),basicSlots=Math.max(0,target-selectedNonbasics.length-selectedBasics.length);
  for(const b of selectedBasics){const col=colors.find(c=>key(BASIC_BY_COLOR[c])===key(b.name))||inferProducedMana(b).find(c=>colors.includes(c));if(col){sources[col]++;rawSources[col]++}}
  if(!colors.length){const b=basics.find(c=>key(c.name)==="wastes")||basicCard("C");for(let i=0;i<basicSlots;i++)selectedBasics.push(b)}else{for(let i=0;i<basicSlots;i++){let bestColor=colors[0],bestScore=-Infinity;for(const c of colors){const wanted=Math.max(1,desiredFor(c)),def=Math.max(0,wanted-sources[c]),score=(def/wanted)*2.8+(demand.share[c]||0)*1.2-sources[c]/Math.max(1,target)*.15;if(score>bestScore){bestScore=score;bestColor=c}}const b=basics.find(x=>key(x.name)===key(BASIC_BY_COLOR[bestColor]))||basicCard(bestColor);selectedBasics.push(b);sources[bestColor]++;rawSources[bestColor]++}}
  // Feedback repair: landStyle defines the starting composition, not a hard wall. If
  // color requirements still miss, swap basics for reliable fixing when the collection
  // offers a measurable improvement. Every swap is kept in the diagnostic trail.
  const repairSwaps=[],repairFloor=Math.min(selectedBasics.length,repairBasicFloor(target,colorCount,settings));
  const basicColor=b=>colors.find(c=>key(BASIC_BY_COLOR[c])===key(b?.name))||inferProducedMana(b).find(c=>colors.includes(c))||null;
  const deficitScore=(src)=>colors.reduce((n,c)=>{const req=Math.max(1,Number(requirements.required[c]||0)),effective=Number(src[c]||0)+Number(nonlandSupport[c]||0);return n+Math.max(0,req-effective)/req},0);
  for(let pass=0;pass<10&&selectedBasics.length>repairFloor;pass++){
    const before=deficitScore(sources);if(before<=.001)break;let bestSwap=null;
    for(const candidate of nonbasics){
      if((remaining.get(key(candidate.name))||0)<=0)continue;const f=facts.get(key(candidate.name));if(!f||f.utility||Math.max(0,...Object.values(f.sourceWeights||{}))<.62)continue;
      if(f.fetch&&fetchCount>=fetchCap+1)continue;if(f.effectiveTapped&&tapCount>=tapCap+1)continue;if(f.utility&&utilityCount>=utilityCap)continue;
      for(let i=0;i<selectedBasics.length;i++){const out=selectedBasics[i];if(forcedBasicKeys.has(key(out.name)))continue;const outColor=basicColor(out),projected={...sources};if(outColor)projected[outColor]=Math.max(0,Number(projected[outColor]||0)-1);for(const c of f.sourceColors)projected[c]=Number(projected[c]||0)+Number(f.sourceWeights?.[c]??1);const after=deficitScore(projected),gain=before-after;if(gain<=.006)continue;const quality=gain+Math.max(0,scoreLand(candidate))*.012-(f.effectiveTapped?.012:0);if(!bestSwap||quality>bestSwap.quality)bestSwap={candidate,f,out,index:i,outColor,projected,gain,quality}}
    }
    if(!bestSwap)break;const {candidate,f,out,index,outColor,projected,gain}=bestSwap;selectedBasics.splice(index,1);selectedNonbasics.push(candidate);remaining.set(key(candidate.name),(remaining.get(key(candidate.name))||0)-1);Object.assign(sources,projected);if(outColor)rawSources[outColor]=Math.max(0,Number(rawSources[outColor]||0)-1);for(const c of f.sourceColors)rawSources[c]=Number(rawSources[c]||0)+1;if(f.fetch)fetchCount++;if(f.effectiveTapped)tapCount++;if(f.utility)utilityCount++;repairSwaps.push({out:out.name,in:candidate.name,gain:round(gain,3),sourceClass:f.sourceClass,colors:f.sourceColors});
  }
  const selected=[...selectedNonbasics,...selectedBasics],landDropProbabilities={turn2:round(hyperAtLeast(99,target,8,2),3),turn3:round(hyperAtLeast(99,target,9,3),3),turn4:round(hyperAtLeast(99,target,10,4),3)};
  const roundedSources=Object.fromEntries(COLORS.map(c=>[c,round(sources[c],1)])),effectiveSources=Object.fromEntries(COLORS.map(c=>[c,round(Number(sources[c]||0)+Number(nonlandSupport[c]||0),1)]));
  const sourceProbabilities={};for(const c of colors){const hard=requirements.hardest[c],pips=Math.min(3,Number(hard?.pips||1)),turn=Math.max(pips,Number(hard?.turn||3));sourceProbabilities[c]=round(hyperAtLeast(99,Math.floor(Number(effectiveSources[c]||0)),7+Math.max(0,turn-1),pips),3)}
  return {selected,sources:roundedSources,landSources:roundedSources,nonlandSupport,effectiveSources,nonlandSupportDetails:nonlandSupportInfo.details,rawSources,demand,requirements,sourceProbabilities,landDropProbabilities,basicCount:selectedBasics.length,nonbasicCount:selectedNonbasics.length,basicRatio:round(selectedBasics.length/Math.max(1,target),3),fetchCount,tappedCount:tapCount,utilityCount,repairSwaps,repairBasicFloor:repairFloor,selectedNonbasics:selectedNonbasics.map(c=>({name:c.name,...facts.get(key(c.name)),score:round(scoreLand(c),3)}))};
}

function aggregateCards(cards){const map=new Map();for(const c of cards){const k=key(c.name),cur=map.get(k);if(cur)cur.quantity++;else map.set(k,{...c,quantity:1})}return [...map.values()]}
function displayCount(n){return Number.isInteger(Number(n))?Number(n):round(n,1)}
function buildShortages(counts,targets,landCount,size,themeName,typeCounts,{comboWinContribution=0}={}){
  const effectiveFinishers=round(Number(counts.finishers||0)+Number(comboWinContribution||0),1);
  const rows=[["Ramp",counts.ramp,targets.ramp,"puntos de ramp fiable"],["Recursos",counts.resources,targets.resources,"puntos de recursos"],["Interacción",counts.interaction,targets.interaction,"puntos de interacción"],["Board wipes",counts.wipes,targets.wipes,"wipes"],["Protección / recursión",counts.resilience,targets.resilience,"puntos"],["Finishers",effectiveFinishers,targets.finishers,"cierres efectivos"],[`Theme · ${themeName||"seleccionado"}`,counts.theme,targets.theme,"cartas con evidencia temática"],["Tierras",landCount,targets.lands,"tierras"]];
  const out=rows.filter(([,found,target])=>found+0.05<target).map(([label,found,target,unit])=>({label,found:displayCount(found),target,severity:found<=target*.7?"high":"medium",message:label==="Finishers"&&comboWinContribution>0?`Objetivo: ${target} ${unit} · encontré ${displayCount(found)} contando ${displayCount(counts.finishers)} en cartas y 1 combo infinito completo.`:`Objetivo: ${target} ${unit} · encontré ${displayCount(found)}. ManaShelf completó los huecos con las mejores cartas legales y coherentes disponibles cuando fue posible.`}));
  for(const t of ["Creature","Instant","Sorcery","Artifact","Enchantment"]){const floor=targets.typeProfile?.floors?.[t]||0,found=typeCounts?.[t]||0;if(floor&&found<floor)out.push({label:`Estructura · ${t}`,found,target:floor,severity:found<=floor*.5?"high":"medium",message:`Piso estructural orientativo: ${floor} · encontré ${found}. No se forzó relleno fuera de la colección o identidad de color.`})}
  if(size<100)out.unshift({label:"Tamaño del mazo",found:size,target:100,severity:"high",message:`La colección legal disponible no alcanzó para completar 100 cartas: el resultado quedó en ${size}. No se inventaron cartas ni copias no básicas fuera de tu colección; las tierras básicas sí se consideran ilimitadas.`});
  return out;
}
function buildManaValidation(landPick,commanderColors=[]){
  const colors=(commanderColors||[]).filter(c=>COLORS.includes(c)),byColor={},warnings=[];
  for(const c of colors){
    const required=Number(landPick.requirements?.required?.[c]||0),effective=Number(landPick.effectiveSources?.[c]??landPick.sources?.[c]??0),landEffective=Number(landPick.landSources?.[c]??landPick.sources?.[c]??0),nonlandSupport=Number(landPick.nonlandSupport?.[c]||0),raw=Number(landPick.rawSources?.[c]||0),probability=Number(landPick.sourceProbabilities?.[c]||0),hardest=landPick.requirements?.hardest?.[c]||null;
    const meetsTarget=!required||effective+.05>=required,shortfall=Math.max(0,round(required-effective,1));
    byColor[c]={required,effective,landEffective,nonlandSupport,raw,probability,targetReliability:Number(landPick.requirements?.reliability||.85),meetsTarget,shortfall,hardest};
    if(!meetsTarget){
      const severity=probability<.65?"high":probability<.75?"medium":"low";
      warnings.push({label:`Maná · ${c}`,found:round(effective,1),target:required,severity,message:`La base aporta ${round(effective,1)} fuentes efectivas ${c} para una exigencia estimada de ${required}. Probabilidad aproximada para la restricción más exigente: ${Math.round(probability*100)}% (objetivo ${Math.round(Number(landPick.requirements?.reliability||.85)*100)}%).${hardest?.card?` Cuello de botella: ${hardest.card}.`:""}`});
    }
  }
  return {modelVersion:MANA_MODEL_VERSION,targetReliability:Number(landPick.requirements?.reliability||.85),validated:colors.every(c=>byColor[c]?.meetsTarget!==false),byColor,warnings};
}


function selectionStructureState(cards,themeName=""){
  const state={counts:Object.fromEntries(ROLE_KEYS.map(k=>[k,0])),typeCounts:Object.fromEntries(TYPE_KEYS.map(k=>[k,0])),traitCounts:Object.fromEntries(TRAIT_KEYS.map(k=>[k,0])),facetCounts:{},supportCounts:{creatures:0,artifacts:0,enchantments:0,tokens:0,graveyard:0,lands:0,tags:{}}};
  for(const c of cards||[]){incrementCounts(state.counts,c,1);incrementType(state.typeCounts,c,1);incrementTraits(state.traitCounts,c,1);incrementFacetCounts(state.facetCounts,c,themeName,1);incrementSupportCounts(state.supportCounts,c,1)}
  return state;
}
function castabilityProbability(card,landPick,commanderColors=[]){
  const parsed=parseManaCost(manaCostOf(card)),turn=expectedCastTurn(card);let probability=1,pressure=[];
  for(const color of commanderColors||[]){
    const pips=Math.min(3,Number(parsed.pips[color]||0));if(!pips)continue;
    let sources=Number(landPick.landSources?.[color]||landPick.sources?.[color]||0);
    for(const d of landPick.nonlandSupportDetails||[])if(d.color===color&&Number(d.turn||99)<=turn)sources+=Number(d.weight||0);
    const draws=7+Math.max(0,turn-1),p=hyperAtLeast(99,Math.floor(sources),draws,pips);
    probability=Math.min(probability,p);pressure.push({color,pips,turn,sources:round(sources,1),probability:round(p,3)});
  }
  return {probability:round(probability,3),pressure};
}
function structuralSwapAllowed(selected,outgoing,incoming,targets,themeName=""){
  if(!outgoing||!incoming||typeBucket(outgoing)!==typeBucket(incoming))return false;
  const current=selectionStructureState(selected,themeName),projectedCards=selected.map(c=>key(c.name)===key(outgoing.name)?incoming:c),projected=selectionStructureState(projectedCards,themeName);
  for(const role of ROLE_KEYS){
    const target=Number(targets[role]||0),before=Number(current.counts[role]||0),after=Number(projected.counts[role]||0),floor=Math.min(target,before);
    if(after+.05<floor)return false;
  }
  const themeFloor=Math.min(Number(targets.theme||0),Number(current.counts.theme||0));if(Number(projected.counts.theme||0)+.05<themeFloor)return false;
  const floors=targets.typeProfile?.floors||{},caps=targets.typeProfile?.caps||{},traitCaps=targets.typeProfile?.traitCaps||{};
  for(const t of TYPE_KEYS){const after=Number(projected.typeCounts[t]||0);if(after<Number(floors[t]||0)||after>Number(caps[t]??99))return false}
  for(const [tr,count] of Object.entries(projected.traitCounts))if(count>Number(traitCaps[tr]??99))return false;
  const facetTargets=themeFacetTargets(themeName);for(const [facet,target] of Object.entries(facetTargets)){const before=Number(current.facetCounts[facet]||0);if(before>=target&&Number(projected.facetCounts[facet]||0)<target)return false}
  return true;
}
function intrinsicCardQuality(card,settings,commanderColors,themeName=""){
  const roleBest=Math.max(0,...ROLE_KEYS.map(r=>roleQuality(card,r))),roleSum=ROLE_KEYS.reduce((n,r)=>n+Math.min(1,roleQuality(card,r)),0),eff=Number(card?.efficiencyScore||0),theme=Number(card?.effectiveThemeAffinity??card?.themeAffinity??0),cmd=Number(card?.commanderAffinity||0),edh=Math.min(1,Math.max(0,edhrecPower(card)));
  return clamp(roleBest*.34+Math.min(1,roleSum/2)*.12+eff*.20+theme*.12+cmd*.08+edh*.14,0,1.2);
}
function roleRedundancyScore(card,state,targets){
  let weighted=0,total=0;for(const role of ROLE_KEYS){const contribution=roleContribution(card,role);if(contribution<=0)continue;const surplus=Math.max(0,Number(state.counts?.[role]||0)-Number(targets?.[role]||0)),share=Math.min(1,surplus/Math.max(.5,contribution));weighted+=share*contribution;total+=contribution}return total?clamp(weighted/total,0,1):.35;
}
function maxColoredPips(card,commanderColors=[]){const p=parseManaCost(manaCostOf(card));return Math.max(0,...commanderColors.map(c=>Number(p.pips[c]||0)))}
function tacticalRoleTags(card){
  const ids=new Set(roleIds(card)),out=new Set();
  if(ids.has("counterspell"))out.add("counterspell");
  if(ids.has("board_wipe")||ids.has("mass_removal")||ids.has("partial_sweeper"))out.add("sweeper");
  if(["removal","creature_removal","artifact_removal","enchantment_removal","planeswalker_removal","land_interaction","graveyard_hate"].some(x=>ids.has(x)))out.add("removal");
  if(ids.has("tutor"))out.add("tutor");
  if(["card_draw","card_selection","card_advantage","impulse_draw"].some(x=>ids.has(x)))out.add("card-resource");
  if(ids.has("ramp")||ids.has("land_tutor"))out.add("ramp");
  if(ids.has("protection"))out.add("protection");
  if(ids.has("recursion"))out.add("recursion");
  if(ids.has("finisher"))out.add("finisher");
  if(ids.has("spell_copy")||ids.has("clone"))out.add("copy-engine");
  return out;
}
function tacticalSwapAllowed(outgoing,incoming,{severe=false,pips=0,redundancy=0}={}){
  const out=tacticalRoleTags(outgoing);if(!out.size)return true;const inc=tacticalRoleTags(incoming);
  if([...out].some(x=>inc.has(x)))return true;
  // Only a genuinely severe hard-pip card whose structural role is already redundant may
  // be repurposed into a different tactical job. Ordinary UU/RR interaction must keep its job.
  return Boolean(severe&&pips>=3&&redundancy>=.55);
}

function repairCastability({selected,pool,lands,landTarget,commanderMeta,commanderColors,settings,themeName,targets,comboPackage,selectionTrace}){
  let cards=[...(selected||[])],trace={...(selectionTrace||{})},landPick=selectLands(lands,landTarget,cards,commanderMeta,commanderColors,settings,themeName,comboPackage),swaps=[];
  const locked=new Set((comboPackage?.nonCommanderPieces||[]).map(p=>key(p.name))),maxPasses=5;
  for(let pass=0;pass<maxPasses;pass++){
    const selectedKeys=new Set(cards.map(c=>key(c.name))),state=selectionStructureState(cards,themeName);let best=null;
    for(const outgoing of cards){
      if(locked.has(key(outgoing.name)))continue;
      const cast=castabilityProbability(outgoing,landPick,commanderColors);if(cast.probability>=.75)continue;
      const pips=maxColoredPips(outgoing,commanderColors);if(pips<2&&cast.probability>=.50)continue;
      const outTheme=Number(outgoing.effectiveThemeAffinity??outgoing.themeAffinity??0),outScore=candidateDynamicScore(outgoing,state,targets,settings,commanderColors,themeName),outQuality=intrinsicCardQuality(outgoing,settings,commanderColors,themeName),redundancy=roleRedundancyScore(outgoing,state,targets);
      for(const incoming of pool){
        if(selectedKeys.has(key(incoming.name))||isLand(incoming)||!structuralSwapAllowed(cards,outgoing,incoming,targets,themeName))continue;
        const inCast=castabilityProbability(incoming,landPick,commanderColors),castGain=inCast.probability-cast.probability;if(castGain<.10)continue;
        const inTheme=Number(incoming.effectiveThemeAffinity??incoming.themeAffinity??0);if(outTheme>=.70&&inTheme+0.18<outTheme)continue;
        const inScore=candidateDynamicScore(incoming,state,targets,settings,commanderColors,themeName),scoreLoss=Math.max(0,outScore-inScore);if(scoreLoss>.22)continue;
        const inQuality=intrinsicCardQuality(incoming,settings,commanderColors,themeName),qualityLoss=Math.max(0,outQuality-inQuality),severe=cast.probability<.48||pips>=3;
        if(!tacticalSwapAllowed(outgoing,incoming,{severe,pips,redundancy}))continue;
        // Normal UU/RR cards need a true near-peer replacement. A larger concession is only
        // allowed for severe/triple-pip bottlenecks, where redundant roles are intentionally
        // preferred as cuts instead of sacrificing premium interaction to optimize one metric.
        const allowedQualityLoss=severe?.15:(redundancy>=.70?.06:.04);if(qualityLoss>allowedQualityLoss)continue;
        const bestOutRole=Math.max(...ROLE_KEYS.map(r=>roleQuality(outgoing,r))),bestInRole=Math.max(...ROLE_KEYS.map(r=>roleQuality(incoming,r)));if(!severe&&bestOutRole>=.88&&bestInRole+0.06<bestOutRole)continue;
        const pressureBonus=Math.max(0,.75-cast.probability)*.20,pipBonus=Math.max(0,pips-1)*.075,redundancyBonus=redundancy*.15;
        const quality=castGain+pressureBonus+pipBonus+redundancyBonus-scoreLoss*.30-qualityLoss*.90+Math.max(0,inTheme-outTheme)*.04;
        if(!best||quality>best.quality)best={outgoing,incoming,cast,inCast,castGain,scoreLoss,outQuality,inQuality,qualityLoss,redundancy,pips,quality};
      }
    }
    if(!best)break;
    cards=cards.map(c=>key(c.name)===key(best.outgoing.name)?best.incoming:c);
    trace[key(best.incoming.name)]={phase:"mana-castability-repair",focusRole:null,focusFacet:null,replaces:best.outgoing.name,gain:round(best.castGain,3),castabilityBefore:best.cast.probability,castabilityAfter:best.inCast.probability,qualityBefore:round(best.outQuality,3),qualityAfter:round(best.inQuality,3),qualityLoss:round(best.qualityLoss,3),redundancy:round(best.redundancy,3),pips:best.pips,tacticalOut:[...tacticalRoleTags(best.outgoing)],tacticalIn:[...tacticalRoleTags(best.incoming)]};
    delete trace[key(best.outgoing.name)];
    swaps.push({out:best.outgoing.name,in:best.incoming.name,castabilityBefore:best.cast.probability,castabilityAfter:best.inCast.probability,gain:round(best.castGain,3),qualityBefore:round(best.outQuality,3),qualityAfter:round(best.inQuality,3),qualityLoss:round(best.qualityLoss,3),redundancy:round(best.redundancy,3),pips:best.pips,tacticalOut:[...tacticalRoleTags(best.outgoing)],tacticalIn:[...tacticalRoleTags(best.incoming)]});
    landPick=selectLands(lands,landTarget,cards,commanderMeta,commanderColors,settings,themeName,comboPackage);
  }
  return {selected:cards,selectionTrace:trace,landPick,swaps};
}

function validateFinalDeck(mainboard,commanderColors,settings){
  const total=(mainboard||[]).reduce((n,c)=>n+Math.max(1,Number(c.quantity||1)),0),commanderRows=(mainboard||[]).filter(c=>c.isCommander),offColor=[],illegal=[],singleton=[],ownership=[],availability=[];
  for(const c of (mainboard||[])){
    const q=Math.max(1,Number(c.quantity||1)),colors=c.meta?.colorIdentity||c.colorIdentity||[];
    if(!colorSubset(colors,commanderColors))offColor.push({name:c.name,colorIdentity:colors});
    if(c.meta?.legalities?.commander&&c.meta.legalities.commander!=="legal")illegal.push({name:c.name,status:c.meta.legalities.commander});
    if(!c.isCommander&&!allowsMultiple(c)&&q>1)singleton.push({name:c.name,quantity:q});
    if(!c.isCommander&&!isBasic(c)&&!c.syntheticBasic&&q>Number(c.ownedQuantity||0))ownership.push({name:c.name,quantity:q,owned:Number(c.ownedQuantity||0)});
    if(settings.protectExistingDecks&&!c.isCommander&&!isBasic(c)&&!c.syntheticBasic&&q>Number(c.availableQuantity??c.ownedQuantity??0))availability.push({name:c.name,quantity:q,available:Number(c.availableQuantity??0)});
  }
  const checks={deckSize:total===100,commanderExactlyOne:commanderRows.length===1&&Number(commanderRows[0]?.quantity||0)===1,colorIdentity:offColor.length===0,commanderLegal:illegal.length===0,singleton:singleton.length===0,ownership:ownership.length===0,availabilityProtected:settings.protectExistingDecks?availability.length===0:true};
  const hardValid=checks.commanderExactlyOne&&checks.colorIdentity&&checks.commanderLegal&&checks.singleton&&checks.ownership&&checks.availabilityProtected;
  return {valid:checks.deckSize&&hardValid,hardValid,checks,violations:{offColor,illegal,singleton,ownership,availability}};
}

export function buildCollectionDeck({commander,commanderMeta={},theme=null,candidates=[],comboCandidates=[],settings:rawSettings={}}={}){
  const settings=normalizedSettings(rawSettings),commanderColors=commanderMeta.colorIdentity||[],themeName=theme?.name||"",withBasics=injectUnlimitedBasics(candidates,commanderColors),targets=targetProfile(commanderMeta,settings,themeName);
  const legal=withBasics.filter(c=>{
    if(!c?.name||key(c.name)===key(commander))return false;
    const basic=isBasic(c),owned=Number(c.ownedQuantity||c.quantity||0)>0,available=c.availableQuantity==null?owned:Number(c.availableQuantity||0)>0;
    if(!basic&&(!owned||(settings.protectExistingDecks&&!available)))return false;
    return colorSubset(c.meta?.colorIdentity||c.colorIdentity||[],commanderColors);
  });
  const classified=applySemanticClassification(legal.map(c=>({...c,quantity:1,meta:c.meta||{}})),{commanderName:commander}),byKey=new Map(legal.map(c=>[key(c.name),c])),pool=classified.map(c=>{const merged={...byKey.get(key(c.name)),...c,meta:c.meta||byKey.get(key(c.name))?.meta||{}};const evidence=themeEvidence(merged,themeName);return {...merged,contextThemeAffinity:evidence.context,archetypeAffinity:evidence.archetype,effectiveThemeAffinity:evidence.effective,themeEvidenceMode:evidence.explicit?"archetype+context":"context"}});
  const comboPackage=chooseComboPackage(comboCandidates,pool,settings,themeName,commander,commanderColors),lands=pool.filter(isLand),nonlands=pool.filter(c=>!isLand(c)),baseLandTarget=targets.lands;
  if(comboPackage?.infinite&&settings.comboPolicy==="infinite")targets.finishers=Math.min(targets.finishers,1);
  let picked=selectNonlands(nonlands,targets,settings,commanderColors,themeName,comboPackage),landAdjustment=adjustLandTargetFromSelection(baseLandTarget,picked.selected,targets,settings,themeName);
  for(let pass=0;pass<3&&landAdjustment.target!==targets.lands;pass++){targets.lands=landAdjustment.target;targets.nonlands=99-targets.lands;targets.typeProfile=typeStructureProfile(themeName,targets.nonlands);picked=selectNonlands(nonlands,targets,settings,commanderColors,themeName,comboPackage);landAdjustment=adjustLandTargetFromSelection(baseLandTarget,picked.selected,targets,settings,themeName)}
  targets.lands=landAdjustment.target;targets.nonlands=99-targets.lands;targets.typeProfile=typeStructureProfile(themeName,targets.nonlands);if(picked.selected.length!==targets.nonlands)picked=selectNonlands(nonlands,targets,settings,commanderColors,themeName,comboPackage);
  const castabilityRepair=repairCastability({selected:picked.selected,pool:nonlands,lands,landTarget:targets.lands,commanderMeta,commanderColors,settings,themeName,targets,comboPackage,selectionTrace:picked.selectionTrace});
  picked={...picked,selected:castabilityRepair.selected,selectionTrace:castabilityRepair.selectionTrace};
  const landPick=castabilityRepair.landPick;let chosen=[...picked.selected,...landPick.selected];
  chosen=chosen.slice(0,99);const aggregated=aggregateCards(chosen);
  const commanderCard={name:commander,quantity:1,ownedQuantity:Number(commanderMeta.ownedQuantity||0),availableQuantity:Number(commanderMeta.availableQuantity||commanderMeta.ownedQuantity||0),meta:commanderMeta,isCommander:true,themeAffinity:1,contextThemeAffinity:1,archetypeAffinity:1,effectiveThemeAffinity:1,commanderAffinity:1,semantic:applySemanticClassification([{name:commander,quantity:1,meta:commanderMeta}],{commanderName:commander})[0]?.semantic};
  const mainboard=[commanderCard,...aggregated].map(c=>{const category=cardCategory(c),sr=strongestRole(c);return {...c,primaryCategory:category,categories:[category],typeLine:typeOf(c),cmc:cmcOf(c),imageNormal:c.meta?.normal||c.meta?.large||c.meta?.small||c.imageNormal||null,selectionScore:round(baseCandidateScore(c,settings,commanderColors),3),selectionContextScore:round(picked.selectionTrace?.[key(c.name)]?.contextScoreAtSelection??baseCandidateScore(c,settings,commanderColors),3),selectionPhase:c.isCommander?"commander":c.syntheticBasic?"mana-basic":picked.selectionTrace?.[key(c.name)]?.phase||"mana-land",selectionTrace:c.isCommander?{phase:"commander"}:c.syntheticBasic?{phase:"mana-basic"}:picked.selectionTrace?.[key(c.name)]||{phase:"mana-land"},selectionReason:c.isCommander?"Commander":c.comboPiece?`Combo ${c.comboPiece.comboId} · pieza ${c.comboPiece.index}/${c.comboPiece.total}${c.comboPiece.infinite?" · infinito":""}`:c.syntheticBasic?"Básica ilimitada · asignada por demanda de color":Number(c.effectiveThemeAffinity ?? c.themeAffinity ?? 0)>=.62?`Alta afinidad de arquetipo con ${themeName||"el theme"}`:sr.quality>=.55?`${category} · calidad ${Math.round(sr.quality*100)}%`:category,comboPiece:c.comboPiece||null,contextThemeAffinity:round(contextThemeAffinity(c),3),archetypeAffinity:round(c.archetypeAffinity||0,3),effectiveThemeAffinity:round(c.effectiveThemeAffinity ?? c.themeAffinity ?? 0,3),themeEvidenceMode:c.themeEvidenceMode||"context",roleQuality:sr.quality,roleQualityName:sr.role,semanticRoles:roleIds(c),semanticFacts:c.semantic?.facts||{},semanticDependencies:c.semantic?.dependencies||[],semanticGlobalDependencies:c.semantic?.globalDependencies||[],semanticThemeDependencies:c.semantic?.themeDependencies||[],semanticRoleDependencies:c.semantic?.roleDependencies||{},semanticRoleDependencyGroups:c.semantic?.roleDependencyGroups||{},semanticProduces:c.semantic?.produces||[],semanticBenefitsFrom:c.semantic?.benefitsFrom||[],roleQualities:Object.fromEntries(ROLE_KEYS.map(r=>[r,round(roleQuality(c,r),3)])),themeFacets:themeFacetTags(c,themeName)}});
  const actualCounts={ramp:0,resources:0,interaction:0,wipes:0,resilience:0,finishers:0,theme:0},actualTypes=Object.fromEntries(TYPE_KEYS.map(k=>[k,0])),actualTraits=Object.fromEntries(TRAIT_KEYS.map(k=>[k,0])),actualFacets={},actualSupport={creatures:0,artifacts:0,enchantments:0,tokens:0,graveyard:0,lands:0,tags:{}};for(const c of chosen)if(!isLand(c)){incrementCounts(actualCounts,c,1);incrementType(actualTypes,c,1);incrementTraits(actualTraits,c,1);incrementFacetCounts(actualFacets,c,themeName,1);incrementSupportCounts(actualSupport,c,1)}
  for(const k of ROLE_KEYS)actualCounts[k]=round(actualCounts[k],1);
  const landCount=chosen.filter(isLand).length,size=mainboard.reduce((n,c)=>n+Number(c.quantity||1),0),occupiedCards=mainboard.filter(c=>!c.isCommander&&!c.syntheticBasic&&Number(c.availableQuantity||0)<=0&&Number(c.ownedQuantity||0)>0).reduce((n,c)=>n+Number(c.quantity||1),0),nonlandChosen=chosen.filter(c=>!isLand(c)),themeCount=nonlandChosen.filter(c=>Number(c.effectiveThemeAffinity ?? c.themeAffinity ?? 0)>=.45).length,avgMv=nonlandChosen.length?nonlandChosen.reduce((n,c)=>n+cmcOf(c),0)/nonlandChosen.length:0;
  const manaValidation=buildManaValidation(landPick,commanderColors),finalValidation=validateFinalDeck(mainboard,commanderColors,settings),comboValidation=comboCompleteness(mainboard,comboPackage,settings.comboPolicy),comboWinContribution=comboPackage?.infinite&&comboValidation.complete?1:0;
  if(!finalValidation.hardValid)throw new Error(`LAB 2 abortó el resultado por una violación de invariantes finales: ${JSON.stringify(finalValidation.violations)}`);
  if(comboValidation.selected&&!comboValidation.complete)throw new Error(`LAB 2 abortó el resultado porque un combo seleccionado quedó incompleto: ${JSON.stringify(comboValidation.missing)}`);
  const comboShortages=[];if(settings.comboPolicy==="infinite"&&!comboPackage)comboShortages.push({label:"Combo infinito",found:0,target:1,severity:"high",message:"No encontré un combo infinito exacto y completo de Commander Spellbook cuyas piezas estén disponibles en esta colección. No se insertaron piezas sueltas."});else if(settings.comboPolicy==="synergistic"&&!comboPackage)comboShortages.push({label:"Combo sinérgico",found:0,target:1,severity:"low",message:"No encontré un paquete de combo exacto, completo y suficientemente coherente con este mazo. El build continuó sin forzar piezas aisladas."});
  const shortages=[...buildShortages(actualCounts,targets,landCount,size,themeName,actualTypes,{comboWinContribution}),...comboShortages,...manaValidation.warnings],deckSignature=JSON.stringify(mainboard.map(c=>[c.name,c.quantity,c.primaryCategory])),metrics=buildDeckMetrics(mainboard.map(c=>({name:c.name,quantity:c.quantity,meta:c.meta})),{commanderName:commander,iterations:1800,deckSignature:`lab2:${deckSignature}`});
  const finalState={counts:actualCounts,typeCounts:actualTypes,traitCounts:actualTraits,facetCounts:actualFacets,supportCounts:actualSupport},selectedNames=new Set(mainboard.map(c=>key(c.name))),diagnosticCandidates=pool.filter(c=>!isLand(c)).map(c=>({name:c.name,type:typeBucket(c),traits:cardTraits(c),typeLine:typeOf(c),cmc:cmcOf(c),manaCost:manaCostOf(c),roles:roleIds(c),semanticFacts:c.semantic?.facts||{},semanticDependencies:c.semantic?.dependencies||[],semanticGlobalDependencies:c.semantic?.globalDependencies||[],semanticThemeDependencies:c.semantic?.themeDependencies||[],semanticRoleDependencies:c.semantic?.roleDependencies||{},semanticRoleDependencyGroups:c.semantic?.roleDependencyGroups||{},semanticProduces:c.semantic?.produces||[],semanticBenefitsFrom:c.semantic?.benefitsFrom||[],roleFlags:roleFlags(c),roleQuality:Object.fromEntries(ROLE_KEYS.map(r=>[r,round(roleQuality(c,r),3)])),themeFacets:themeFacetTags(c,themeName),comboPiece:c.comboPiece||null,themeAffinity:round(c.themeAffinity||0,3),contextThemeAffinity:round(contextThemeAffinity(c),3),archetypeAffinity:round(c.archetypeAffinity||0,3),effectiveThemeAffinity:round(c.effectiveThemeAffinity ?? c.themeAffinity ?? 0,3),themeEvidenceMode:c.themeEvidenceMode||"context",commanderAffinity:round(c.commanderAffinity||0,3),edhrecThemeInclusion:round(c.edhrecThemeInclusion||0,3),edhrecThemeSynergy:round(c.edhrecThemeSynergy||0,3),edhrecBaseInclusion:round(c.edhrecBaseInclusion||0,3),edhrecBaseSynergy:round(c.edhrecBaseSynergy||0,3),edhrecPower:round(edhrecPower(c),3),efficiencyScore:round(c.efficiencyScore||0,3),functionalDensity:round(functionalDensity(c),3),curveFit:round(curveFit(c,settings),3),manaFit:round(manaFit(c,commanderColors),3),dependencyPenalty:round(dependencyPenalty(c,settings),3),baseScore:round(baseCandidateScore(c,settings,commanderColors),3),finalContextScore:round(candidateDynamicScore(c,finalState,targets,settings,commanderColors,themeName),3),ownedQuantity:Number(c.ownedQuantity||0),availableQuantity:Number(c.availableQuantity||0),selected:selectedNames.has(key(c.name)),decision:selectedNames.has(key(c.name))?"selected":"not-selected"})).sort((a,b)=>Number(b.selected)-Number(a.selected)||b.finalContextScore-a.finalContextScore||b.baseScore-a.baseScore);
  return {
    version:COLLECTION_BUILDER_VERSION,commander,theme:theme||null,settings,targets,mainboard,size,
    summary:{lands:landCount,nonlands:size-1-landCount,avgCmc:round(avgMv,2),themeCards:themeCount,themeDensity:round(themeCount/Math.max(1,size-1-landCount),3),occupiedCards,freeCards:Math.max(0,size-1-occupiedCards),commanderOwned:Number(commanderMeta.ownedQuantity||0)>0,typeCounts:actualTypes,traitCounts:actualTraits,basicLands:landPick.basicCount,nonbasicLands:landPick.nonbasicCount},
    roleCounts:actualCounts,typeCounts:actualTypes,traitCounts:actualTraits,themeFacetCounts:actualFacets,
    winConditions:{target:targets.finishers,cardFinishers:actualCounts.finishers,infiniteCombo:comboWinContribution,effective:round(Number(actualCounts.finishers||0)+comboWinContribution,1),strategySatisfied:settings.comboPolicy==="off"?true:comboValidation.complete},
    combo:comboPackage?{engineVersion:COMBO_ENGINE_VERSION,policy:settings.comboPolicy,id:comboPackage.id,infinite:Boolean(comboPackage.infinite),pieces:(comboPackage.pieces||[]).map(p=>({name:p.name,quantity:p.quantity,mustBeCommander:Boolean(p.mustBeCommander)})),produces:comboPackage.produces||[],manaNeeded:comboPackage.manaNeeded||null,manaValueNeeded:comboPackage.manaValueNeeded||null,easyPrerequisites:comboPackage.easyPrerequisites||null,notablePrerequisites:comboPackage.notablePrerequisites||null,popularity:comboPackage.popularity||0,url:comboPackage.url||null,score:comboPackage.score,themeMean:comboPackage.themeMean,commanderMean:comboPackage.commanderMean,complete:comboValidation.complete}:null,
    mana:{modelVersion:MANA_MODEL_VERSION,sources:landPick.sources,landSources:landPick.landSources,nonlandSupport:landPick.nonlandSupport,effectiveSources:landPick.effectiveSources,rawSources:landPick.rawSources,demand:landPick.demand,requirements:landPick.requirements,sourceProbabilities:landPick.sourceProbabilities,landDropProbabilities:landPick.landDropProbabilities,targetAdjustment:landAdjustment,basicCount:landPick.basicCount,nonbasicCount:landPick.nonbasicCount,basicRatio:landPick.basicRatio,fetchCount:landPick.fetchCount,tappedCount:landPick.tappedCount,utilityCount:landPick.utilityCount,repairSwaps:landPick.repairSwaps,castabilitySwaps:castabilityRepair.swaps,repairBasicFloor:landPick.repairBasicFloor,nonlandSupportDetails:landPick.nonlandSupportDetails,selectedNonbasics:landPick.selectedNonbasics,validation:manaValidation},
    shortages,metrics,complete:size===100&&finalValidation.valid&&comboValidation.complete,invariants:{...finalValidation.checks,manaTargetMet:manaValidation.validated,comboComplete:comboValidation.complete},validation:{...finalValidation,combo:comboValidation},
    audit:{candidatePool:pool.length,landCandidates:lands.length,nonlandCandidates:nonlands.length,selectedUnique:mainboard.length,typeProfile:targets.typeProfile,traitCounts:actualTraits,themeFacetCounts:actualFacets,supportCounts:actualSupport,structuralTradeoffs:picked.structuralTradeoffs||[],candidateDiagnostics:diagnosticCandidates,notes:["Las tierras básicas se consideran de disponibilidad ilimitada dentro de la identidad de color del Commander.","La cantidad de tierras se recalcula con curva real, coste del Commander y ramp temprano de calidad suficiente.","Las fuentes de color condicionales o que filtran maná aportan menos que una fuente irrestricta; produced_mana no se trata automáticamente como acceso perfecto.","Artifact Creature cuenta como Creature para estructura y también como Artifact para saturación; los tipos superpuestos no pueden eludir los topes.","Ramp, recursos e interacción se cubren por calidad del rol: una pieza condicionada no vale lo mismo que una opción barata y fiable.","Los themes con perfil explícito usan afinidad semántica de arquetipo para cumplir su cuota; EDHREC/contexto ordena opciones coherentes pero no fabrica pertenencia temática.","Los pisos estructurales alcanzables tienen prioridad sobre la densidad temática blanda; si una reparación sacrifica theme para recuperar un rol, el trade-off queda auditado.","Los combos de Commander Spellbook se tratan como paquetes atómicos: todas las piezas exactas verificables o ninguna; templates genéricos no se asumen.","Después de construir la base de maná, el builder puede reemplazar cartas prescindibles con pips difíciles por alternativas más casteables sólo si preservan estructura y función táctica; una excepción de rol sólo se admite para cuellos severos de triple pip con redundancia demostrable. Cada swap queda auditado.","El resultado se vuelve a auditar con Deck Health y Deck Metrics."]}
  };
}
