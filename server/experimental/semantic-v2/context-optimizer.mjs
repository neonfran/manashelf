import {deriveRoleViews,ROLE_NAMES} from "./role-views.mjs";
import {deriveDependencyView} from "./dependency-view.mjs";
import {deriveThemeView} from "./theme-view.mjs";
import {deriveManaView} from "./mana-view.mjs";
import {deriveCastabilityView} from "./castability-view.mjs";
import {structuredAttachmentNeed} from "./structured-runtime-semantics.mjs";

export const CONTEXT_OPTIMIZER_VERSION=2;
const arr=x=>Array.isArray(x)?x:[];
const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
const uniq=x=>[...new Set(arr(x).filter(Boolean))];
const COLORS=["W","U","B","R","G","C"];
const PRODUCED_SET_CACHE=new WeakMap(),ACCESSIBLE_FACE_CACHE=new WeakMap(),SUPPORT_SIGNAL_CACHE=new WeakMap();

export const DEFAULT_CONTEXT_POLICY=Object.freeze({
  dependencyReliabilityFloor:3,
  commanderDependencyFloor:1,
  weights:Object.freeze({dependency:0.28,support:0.20,commander:0.16,theme:0.16,roles:0.12,coverage:0.08}),
  unresolvedPenalty:0.12,
  colorPressurePenalty:0.10
});

function coverageWeight(card){const s=card?.coverage?.status;return s==="supported"?1:s==="partial"?.74:.35;}
function roleScore(view){return view?.adjudication==="positive"?clamp(view.potentialScore):0;}

function withStructuredDependency(card,dependency){
  const signal=structuredAttachmentNeed(card);if(!signal||arr(dependency?.externalNeeds).includes(signal))return dependency;
  const value=signal.slice("permanent:".length),predicate={op:"predicate",kind:"controls_permanent",value},capabilityId="structured:attachment-target",atom={signal,dependencyClass:"package",predicate,count:null,negated:false,logic:"and",path:"0",source:"structured_semantic"};
  const capability={capabilityId,action:"attachment_target",operator:"require",access:"default",produces:[],packageNeeds:[signal],packageAtoms:[atom],environmentNeeds:[],stateNeeds:[],internalConstraints:[],unresolvedConditions:[],negatedDependencies:[],requirementLogic:predicate,conditionLogic:{op:"true"},satisfiedBySelf:[],externalNeeds:[signal]};
  const demands=[...arr(dependency?.demands),{signal,consumers:[{capabilityId,count:null,source:"structured_semantic",logic:"and",path:"0"}],requiredCount:null}];
  const packageNeeds=uniq([...arr(dependency?.packageNeeds),signal]),externalNeeds=uniq([...arr(dependency?.externalNeeds),signal]),capabilities=[...arr(dependency?.capabilities),capability],summary={...(dependency?.summary||{}),packageNeedCount:packageNeeds.length,externalNeedCount:externalNeeds.length,selfSupportedNeedCount:Math.max(0,packageNeeds.length-externalNeeds.length),commanderDependent:packageNeeds.includes("commander:controlled")};
  return {...dependency,packageNeeds,externalNeeds,demands,capabilities,summary,structuredSupplement:{version:1,signals:[signal]}};
}

export function deriveContextProfile(card){
  // LAB3 runtime records materialize these views at build time. Semantic-v2 source
  // cards do not, so the optimizer derives them on demand during offline audits.
  const roles=card?.views?.roles||deriveRoleViews(card),baseDependency=card?.views?.dependency||deriveDependencyView(card),dependency=withStructuredDependency(card,baseDependency),theme=card?.views?.theme||deriveThemeView(card),mana=card?.views?.mana||deriveManaView(card),castability=card?.views?.castability||deriveCastabilityView(card);
  return {oracleId:card.oracleId,name:card.name,card,roles,roleScores:Object.fromEntries(ROLE_NAMES.map(r=>[r,roleScore(roles[r])])),dependency,theme,mana,castability,coverageWeight:coverageWeight(card)};
}

function accessibleFaces(profile){
  if(profile&&typeof profile==="object"&&ACCESSIBLE_FACE_CACHE.has(profile))return ACCESSIBLE_FACE_CACHE.get(profile);
  const faces=arr(profile?.card?.faces).filter(f=>["default","alternative_entry"].includes(f.access?.kind));
  if(profile&&typeof profile==="object")ACCESSIBLE_FACE_CACHE.set(profile,faces);return faces;
}
function producedSet(profile){if(profile&&typeof profile==="object"&&PRODUCED_SET_CACHE.has(profile))return PRODUCED_SET_CACHE.get(profile);const set=new Set(profile?.dependency?.produces||[]);if(profile&&typeof profile==="object")PRODUCED_SET_CACHE.set(profile,set);return set;}
function profileSupportsUncached(profile,signal){
  const produced=producedSet(profile);
  if(produced.has(signal))return 1;
  if(signal==="card:instant_sorcery"&&(produced.has("card:type:instant")||produced.has("card:type:sorcery")))return 1;
  if(signal==="event:instant_sorcery_spell_cast"&&(produced.has("card:type:instant")||produced.has("card:type:sorcery")))return 1;
  if(signal==="card:artifact_creature"&&(produced.has("card:type:artifact")||produced.has("card:type:creature")))return 1;
  if(signal==="card:permanent"&&accessibleFaces(profile).some(f=>arr(f.cardTypes).some(t=>["Creature","Artifact","Enchantment","Planeswalker","Battle","Land"].includes(t))))return 1;
  if(signal==="card:noncreature_nonland"&&accessibleFaces(profile).some(f=>!arr(f.cardTypes).includes("Creature")&&!arr(f.cardTypes).includes("Land")))return 1;
  if(signal==="permanent:basic_land_type_diversity"&&accessibleFaces(profile).some(f=>arr(f.cardTypes).includes("Land")&&arr(f.subtypes).some(st=>["Plains","Island","Swamp","Mountain","Forest"].includes(st))))return 1;
  if(signal==="package:shared_creature_type"&&accessibleFaces(profile).some(f=>arr(f.cardTypes).includes("Creature")&&arr(f.subtypes).length))return 1;
  if(signal==="zone:your_graveyard:card_type_diversity"&&accessibleFaces(profile).some(f=>arr(f.cardTypes).some(t=>!["Legendary","Basic","Snow","World","Ongoing"].includes(t))))return 1;
  if(signal==="zone:your_graveyard:mana_value_diversity"&&accessibleFaces(profile).some(f=>Number.isFinite(Number(f.manaValue))))return 1;
  if(signal==="permanent:token"&&produced.has("event:token_created"))return .95;
  if(signal==="zone:your_graveyard"||signal==="zone:graveyard"){
    if(produced.has("event:discard")||produced.has("event:mill"))return .75;
    if(produced.has("event:sacrifice")||produced.has("event:creature_death"))return .55;
  }
  if(signal==="event:creature_death"&&produced.has("event:sacrifice"))return .85;
  return 0;
}
function profileSupports(profile,signal){
  if(!profile||typeof profile!=="object")return profileSupportsUncached(profile,signal);
  let cache=SUPPORT_SIGNAL_CACHE.get(profile);if(!cache){cache=new Map();SUPPORT_SIGNAL_CACHE.set(profile,cache);}if(cache.has(signal))return cache.get(signal);
  const value=profileSupportsUncached(profile,signal);cache.set(signal,value);return value;
}

function buildSupply(profiles){
  const allSignals=new Set(profiles.flatMap(p=>[...p.dependency.produces,...p.dependency.packageNeeds]));
  const counts=new Map();
  for(const signal of allSignals){let n=0;for(const p of profiles)n+=profileSupports(p,signal);counts.set(signal,n);}
  // Composite / derived demand signals are added lazily but materializing these makes diagnostics explicit.
  for(const signal of ["card:instant_sorcery","card:artifact_creature","card:permanent","card:noncreature_nonland","zone:your_graveyard","zone:graveyard","event:creature_death","permanent:token"]){let n=0;for(const p of profiles)n+=profileSupports(p,signal);if(n>0)counts.set(signal,n);}

  // Diversity requirements are aggregate properties.  Count unique semantic categories rather than
  // raw card copies so five Islands cannot satisfy five distinct basic land types, for example.
  if(allSignals.has("permanent:basic_land_type_diversity")){
    const types=new Set();for(const p of profiles)for(const f of accessibleFaces(p))if(arr(f.cardTypes).includes("Land"))for(const st of arr(f.subtypes))if(["Plains","Island","Swamp","Mountain","Forest"].includes(st))types.add(st);
    counts.set("permanent:basic_land_type_diversity",types.size);
  }
  if(allSignals.has("zone:your_graveyard:card_type_diversity")){
    const types=new Set();for(const p of profiles)for(const f of accessibleFaces(p))for(const t of arr(f.cardTypes))if(!["Legendary","Basic","Snow","World","Ongoing"].includes(t))types.add(t);
    counts.set("zone:your_graveyard:card_type_diversity",types.size);
  }
  if(allSignals.has("zone:your_graveyard:mana_value_diversity")){
    const values=new Set();for(const p of profiles)for(const f of accessibleFaces(p))if(Number.isFinite(Number(f.manaValue)))values.add(Number(f.manaValue));
    counts.set("zone:your_graveyard:mana_value_diversity",values.size);
  }
  if(allSignals.has("package:shared_creature_type")){
    const bySubtype=new Map();for(const p of profiles){const seen=new Set();for(const f of accessibleFaces(p))if(arr(f.cardTypes).includes("Creature"))for(const st of arr(f.subtypes))seen.add(String(st).toLowerCase());for(const st of seen)bySubtype.set(st,(bySubtype.get(st)||0)+1);}
    counts.set("package:shared_creature_type",Math.max(0,...bySubtype.values()));
  }
  return counts;
}

function requiredCount(atom,signal,policy){
  if(Number.isFinite(Number(atom?.count))&&Number(atom.count)>0)return Number(atom.count);
  if(signal==="commander:controlled")return Number(policy.commanderDependencyFloor||1);
  return 1;
}
function reliabilityCount(atom,signal,policy){return Math.max(requiredCount(atom,signal,policy),signal==="commander:controlled"?Number(policy.commanderDependencyFloor||1):Number(policy.dependencyReliabilityFloor||3));}
function atomSatisfaction(atom,supply,policy,{reliability=false,commanderPresent=false}={}){
  const signal=atom.signal;if(signal==="commander:controlled"&&commanderPresent)return 1;
  const have=Number(supply.get(signal)||0),need=(reliability?reliabilityCount:requiredCount)(atom,signal,policy);
  return clamp(have/Math.max(1,need));
}
function logicSatisfaction(expr,atoms,supply,policy,opts){
  if(!expr||expr.op==="true")return 1;if(expr.op==="false")return 0;
  if(expr.op==="predicate"){
    const atom=atoms.find(a=>a.predicate===expr||JSON.stringify(a.predicate)===JSON.stringify(expr));
    if(!atom||atom.dependencyClass!=="package"||atom.negated)return 1;
    return atomSatisfaction(atom,supply,policy,opts);
  }
  if(expr.op==="not")return 1; // negative package predicates are constraints, not supply demand.
  const vals=arr(expr.args).map(x=>logicSatisfaction(x,atoms,supply,policy,opts));if(!vals.length)return 1;
  if(expr.op==="or")return Math.max(...vals);
  return Math.min(...vals);
}
function capabilityDependencySatisfaction(cap,supply,policy,opts){
  if(!cap.packageAtoms.length)return {semantic:1,reliability:1};
  const semantic=Math.min(logicSatisfaction(cap.requirementLogic,cap.packageAtoms,supply,policy,{...opts,reliability:false}),logicSatisfaction(cap.conditionLogic,cap.packageAtoms,supply,policy,{...opts,reliability:false}));
  const reliability=Math.min(logicSatisfaction(cap.requirementLogic,cap.packageAtoms,supply,policy,{...opts,reliability:true}),logicSatisfaction(cap.conditionLogic,cap.packageAtoms,supply,policy,{...opts,reliability:true}));
  return {semantic,reliability};
}

function colorSourceCounts(profiles){
  const counts={W:0,U:0,B:0,R:0,G:0,C:0,any:0};
  for(const p of profiles){
    let any=0;const local={W:0,U:0,B:0,R:0,G:0,C:0};
    for(const s of p.mana.sources){
      if(!["default","alternative_entry"].includes(s.access))continue;
      const q=Math.max(1,Number(s.output||1));if(s.anyColor||s.commanderIdentity||s.chosenColor)any=Math.max(any,q);
      for(const c of arr(s.colors))if(COLORS.includes(c))local[c]=Math.max(local[c],q);
    }
    if(any){counts.any+=any;for(const c of COLORS)counts[c]+=any;}
    for(const c of COLORS)counts[c]+=local[c];
  }
  return counts;
}
function castPressure(profile,colorSources){
  const rows=[];
  for(const entry of profile.castability.entries){
    const colors=[];for(const c of COLORS){const pips=entry.burden.strictColored[c]||0;if(!pips)continue;const sources=Number(colorSources[c]||0);colors.push({color:c,pips,sources,semanticCoverage:clamp(sources/pips)});}
    const colorCoverage=colors.length?Math.min(...colors.map(x=>x.semanticCoverage)):1;
    rows.push({faceId:entry.faceId,name:entry.name,coloredIntensity:entry.burden.coloredIntensity,colors,colorCoverage,variable:entry.burden.variableCount>0,choicePips:entry.burden.choicePipCount});
  }
  return {faces:rows,worstColorCoverage:rows.length?Math.min(...rows.map(x=>x.colorCoverage)):1,maxColoredIntensity:rows.reduce((m,x)=>Math.max(m,x.coloredIntensity),0)};
}
function themeFit(profile,facet){return facet?clamp(profile.theme.facets?.[facet]?.strength||0):0;}
function commanderLinkSignalWeight(signal){
  const s=String(signal||"");
  // Broad card/permanent identity is ordinary package compatibility, not Commander-specific
  // synergy. Otherwise every pump spell, Aura or Equipment gets a perfect link merely
  // because a Commander happens to be a creature.
  if(/^permanent:(?:creature|artifact|enchantment|land|planeswalker|battle|any|nonland_nontoken|basic_land)$/.test(s))return 0;
  if(/^card:(?:type|subtype):/.test(s)||/^package:(?:historic|familiar|shared_creature_type)$/.test(s))return 0;
  if(/^event:(?:spell_cast|noncreature_spell_cast|instant_sorcery_spell_cast)$/.test(s))return 0;
  if(s==="commander:controlled"||/^permanent:name:/.test(s))return 1;
  if(/^permanent:(?:keyword|subtype|legendary_)/.test(s))return .45;
  if(/^event:|^resource:|^counter_pool:|^zone:/.test(s))return .7;
  return .35;
}
export function commanderLinkForProfiles(profile,commanderProfile){
  if(!commanderProfile)return {score:0,helpsCommander:[],helpedByCommander:[]};
  const helps=[],helped=[];let weighted=0,possible=0;
  for(const need of commanderProfile.dependency.externalNeeds){const w=commanderLinkSignalWeight(need);if(w<=0)continue;possible+=w;if(profileSupports(profile,need)>0){helps.push(need);weighted+=w;}}
  for(const need of profile.dependency.externalNeeds){const w=commanderLinkSignalWeight(need);if(w<=0)continue;possible+=w;const directCommanderState=need==="commander:controlled";if(directCommanderState||profileSupports(commanderProfile,need)>0){helped.push(need);weighted+=w;}}
  return {score:possible?clamp(weighted/possible):0,helpsCommander:uniq(helps),helpedByCommander:uniq(helped)};
}
function roleNeed(profile,roleCoverage,roleTargets){
  let best=0,role=null;
  for(const [r,target] of Object.entries(roleTargets||{})){const shortage=Math.max(0,Number(target||0)-Number(roleCoverage[r]||0));if(shortage<=0)continue;const contribution=clamp(profile.roleScores[r]||0)*clamp(shortage/Math.max(1,Number(target||1)));if(contribution>best){best=contribution;role=r;}}
  return {score:best,role};
}

export function evaluateProfileDependencies(profile,state,{policy=DEFAULT_CONTEXT_POLICY,commanderPresent=Boolean(state?.commander)}={}){
  const supply=state?._supplyMap instanceof Map?state._supplyMap:state?.supply instanceof Map?state.supply:new Map(Object.entries(state?.supply||{}));
  const capRows=profile.dependency.capabilities.filter(c=>c.packageAtoms.length).map(c=>({capabilityId:c.capabilityId,action:c.action,...capabilityDependencySatisfaction(c,supply,policy,{commanderPresent}),externalNeeds:c.externalNeeds}));
  return {semantic:capRows.length?capRows.reduce((n,x)=>n+x.semantic,0)/capRows.length:1,reliability:capRows.length?capRows.reduce((n,x)=>n+x.reliability,0)/capRows.length:1,capabilities:capRows};
}
export function evaluateProfileSupport(profile,state){
  const demand=state?._demandMap instanceof Map?state._demandMap:state?.demand instanceof Map?state.demand:new Map(Object.entries(state?.demand||{})),supply=state?._supplyMap instanceof Map?state._supplyMap:state?.supply instanceof Map?state.supply:new Map(Object.entries(state?.supply||{}));
  const supportSignals=[];for(const [signal,count] of demand)if(Number(count)>0&&profileSupports(profile,signal)>0)supportSignals.push(signal);
  let gain=0;for(const signal of supportSignals){const count=Number(demand.get(signal)||0),floor=signal==="commander:controlled"?1:Number(DEFAULT_CONTEXT_POLICY.dependencyReliabilityFloor||3),have=Number(supply.get(signal)||0),unmet=1-clamp(have/Math.max(floor,count,1));gain+=Math.min(1,count/3)*unmet;}
  return {score:clamp(gain/Math.max(1,Math.min(3,supportSignals.length||1))),signals:supportSignals};
}

export function buildContextState(cards,{commander=null,themeFacet=null,roleTargets={},policy=DEFAULT_CONTEXT_POLICY}={}){
  const profiles=cards.map(deriveContextProfile),commanderProfile=commander?deriveContextProfile(commander):null,contextProfiles=commanderProfile?[...profiles,commanderProfile]:profiles;
  const supply=buildSupply(contextProfiles);if(commanderProfile)supply.set("commander:controlled",1);const colorSources=colorSourceCounts(contextProfiles),roleCoverage={};
  for(const r of ROLE_NAMES)roleCoverage[r]=profiles.reduce((n,p)=>n+(p.roleScores[r]||0),0);
  const demand=new Map();for(const p of profiles)for(const row of p.dependency.demands)demand.set(row.signal,(demand.get(row.signal)||0)+1);
  const cardsOut=profiles.map(p=>{
    const capRows=p.dependency.capabilities.filter(c=>c.packageAtoms.length).map(c=>({capabilityId:c.capabilityId,action:c.action,...capabilityDependencySatisfaction(c,supply,policy,{commanderPresent:Boolean(commanderProfile)}),externalNeeds:c.externalNeeds}));
    const dependencySemantic=capRows.length?capRows.reduce((n,x)=>n+x.semantic,0)/capRows.length:1;
    const dependencyReliability=capRows.length?capRows.reduce((n,x)=>n+x.reliability,0)/capRows.length:1;
    const supportSignals=[];for(const [signal,count] of demand)if(count>0&&profileSupports(p,signal)>0)supportSignals.push(signal);
    const supportContribution=clamp(supportSignals.reduce((n,s)=>n+Math.min(1,Number(demand.get(s)||0)/3),0)/Math.max(1,Math.min(3,supportSignals.length||1)));
    const commanderSynergy=commanderLinkForProfiles(p,commanderProfile),tfit=themeFit(p,themeFacet),rneed=roleNeed(p,roleCoverage,roleTargets),pressure=castPressure(p,colorSources);
    const unresolvedRisk=clamp(p.dependency.unresolvedConditions.length/Math.max(1,p.dependency.capabilities.length));
    const w=policy.weights||DEFAULT_CONTEXT_POLICY.weights;
    let structuralScore=clamp(dependencyReliability*w.dependency+supportContribution*w.support+commanderSynergy.score*w.commander+tfit*w.theme+rneed.score*w.roles+p.coverageWeight*w.coverage);
    structuralScore=clamp(structuralScore-unresolvedRisk*Number(policy.unresolvedPenalty||0)-(1-pressure.worstColorCoverage)*Number(policy.colorPressurePenalty||0));
    return {...p,context:{capabilities:capRows,dependencySemantic,dependencyReliability,supportContribution,supportSignals,commanderSynergy,themeFit:tfit,roleNeed:rneed,castPressure:pressure,unresolvedRisk,structuralScore}};
  });
  const bottlenecks=[...demand].map(([signal,count])=>{const providers=Number(supply.get(signal)||0),floor=signal==="commander:controlled"?Number(policy.commanderDependencyFloor||1):Number(policy.dependencyReliabilityFloor||3);return {signal,demandCount:count,providers,semanticSatisfaction:signal==="commander:controlled"&&commanderProfile?1:clamp(providers/Math.max(1,count)),reliabilitySatisfaction:signal==="commander:controlled"&&commanderProfile?1:clamp(providers/Math.max(floor,count))};}).filter(x=>x.reliabilitySatisfaction<1).sort((a,b)=>a.reliabilitySatisfaction-b.reliabilitySatisfaction||b.demandCount-a.demandCount);
  const themeDensity=themeFacet&&cardsOut.length?cardsOut.reduce((n,p)=>n+p.context.themeFit,0)/cardsOut.length:0;
  const avg=k=>cardsOut.length?cardsOut.reduce((n,p)=>n+Number(p.context[k]||0),0)/cardsOut.length:0;
  const dependentCards=cardsOut.filter(x=>(x.context.capabilities||[]).length),avgDependent=k=>dependentCards.length?dependentCards.reduce((n,p)=>n+Number(p.context[k]||0),0)/dependentCards.length:1;
  return {version:CONTEXT_OPTIMIZER_VERSION,themeFacet,roleTargets,policy:{...policy,weights:{...(policy.weights||{})}},cardCount:cardsOut.length,commander:commanderProfile?{oracleId:commanderProfile.oracleId,name:commanderProfile.name}:null,cards:cardsOut,supply:Object.fromEntries(supply),demand:Object.fromEntries(demand),_supplyMap:supply,_demandMap:demand,_rowByOracleId:new Map(cardsOut.map(x=>[x.oracleId,x])),roleCoverage,colorSources,bottlenecks,summary:{avgDependencySemantic:avg("dependencySemantic"),avgDependencyReliability:avg("dependencyReliability"),avgDependentDependencySemantic:avgDependent("dependencySemantic"),avgDependentDependencyReliability:avgDependent("dependencyReliability"),dependentCards:dependentCards.length,avgSupportContribution:avg("supportContribution"),avgStructuralScore:avg("structuralScore"),themeDensity,unresolvedCards:cardsOut.filter(x=>x.context.unresolvedRisk>0).length,commanderDependentCards:cardsOut.filter(x=>x.dependency.summary.commanderDependent).length}};
}

export function rankCandidates(candidates,selectedCards,options={}){
  const base=buildContextState(selectedCards,options),out=[];
  for(const card of candidates){const state=buildContextState([...selectedCards,card],options),row=state.cards.find(x=>x.oracleId===card.oracleId);out.push({oracleId:card.oracleId,name:card.name,score:row?.context.structuralScore||0,context:row?.context||null,delta:{dependencyReliability:state.summary.avgDependencyReliability-base.summary.avgDependencyReliability,themeDensity:state.summary.themeDensity-base.summary.themeDensity,bottleneckCount:state.bottlenecks.length-base.bottlenecks.length}});}
  return out.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}
