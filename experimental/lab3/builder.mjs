import { cardProfile, analyzeDeckContext, buildContextState, profileDependencySatisfaction, profileSupportContribution, themeFacetForLabel } from "./deck-context.mjs";
import { inferThemeModel, themeModelSummary } from "./theme-understanding.mjs";
import { COVERAGE } from "../semantic-v2/schema.mjs";
import { availableComboPackages, comboPackageBaseScore, normalizeComboPolicy, COMBO_ENGINE_VERSION } from "../../lib/combo-engine.mjs";

export const LAB3_BUILDER_VERSION=5;
export const LAB3_MANA_MODEL_VERSION=4;

const COLORS=["W","U","B","R","G"];
const BASIC={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest",C:"Wastes"};
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const round=(n,d=3)=>Number((Number(n)||0).toFixed(d));
const accessibleFaces=card=>(card?.faces||[]).filter(f=>["default","alternative_entry"].includes(f.access?.kind||"default"));
const isLand=card=>Boolean(card?.views?.mana?.isPlayableLand??accessibleFaces(card).some(f=>(f.cardTypes||[]).includes("Land")));
const mv=card=>{const entries=card?.views?.castability?.entries||[];const values=(entries.length?entries:accessibleFaces(card)).map(f=>Number(f.manaValue)).filter(Number.isFinite);return values.length?Math.min(...values):0;};
const typeLine=card=>(card?.faces||[]).map(f=>f.typeLine).filter(Boolean).join(" // ");
const castabilityMana=card=>mv(card);
function cardHasType(card,type){return accessibleFaces(card).some(f=>(f.cardTypes||[]).includes(type));}
function cardHasSubtype(card,type){return accessibleFaces(card).some(f=>(f.subtypes||[]).some(x=>String(x).toLowerCase()===String(type).toLowerCase()));}
function manaRestrictionUsability(restriction,deckCards=[]){
  const cards=(deckCards||[]).map(x=>x?.semanticCard||x?.card||x).filter(Boolean),total=Math.max(1,cards.length),ratio=fn=>cards.filter(fn).length/total;
  const uses=restriction?.allowedUses||[];
  if(restriction?.kind==="spend_forbidden")return .25;
  if(!uses.length)return .25;
  let best=0;
  for(const use of uses){
    if(use?.kind==="activate_ability"){best=Math.max(best,.18);continue;}
    if(use?.kind!=="cast_spell")continue;
    const types=use.cardTypes||[],subs=use.subtypes||[];
    if(use.subtype?.kind==="chosen"){best=Math.max(best,clamp01(ratio(c=>cardHasType(c,"Creature"))*.35));continue;}
    const score=ratio(c=>(!types.length||types.every(t=>cardHasType(c,t)))&&(!subs.length||subs.every(st=>cardHasSubtype(c,st))));
    best=Math.max(best,score);
  }
  return clamp01(best||.18);
}
function manaCapabilities(card,commanderColors=[],deckCards=[]){
  const allowed=new Set(commanderColors||[]),colors=new Set(),colorReliability={};let reliability=0,anyColor=false,restricted=false,minRestrictionUsability=1;
  const mana=card?.views?.mana||{},roleScore=Number(card?.views?.roles?.mana_source?.potentialScore??card?.roles?.mana_source?.score??.75);
  const apply=(source,base=.95)=>{
    const restrictions=source.restrictions||[],usability=restrictions.length?Math.min(...restrictions.map(r=>manaRestrictionUsability(r,deckCards))):1;
    if(restrictions.length){restricted=true;minRestrictionUsability=Math.min(minRestrictionUsability,usability);}
    let r=Math.max(.25,roleScore)*base*Number(source.confidence??1);if(source.coverage===COVERAGE.PARTIAL)r*=.74;if(source.coverage===COVERAGE.GAP)r*=.35;if(source.requiresOtherPermanent)r*=.62;if(source.activationNet!=null&&Number(source.activationNet)<=0)r*=.55;if(source.sacrifice)r*=.68;r*=usability;
    const sourceColors=[];for(const c of source.colors||[])if(!allowed.size||allowed.has(c))sourceColors.push(c);if(source.anyColor||source.commanderIdentity||source.chosenColor){anyColor=true;for(const c of allowed)sourceColors.push(c);}
    for(const c of uniq(sourceColors)){colors.add(c);colorReliability[c]=Math.max(Number(colorReliability[c]||0),r);}reliability=Math.max(reliability,r);
  };
  for(const source of mana.sources||[])if(["default","alternative_entry"].includes(source.access||"default"))apply(source,source.sourceClass==="land_unrestricted"?.98:.92);
  const subtypeColor={Plains:"W",Island:"U",Swamp:"B",Mountain:"R",Forest:"G"};
  for(const proxy of mana.proxySources||[]){const cs=uniq((proxy.subtypesAny||[]).map(x=>subtypeColor[x]).filter(c=>c&&(!allowed.size||allowed.has(c))));if(!cs.length)continue;const r=proxy.destinationTapped?.72:.88;for(const c of cs){colors.add(c);colorReliability[c]=Math.max(Number(colorReliability[c]||0),r);}reliability=Math.max(reliability,r);}
  return {colors:[...colors],anyColor,reliability:clamp01(reliability),colorReliability:Object.fromEntries(Object.entries(colorReliability).map(([c,v])=>[c,clamp01(v)])),restricted,restrictionUsability:restricted?clamp01(minRestrictionUsability):1,proxySources:(mana.proxySources||[]).length};
}
function sourceTargets(demand,lands,colors){const total=Math.max(1,Object.values(demand).reduce((a,b)=>a+b,0)),out={};for(const c of colors){const share=Number(demand[c]||0)/total;out[c]=Math.min(lands,Math.max(8,Math.round(8+share*18)));}return out;}
function addManaSources(counts,card,commanderColors,weight=1,deckCards=[]){const cap=manaCapabilities(card,commanderColors,deckCards);for(const c of cap.colors)counts[c]=(counts[c]||0)+Number(cap.colorReliability?.[c]??cap.reliability)*weight;return cap;}

export function normalizeLab3Settings(input={}){
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

function targetsFor(commander,settings,theme){
  const commanderMv=mv(commander);let lands=38;
  if(commanderMv>=5)lands++;if(commanderMv>=7)lands++;if(settings.curve!=="normal")lands--;
  if(settings.landStyle==="safe")lands++;if(settings.landStyle==="lean")lands--;lands=Math.max(35,Math.min(41,lands));
  const ramp=settings.ramp==="heavy"?14:settings.ramp==="more"?12:10;
  const interaction=settings.interaction==="more"?13:10;
  const themeTarget=/balanced|good stuff/i.test(String(theme||""))?0:Math.round(20+(settings.themeFocus/100)*20);
  return {lands,ramp,resources:10,interaction,wipes:2,protection:4,recursion:2,finishers:2,theme:themeTarget};
}

function roleContribution(profile,key){
  const r=profile.roleScores||{};
  if(key==="resources")return Math.max(r.card_draw||0,(r.tutor||0)*.85,(r.card_selection||0)*.4);
  if(key==="interaction")return Math.max(r.removal||0,r.counterspell||0,(r.graveyard_hate||0)*.65);
  if(key==="wipes")return r.board_wipe||0;
  if(key==="finishers")return r.finisher||0;
  return r[key]||0;
}

function curveFit(profile,settings){const x=castabilityMana(profile.card);const ideal=settings.curve==="fastest"?2.3:settings.curve==="lower"?2.7:3.2;return clamp01(1-Math.max(0,x-ideal)/6);}
function externalPower(candidate){return clamp01(.55*Number(candidate.efficiencyScore||0)+.25*Number(candidate.commanderAffinity||0)+.2*Number(candidate.edhrecThemeScore||candidate.themeAffinity||0));}
function scoreBreakdown(candidate,profile,settings){
  const synergyWeight=settings.synergyBias==="synergy"?.42:settings.synergyBias==="efficiency"?.22:.33;
  const efficiencyWeight=settings.synergyBias==="efficiency"?.34:.22;
  const semantic=profile.semanticTheme,externalTheme=profile.externalTheme,themeCombined=profile.themeScore,commander=profile.directCommanderSynergy,external=externalPower(candidate),curve=curveFit(profile,settings),coverage=profile.statusWeight;
  return {semantic:round(semantic),externalTheme:round(externalTheme),themeCombined:round(themeCombined),commander:round(commander),external:round(external),curve:round(curve),coverage:round(coverage),weights:{themeCombined:synergyWeight,commander:.18,external:efficiencyWeight,curve:.12,coverage:.15}};
}
function baseScore(candidate,profile,settings){const b=scoreBreakdown(candidate,profile,settings),w=b.weights;return clamp01(b.themeCombined*w.themeCombined+b.commander*w.commander+b.external*w.external+b.curve*w.curve+b.coverage*w.coverage);}
function dominantThemeFacet(profile,theme){
  if(profile?.themeMode==="semantic_inferred"&&profile?.themeFacet)return profile.themeFacet;
  // External-fallback themes still need semantic diversity.  The external signal decides
  // whether a card belongs to the requested theme; Semantic v2 decides what kind of
  // contribution it makes so redundancy control does not collapse everything to "theme".
  if(profile?.themeMode==="external_fallback"){
    const primary=profile?.semantic?.theme?.summary?.primary;
    if(primary)return `semantic:${primary}`;
    const r=profile.roleScores||{};
    if(Math.max(Number(r.removal||0),Number(r.counterspell||0),Number(r.graveyard_hate||0))>=.45)return "semantic:interaction";
    if(Math.max(Number(r.card_draw||0),Number(r.card_selection||0),Number(r.tutor||0))>=.45)return "semantic:resources";
    if(Math.max(Number(r.ramp||0),Number(r.mana_source||0),Number(r.cost_reduction||0))>=.45)return "semantic:mana";
    if(Math.max(Number(r.protection||0),Number(r.recursion||0))>=.45)return "semantic:resilience";
    if(Number(r.finisher||0)>=.5)return "semantic:finisher";
    return "semantic:general-support";
  }
  if(!/spell|instant|sorcery/i.test(String(theme||"")))return profile?.semantic?.theme?.summary?.primary||"theme";
  const r=profile.roleScores||{},types=new Set(profile.types||[]),produces=new Set(profile.produces||[]);
  if(Number(r.spell_copy||0)>=.45)return "spell-copy";
  if(Number(r.counterspell||0)>=.45||Number(r.removal||0)>=.55)return "interaction";
  if(Number(r.card_draw||0)>=.45||Number(r.card_selection||0)>=.5||Number(r.tutor||0)>=.55)return "resources";
  if(Number(r.recursion||0)>=.45||produces.has("resource:graveyard_cast"))return "graveyard-value";
  if(Number(r.cost_reduction||0)>=.45)return "cost-engine";
  if(profile.themeScore>=.55&&!types.has("Instant")&&!types.has("Sorcery"))return "payoff-engine";
  if(types.has("Instant")||types.has("Sorcery"))return "base-spell";
  return "support";
}
function themeRedundancyPenalty(candidate,selected,theme){
  if(!/spell|instant|sorcery/i.test(String(theme||"")))return 0;
  const facet=candidate.themeFacet||dominantThemeFacet(candidate.profile,theme),count=selected.filter(x=>(x.themeFacet||dominantThemeFacet(x.profile,theme))===facet).length;
  const caps={"spell-copy":5,"interaction":9,"resources":8,"graveyard-value":7,"cost-engine":6,"payoff-engine":8,"base-spell":12,"support":7},cap=caps[facet]??8;if(count<cap)return 0;
  const step=facet==="spell-copy"?.105:.045;return Math.min(facet==="spell-copy"?.5:.25,(count-cap+1)*step);
}

function candidateModel(candidate,{theme,themeMode,themeModel,commander,settings}){
  const profile=cardProfile(candidate.semanticCard,{theme,themeMode,themeModel,commander,external:candidate}),breakdown=scoreBreakdown(candidate,profile,settings);
  return {...candidate,profile,baseScore:baseScore(candidate,profile,settings),scoreBreakdown:breakdown,themeFacet:dominantThemeFacet(profile,theme),selected:false,selectionPhase:null,selectionReason:null};
}


function chooseLab3ComboPackage(comboCandidates,rawCandidates,models,settings,commander){
  const policy=normalizeComboPolicy(settings.comboPolicy);if(policy==="off"||!comboCandidates?.length)return null;
  const available=availableComboPackages(comboCandidates,rawCandidates,{commander:commander.name,commanderColors:commander.colorIdentity||[],policy,protectExistingDecks:settings.protectExistingDecks,maxPieces:6}),modelByName=new Map(models.map(m=>[String(m.name).toLocaleLowerCase("en-US"),m]));let best=null;
  for(const pkg of available){
    if(pkg.nonCommanderPieces.some(p=>Number(p.quantity||1)!==1))continue;
    const pieces=pkg.nonCommanderPieces.map(p=>modelByName.get(String(p.name).toLocaleLowerCase("en-US"))).filter(Boolean);if(pieces.length!==pkg.nonCommanderPieces.length||!pieces.length)continue;
    const themeMean=pieces.reduce((n,c)=>n+Number(c.profile?.themeScore||0),0)/pieces.length,commanderMean=pieces.reduce((n,c)=>n+Number(c.profile?.directCommanderSynergy||0),0)/pieces.length,qualityMean=pieces.reduce((n,c)=>n+Number(c.baseScore||0),0)/pieces.length,coherence=Math.max(themeMean,commanderMean*.8)+qualityMean*.12;
    if(policy==="synergistic"&&coherence<.28)continue;
    const totalMv=pieces.reduce((n,c)=>n+mv(c.semanticCard),0),score=comboPackageBaseScore(pkg,{policy})+themeMean*.30+commanderMean*.15+qualityMean*.10-Math.max(0,totalMv-8)*.008,candidate={...pkg,models:pieces,score:round(score),themeMean:round(themeMean),commanderMean:round(commanderMean),qualityMean:round(qualityMean),totalManaValue:round(totalMv,1)};if(!best||candidate.score>best.score)best=candidate;
  }
  if(!best)return null;const total=best.models.length;best.models.forEach((m,i)=>{m.comboLocked=true;m.comboPiece={comboId:best.id,index:i+1,total,infinite:Boolean(best.infinite),produces:(best.produces||[]).map(x=>x.name),url:best.url||null};});return best;
}
function comboResult(comboPackage,policy){
  const required=normalizeComboPolicy(policy)!=="off";if(!comboPackage)return {engineVersion:COMBO_ENGINE_VERSION,policy:normalizeComboPolicy(policy),required,selected:false,complete:false,reason:required?"no-complete-package":null,pieces:[]};
  return {engineVersion:COMBO_ENGINE_VERSION,policy:normalizeComboPolicy(policy),required:true,selected:true,complete:true,id:comboPackage.id,infinite:Boolean(comboPackage.infinite),pieces:(comboPackage.pieces||[]).map(p=>({name:p.name,quantity:Number(p.quantity||1),mustBeCommander:Boolean(p.mustBeCommander)})),produces:comboPackage.produces||[],manaNeeded:comboPackage.manaNeeded||null,manaValueNeeded:comboPackage.manaValueNeeded||null,popularity:Number(comboPackage.popularity||0),url:comboPackage.url||null,score:comboPackage.score,themeMean:comboPackage.themeMean,commanderMean:comboPackage.commanderMean};
}

function structuralCounts(selected){const out={ramp:0,resources:0,interaction:0,wipes:0,protection:0,recursion:0,finishers:0,theme:0};for(const c of selected){for(const k of Object.keys(out)){if(k==="theme")continue;out[k]+=roleContribution(c.profile,k);}if(c.profile.themeScore>=.35)out.theme++;}return out;}

const isThemeCandidate=c=>Number(c?.profile?.themeScore||0)>=.35;

function chooseStructural(pool,selected,targets,slots,settings){
  const keys=["ramp","resources","interaction","wipes","protection","recursion","finishers"],themeCapacity=Math.min(Number(targets.theme||0),pool.filter(isThemeCandidate).length);
  while(selected.length<slots){
    const counts=structuralCounts(selected),deficits=keys.filter(k=>counts[k]+.01<targets[k]);if(!deficits.length)break;
    const remaining=slots-selected.length;let best=null,bestScore=-1;
    for(const c of pool){
      if(c.selected)continue;
      // Structural picks must not consume so many slots that an achievable theme quota
      // becomes mathematically impossible later.  This is theme-agnostic: it protects
      // any semantic/external theme with enough candidates in the pool.
      const themeAfter=counts.theme+(isThemeCandidate(c)?1:0),remainingAfter=remaining-1;
      if(Math.max(0,themeCapacity-themeAfter)>remainingAfter)continue;
      let roleBoost=0,coverage=0;for(const k of deficits){const d=Math.max(0,targets[k]-counts[k]),con=roleContribution(c.profile,k);roleBoost+=con*Math.min(1,d/Math.max(1,targets[k]))*.5;coverage=Math.max(coverage,con);}if(coverage<=0)continue;
      const reservePressure=themeCapacity?Math.max(0,(themeCapacity-counts.theme)-remainingAfter)/themeCapacity:0,themeBridge=isThemeCandidate(c)?reservePressure*.35:0,score=c.baseScore+roleBoost+themeBridge;if(score>bestScore){best=c;bestScore=score;}
    }
    if(!best)break;best.selected=true;best.selectionPhase="structure";best.selectionReason=`cubre ${deficits.filter(k=>roleContribution(best.profile,k)>.2).join(", ")}`;selected.push(best);
  }
}

function chooseTheme(pool,selected,targets,slots,theme,themeMode){
  let themeCount=selected.filter(isThemeCandidate).length;
  while(selected.length<slots&&themeCount<targets.theme){
    const counts=structuralCounts(selected),deficits=["ramp","resources","interaction","wipes","protection","recursion","finishers"].filter(k=>counts[k]+.01<targets[k]);
    let best=null,bestScore=-1,bestPenalty=0;
    for(const c of pool){
      if(c.selected||!isThemeCandidate(c))continue;
      let structuralBridge=0;for(const k of deficits){const d=Math.max(0,targets[k]-counts[k]),con=roleContribution(c.profile,k);structuralBridge+=con*Math.min(1,d/Math.max(1,targets[k]))*.36;}
      const redundancy=themeRedundancyPenalty(c,selected,theme),score=c.baseScore+c.profile.themeScore*.38+structuralBridge-redundancy;if(score>bestScore){best=c;bestScore=score;bestPenalty=redundancy;}
    }
    if(!best)break;best.selected=true;best.selectionPhase="theme";best._redundancyPenalty=bestPenalty;const source=themeMode==="external_fallback"?"EDHREC fallback":"semántica";best.selectionReason=bestPenalty?`densidad temática ${source} · diversidad ${best.themeFacet}`:`densidad temática ${source} · ${best.themeFacet}`;selected.push(best);themeCount++;
  }
}

function chooseFill(pool,selected,slots,settings,theme,commander){
  while(selected.length<slots){const ctx=buildContextState(selected.map(x=>x.profile),{commander,theme});let best=null,bestScore=-1;for(const c of pool){if(c.selected)continue;const dep=profileDependencySatisfaction(c.profile,ctx),support=profileSupportContribution(c.profile,ctx),unknownPenalty=c.semanticCard?.status===COVERAGE.GAP?.18:c.semanticCard?.status===COVERAGE.PARTIAL?.06:0,commanderPenalty=settings.commanderDependence==="conservative"&&c.profile.needs.includes("commander:controlled")?.12:0,redundancy=themeRedundancyPenalty(c,selected,theme);const score=c.baseScore+dep*.16+support*.16+c.profile.themeScore*.1-unknownPenalty-commanderPenalty-redundancy;if(score>bestScore){best=c;bestScore=score;best._depAtSelection=dep;best._supportAtSelection=support;best._redundancyPenalty=redundancy;}}if(!best)break;best.selected=true;best.selectionPhase="context";best.selectionReason=best._redundancyPenalty?`ajuste contextual · diversidad ${best.themeFacet}`:"mejor ajuste contextual restante";selected.push(best);}
}

const STRUCTURAL_KEYS=["ramp","resources","interaction","wipes","protection","recursion","finishers"];
function quotaObjective(counts,targets,effectiveThemeTarget){
  let total=0;for(const k of STRUCTURAL_KEYS){const target=Math.max(0,Number(targets[k]||0)),miss=Math.max(0,target-Number(counts[k]||0));if(target)total+=(miss/target)**2;}
  const themeTarget=Math.max(0,Number(effectiveThemeTarget||0)),themeMiss=Math.max(0,themeTarget-Number(counts.theme||0));if(themeTarget)total+=(themeMiss/themeTarget)**2;return total;
}
function quotaCountsAfterSwap(counts,incoming,outgoing){
  const next={...counts};for(const k of STRUCTURAL_KEYS)next[k]=Number(counts[k]||0)+roleContribution(incoming.profile,k)-roleContribution(outgoing.profile,k);next.theme=Number(counts.theme||0)+(isThemeCandidate(incoming)?1:0)-(isThemeCandidate(outgoing)?1:0);return next;
}
function repairQuotaSelection(pool,selected,targets,slots){
  if(selected.length!==slots)return {iterations:0,before:quotaObjective(structuralCounts(selected),targets,0),after:quotaObjective(structuralCounts(selected),targets,0)};
  const themeCapacity=Math.min(Number(targets.theme||0),pool.filter(isThemeCandidate).length);let counts=structuralCounts(selected),objective=quotaObjective(counts,targets,themeCapacity),iterations=0;const before=objective;
  while(objective>1e-10&&iterations<12){
    const deficitKeys=STRUCTURAL_KEYS.filter(k=>Number(counts[k]||0)+.01<Number(targets[k]||0)),themeDeficit=Number(counts.theme||0)<themeCapacity;let best=null;
    for(const incoming of pool){
      if(incoming.selected)continue;
      if(!themeDeficit&&!deficitKeys.some(k=>roleContribution(incoming.profile,k)>0))continue;
      if(themeDeficit&&!isThemeCandidate(incoming)&&!deficitKeys.some(k=>roleContribution(incoming.profile,k)>0))continue;
      for(let i=0;i<selected.length;i++){
        const outgoing=selected[i];if(outgoing.comboLocked)continue;
        if(Number(counts.theme||0)>=themeCapacity&&!isThemeCandidate(incoming)&&isThemeCandidate(outgoing))continue;
        const next=quotaCountsAfterSwap(counts,incoming,outgoing);if(next.theme+1e-9<themeCapacity)continue;const nextObjective=quotaObjective(next,targets,themeCapacity),gain=objective-nextObjective;if(gain<=1e-10)continue;
        const qualityDelta=Number(incoming.baseScore||0)-Number(outgoing.baseScore||0);if(!best||gain>best.gain+1e-10||(Math.abs(gain-best.gain)<=1e-10&&qualityDelta>best.qualityDelta))best={incoming,outgoing,index:i,next,nextObjective,gain,qualityDelta};
      }
    }
    if(!best)break;
    const fixed=[...deficitKeys,...(themeDeficit?["theme"]:[])].filter(k=>Number(best.next[k]||0)>Number(counts[k]||0)+.01);best.outgoing.selected=false;best.incoming.selected=true;best.incoming.selectionPhase="quota_repair";best.incoming.selectionReason=`ajuste de cuotas · ${fixed.join(", ")||"balance estructural"}`;best.incoming._quotaRepairOut=best.outgoing.name;selected[best.index]=best.incoming;counts=best.next;objective=best.nextObjective;iterations++;
  }
  return {iterations,before,after:objective,effectiveThemeTarget:themeCapacity};
}

function pipDemand(selected,colors){const out=Object.fromEntries(colors.map(c=>[c,0]));for(const c of selected){for(const entry of c.semanticCard?.views?.castability?.entries||[]){for(const color of colors)out[color]+=Number(entry.burden?.strictColored?.[color]||0);for(const choice of entry.burden?.choicePips||[]){const opts=(choice.colors||[]).filter(x=>colors.includes(x));if(!opts.length)continue;for(const color of opts)out[color]+=1/opts.length;}}}return out;}

function basicRuntime(color,index){
  const name=BASIC[color]||"Wastes",manaColor=color==="C"?["C"]:[color],produces=["card:type:basic","card:type:land","permanent:land","permanent:basic_land","resource:mana",...(color==="C"?[]:[`mana:color:${color}`])];
  const role=(role,score,adjudication="positive")=>({version:5,role,adjudication,potentialScore:score,confidence:1,evidence:[],negativeEvidence:[],conditional:false,requirements:[],conditions:[]});
  const roles={land_slot:role("land_slot",1),mana_source:role("mana_source",.98),ramp:role("ramp",0,"explicit_negative")};
  const dependency={version:1,oracleId:`lab3-basic-${color}-${index}`,name,produces,packageNeeds:[],externalNeeds:[],environmentNeeds:[],stateNeeds:[],internalConstraints:[],unresolvedConditions:[],supply:produces.map(signal=>({signal,producers:[{source:"intrinsic",capabilityId:null}]})),demands:[],links:[],capabilities:[],summary:{packageNeedCount:0,externalNeedCount:0,selfSupportedNeedCount:0,environmentNeedCount:0,stateNeedCount:0,internalConstraintCount:0,unresolvedConditionCount:0,internalLinkCount:0,commanderDependent:false}};
  const theme={version:1,oracleId:`lab3-basic-${color}-${index}`,name,facets:{lands:{facet:"lands",strength:.9,roles:{identity:.9},evidence:[{role:"identity",weight:.9,kind:"card_type",value:"Land",capabilityId:null}]}},ranked:[],summary:{facetCount:1,primary:"lands",primaryStrength:.9}};theme.ranked=[theme.facets.lands];
  const source={capabilityId:`basic-mana-${index}`,faceId:"face-0",access:"default",sourceClass:"land_unrestricted",colors:manaColor,anyColor:false,commanderIdentity:false,anyLandProduced:false,chosenColor:false,output:1,activationNet:1,tap:true,sacrifice:false,requiresOtherPermanent:false,restrictions:[],etb:{mode:"untapped_by_default",conditions:[]},requirements:{op:"true"},conditions:{op:"true"},coverage:COVERAGE.SUPPORTED,confidence:1};
  const mana={version:2,oracleId:`lab3-basic-${color}-${index}`,name,castFaces:[],landFaces:[{faceId:"face-0",name,access:"default",etb:{mode:"untapped_by_default",conditions:[]}}],sources:[source],proxySources:[],isPlayableLand:true};
  const castability={version:1,oracleId:`lab3-basic-${color}-${index}`,name,entries:[],permissions:[],costModifiers:[],restrictions:[],keywordRoutes:[],paymentMethods:[],summary:{castFaceCount:0,hasDefaultHandEntry:false,hasNonHandRoute:false,hasCostModification:false,hasCastingRestriction:false,strictColoredTotals:{W:0,U:0,B:0,R:0,G:0,C:0},maxColoredIntensity:0,hasVariableCost:false,hasHybridOrChoice:false}};
  return {runtimeSchemaVersion:2,semanticSchema:"synthetic-basic-v2",oracleId:`lab3-basic-${color}-${index}`,name,layout:"normal",status:COVERAGE.SUPPORTED,coverage:{status:COVERAGE.SUPPORTED},keywords:[],colorIdentity:color==="C"?[]:[color],legalities:{commander:"legal"},faces:[{id:"face-0",index:0,name,typeLine:`Basic Land — ${name}`,cardTypes:["Basic","Land"],subtypes:[name],manaCost:"",manaValue:0,access:{kind:"default",requirements:{op:"true"}},coverage:COVERAGE.SUPPORTED}],views:{roles,dependency,theme,mana,castability},roles:{land_slot:{...roles.land_slot,score:1,status:COVERAGE.SUPPORTED},mana_source:{...roles.mana_source,score:.98,status:COVERAGE.SUPPORTED},ramp:{...roles.ramp,score:0,status:COVERAGE.SUPPORTED}},archetypes:{},castability:{...castability,minTotalManaCastability:0},signals:{produces,needs:[],packageNeeds:[],facts:[]}};
}

function landTempoPenalty(card,cap){
  const sources=card?.views?.mana?.sources||[];let penalty=0;if(sources.some(s=>s.etb?.mode==="always_tapped"))penalty+=.14;else if(sources.some(s=>s.etb?.mode==="conditionally_tapped"))penalty+=.06;if(sources.some(s=>s.sacrifice))penalty+=.08;if((card?.views?.mana?.proxySources||[]).some(s=>s.destinationTapped))penalty+=.06;if(cap?.restricted)penalty+=(1-Number(cap.restrictionUsability||0))*.18;return Math.min(.42,penalty);
}
function chooseLands(landPool,selectedNonlands,commander,targets,settings,comboPackage=null){
  const colors=commander.colorIdentity||[],basicFloor=settings.landStyle==="basics"?22:settings.landStyle==="safe"?15:settings.landStyle==="lean"?5:8;
  const maxNonbasic=Math.max(0,targets.lands-basicFloor),demand=pipDemand(selectedNonlands,colors),sourceTarget=sourceTargets(demand,targets.lands,colors),totalDemand=Math.max(1,Object.values(demand).reduce((a,b)=>a+b,0));
  const sourceCounts=Object.fromEntries(colors.map(c=>[c,0]));
  // Nonland rocks/dorks/fixers help cast spells, but are discounted relative to lands.
  for(const c of selectedNonlands)addManaSources(sourceCounts,c.semanticCard,colors,.65,selectedNonlands);
  const ranked=landPool.map(c=>{
    const cap=manaCapabilities(c.semanticCard,colors,selectedNonlands),effectiveFit=colors.length?colors.reduce((n,color)=>n+(Number(demand[color]||0)/totalDemand)*Number(cap.colorReliability?.[color]||0),0):1,breadth=colors.length?cap.colors.filter(x=>Number(cap.colorReliability?.[x]||0)>=.45).length/colors.length:1,tempoPenalty=landTempoPenalty(c.semanticCard,cap);
    const utility=Object.entries(c.profile?.roleScores||{}).some(([k,v])=>!["mana_source","land_slot","ramp"].includes(k)&&Number(v)>=.35)?.08:0;
    const landScore=clamp01((c.profile.roleScores.mana_source||0)*.24+effectiveFit*.42+cap.reliability*.14+breadth*.12+c.baseScore*.04+utility-tempoPenalty);
    return {...c,_manaCap:cap,_colorFit:clamp01(effectiveFit),_tempoPenalty:tempoPenalty,landScore};
  });
  const chosen=[],minimum=settings.landStyle==="basics"?.48:settings.landStyle==="safe"?.40:settings.landStyle==="lean"?.28:.34;
  for(const forced of comboPackage?.models||[]){if(!isLand(forced.semanticCard)||chosen.some(x=>x.name===forced.name))continue;const cap=manaCapabilities(forced.semanticCard,colors,selectedNonlands),row={...forced,_manaCap:cap,_colorFit:1,_tempoPenalty:landTempoPenalty(forced.semanticCard,cap),landScore:1,_picked:true,selectionPhase:`combo:${comboPackage.id}`,selectionReason:`combo exacto · ${comboPackage.infinite?"infinito":"completo"}`};chosen.push(row);for(const color of cap.colors)sourceCounts[color]=(sourceCounts[color]||0)+Number(cap.colorReliability?.[color]??cap.reliability);}
  while(chosen.length<maxNonbasic){let best=null,bestScore=-1;for(const c of ranked){if(c._picked||c.landScore<minimum)continue;let deficitBoost=0;for(const color of c._manaCap.colors){const target=Math.max(1,sourceTarget[color]||1),deficit=Math.max(0,target-Number(sourceCounts[color]||0))/target,rel=Number(c._manaCap.colorReliability?.[color]||0);deficitBoost+=deficit*(Number(demand[color]||0)/totalDemand)*rel;}
      const allCovered=colors.every(color=>Number(sourceCounts[color]||0)>=Number(sourceTarget[color]||0)),score=c.landScore+deficitBoost*.52-(allCovered&&c._tempoPenalty>0?c._tempoPenalty*.45:0);if(score>bestScore){best=c;bestScore=score;}}if(!best)break;best._picked=true;best.selectionPhase="mana";best.selectionReason=best._manaCap.restricted?`mana source · restricción efectiva ${Math.round(best._manaCap.restrictionUsability*100)}%`:"mana source · cobertura de color";chosen.push(best);for(const color of best._manaCap.colors)sourceCounts[color]=(sourceCounts[color]||0)+Number(best._manaCap.colorReliability?.[color]||0);}
  const needBasics=Math.max(0,targets.lands-chosen.length),allocations=Object.fromEntries(colors.map(c=>[c,0])),basics=[];
  if(!colors.length){for(let i=0;i<needBasics;i++)basics.push({name:"Wastes",semanticCard:basicRuntime("C",i),syntheticBasic:true,quantity:1});}
  else {
    let basicIndex=0;
    if(settings.landStyle==="safe"||settings.landStyle==="basics")for(const color of colors){if(basicIndex>=needBasics)break;if(Number(demand[color]||0)<=0)continue;allocations[color]++;basics.push({name:BASIC[color],semanticCard:basicRuntime(color,basicIndex++),syntheticBasic:true,quantity:1});}
    for(;basicIndex<needBasics;basicIndex++){let best=colors[0],bestNeed=-Infinity;for(const color of colors){const target=Math.max(1,sourceTarget[color]||1),deficit=Math.max(0,target-(sourceCounts[color]||0)-allocations[color]),share=Number(demand[color]||0)/totalDemand,need=deficit/target+share*.35;if(need>bestNeed){best=color;bestNeed=need;}}allocations[best]++;basics.push({name:BASIC[best],semanticCard:basicRuntime(best,basicIndex),syntheticBasic:true,quantity:1});}
  }
  for(const [color,n] of Object.entries(allocations))sourceCounts[color]=(sourceCounts[color]||0)+n;
  const sourceCoverage=Object.fromEntries(colors.map(c=>[c,round(Math.min(1,(sourceCounts[c]||0)/Math.max(1,sourceTarget[c]||1)))])),shortfalls=Object.fromEntries(colors.filter(c=>(sourceCounts[c]||0)+.01<(sourceTarget[c]||0)).map(c=>[c,{target:sourceTarget[c],sources:round(sourceCounts[c]||0),coverage:sourceCoverage[c]}]));
  const weightedCoverage=colors.length?colors.reduce((n,c)=>n+sourceCoverage[c]*(Number(demand[c]||0)/totalDemand),0):1;
  return {chosenNonbasics:chosen,basics,demand,basicCount:basics.length,nonbasicCount:chosen.length,sourceTargets:sourceTarget,sourcesByColor:Object.fromEntries(colors.map(c=>[c,round(sourceCounts[c]||0)])),sourceCoverage,weightedCoverage:round(weightedCoverage),shortfalls,restrictedSources:chosen.filter(c=>c._manaCap?.restricted).map(c=>({name:c.name,usability:round(c._manaCap.restrictionUsability),colors:c._manaCap.colors,reason:c.selectionReason}))};
}

function lab3PrimaryCategory(c,fallback="Utility"){
  if(fallback==="Commander"||c?.selectionPhase==="commander")return "Commander";
  if(c?.comboPiece)return "Combo Piece";
  if(isLand(c?.semanticCard))return "Land";
  const r=c?.profile?.roleScores||{};
  if(Number(r.board_wipe||0)>=.45)return "Board Wipe";
  if(Number(r.finisher||0)>=.5)return "Finisher";
  if(Number(r.ramp||0)>=.45)return "Ramp / Fixing";
  if(Math.max(Number(r.protection||0),Number(r.recursion||0))>=.45)return "Protection / Recursion";
  if(Math.max(Number(r.removal||0),Number(r.counterspell||0),Number(r.graveyard_hate||0)*.75)>=.45)return "Interaction";
  if(Math.max(Number(r.card_draw||0),Number(r.tutor||0)*.9,Number(r.card_selection||0)*.65)>=.45)return "Draw / Resources";
  const facet=c?.themeFacet||"",themeScore=Number(c?.profile?.themeScore||0);
  if(themeScore>=.45||c?.selectionPhase==="theme"){
    if(facet==="payoff-engine")return "Theme Payoff";
    if(["cost-engine","graveyard-value"].includes(facet))return "Theme Engine";
    return "Theme Support";
  }
  return fallback==="Spell"?"Utility":fallback;
}
function outputCard(c,fallbackCategory){const category=lab3PrimaryCategory(c,fallbackCategory);return {name:c.name,quantity:Number(c.quantity||1),category,typeLine:typeLine(c.semanticCard),cmc:mv(c.semanticCard),semanticStatus:c.semanticCard.status,selectionScore:round(c.baseScore||0),selectionPhase:c.selectionPhase||fallbackCategory,selectionReason:c.selectionReason||fallbackCategory,themeScore:round(c.profile?.themeScore||0),semanticThemeScore:round(c.profile?.semanticTheme||0),externalThemeScore:round(c.profile?.externalTheme||0),themeEvidenceSource:c.profile?.themeEvidenceSource||"none",dependencyAtSelection:round(c._depAtSelection??1),supportAtSelection:round(c._supportAtSelection??0),roles:c.profile?.roleScores||{},themeFacet:c.themeFacet||null,redundancyPenalty:round(c._redundancyPenalty||0),scoreBreakdown:c.scoreBreakdown||null,comboPiece:c.comboPiece||null,syntheticBasic:Boolean(c.syntheticBasic)};}

export function buildLab3Deck({commander,theme,themeMode="semantic",candidates=[],comboCandidates=[],settings={}}={}){
  if(!commander?.name)throw new Error("LAB3 requires a semantic Commander record");const cfg=normalizeLab3Settings(settings),targets=targetsFor(commander,cfg,theme),mapped=themeFacetForLabel(theme,commander),themeModel=mapped?.kind==="neutral"?{version:1,theme,mode:"semantic_direct",directFacet:null,confidence:1,evidenceCards:0,features:{},featureRows:[]}:inferThemeModel(candidates,{theme,directFacet:mapped?.facet||null}),effectiveThemeMode=themeModel.mode==="semantic_direct"?"semantic":themeModel.mode,commanderProfile=cardProfile(commander,{theme,themeMode:effectiveThemeMode,themeModel,commander:null,external:{commanderAffinity:1,themeAffinity:0}});
  const models=candidates.filter(c=>c?.semanticCard&&c.semanticCard.status!==COVERAGE.GAP&&c.name!==commander.name&&Number(c.ownedQuantity??c.quantity??1)>0).map(c=>candidateModel(c,{theme,themeMode:effectiveThemeMode,themeModel,commander,settings:cfg})),lands=models.filter(c=>isLand(c.semanticCard)),nonlands=models.filter(c=>!isLand(c.semanticCard)),comboPackage=chooseLab3ComboPackage(comboCandidates,candidates,models,cfg,commander),effectiveTargets={...targets,finishers:Math.max(0,Number(targets.finishers||0)-(comboPackage?.infinite?1:0))};
  const nonlandSlots=99-targets.lands,selected=[];for(const c of comboPackage?.models||[]){if(isLand(c.semanticCard))continue;c.selected=true;c.selectionPhase=`combo:${comboPackage.id}`;c.selectionReason=`combo exacto · ${comboPackage.infinite?"infinito":"completo"}`;selected.push(c)}chooseStructural(nonlands,selected,effectiveTargets,nonlandSlots,cfg);chooseTheme(nonlands,selected,effectiveTargets,nonlandSlots,theme,effectiveThemeMode);chooseFill(nonlands,selected,nonlandSlots,cfg,theme,commander);
  if(selected.length<nonlandSlots)throw new Error(`LAB3 candidate pool cannot fill ${nonlandSlots} nonland slots (selected ${selected.length}).`);
  const quotaRepair=repairQuotaSelection(nonlands,selected,effectiveTargets,nonlandSlots);
  const landPlan=chooseLands(lands,selected,commander,targets,cfg,comboPackage),landModels=[...landPlan.chosenNonbasics,...landPlan.basics.map(b=>({...b,profile:cardProfile(b.semanticCard,{theme,themeMode:effectiveThemeMode,themeModel,commander}),baseScore:.4,selected:true,selectionPhase:"basic",selectionReason:"basic mana source"}))];
  // If there are too few owned nonbasics, basics are unlimited and fill the exact target.
  while(landModels.length<targets.lands){const color=(commander.colorIdentity||[])[landModels.length%Math.max(1,(commander.colorIdentity||[]).length)]||"C",semanticCard=basicRuntime(color,landModels.length);landModels.push({name:semanticCard.name,semanticCard,profile:cardProfile(semanticCard,{theme,themeMode:effectiveThemeMode,themeModel,commander}),syntheticBasic:true,quantity:1,baseScore:.4,selectionPhase:"basic",selectionReason:"basic mana source"});}
  const finalProfiles=[commanderProfile,...selected.map(x=>x.profile),...landModels.map(x=>x.profile)],context=analyzeDeckContext(finalProfiles,{commander:commanderProfile,theme}),counts=structuralCounts(selected),mainboard=[outputCard({name:commander.name,semanticCard:commander,profile:commanderProfile,baseScore:1,selectionPhase:"commander",selectionReason:"Commander"},"Commander"),...selected.map(c=>outputCard(c,"Spell")),...landModels.map(c=>outputCard(c,c.syntheticBasic?"Basic Land":"Land"))];
  const byName=new Map();for(const c of mainboard){const prev=byName.get(c.name);if(prev&&c.syntheticBasic&&prev.syntheticBasic){prev.quantity+=1;}else byName.set(c.name,{...c});}const collapsed=[...byName.values()],size=mainboard.reduce((n,c)=>n+Number(c.quantity||1),0);
  const themeAvailability=nonlands.filter(c=>Number(c.profile?.themeScore||0)>=.35).length;
  const shortages={};for(const k of ["ramp","resources","interaction","wipes","protection","recursion","finishers","theme"]){const have=k==="theme"?counts.theme:counts[k],target=Number(effectiveTargets[k]||0);if(have+.01<target){shortages[k]={target,have:round(have)};if(k==="theme"&&themeAvailability<effectiveTargets.theme){shortages[k].available=themeAvailability;shortages[k].reason="candidate_pool_limit";}}}const combo=comboResult(comboPackage,cfg.comboPolicy);if(combo.required&&!combo.selected)shortages.combo={target:1,have:0,reason:"no_complete_package"};
  const rejected=nonlands.filter(c=>!c.selected).map(c=>({model:c,penalty:round(themeRedundancyPenalty(c,selected,theme))})).sort((a,b)=>(round(b.model.baseScore)-b.penalty)-(round(a.model.baseScore)-a.penalty)).slice(0,80).map(({model:c,penalty})=>({name:c.name,baseScore:round(c.baseScore),themeScore:round(c.profile.themeScore),semanticThemeScore:round(c.profile.semanticTheme),externalThemeScore:round(c.profile.externalTheme),themeEvidenceSource:c.profile.themeEvidenceSource,themeFacet:c.themeFacet,semanticStatus:c.semanticCard.status,roles:c.profile.roleScores,scoreBreakdown:c.scoreBreakdown,redundancyPenalty:penalty}));
  const facetCounts={},themeEvidenceCounts={};for(const c of selected){facetCounts[c.themeFacet]=(facetCounts[c.themeFacet]||0)+1;const src=c.profile.themeEvidenceSource||"none";themeEvidenceCounts[src]=(themeEvidenceCounts[src]||0)+1;}
  return {schema:"manashelf-lab3-build-log-v5",builderVersion:LAB3_BUILDER_VERSION,manaModelVersion:LAB3_MANA_MODEL_VERSION,comboEngineVersion:COMBO_ENGINE_VERSION,settings:cfg,theme,themeMode:effectiveThemeMode,themeUnderstanding:themeModelSummary(themeModel),targets:{...targets,finishers:effectiveTargets.finishers},combo,size,complete:size===100,validation:{deckSize:size===100,commanderExactlyOne:true,candidatePool:candidates.length,semanticCoverage:{supported:finalProfiles.filter(p=>p.card.status===COVERAGE.SUPPORTED).length,partial:finalProfiles.filter(p=>p.card.status===COVERAGE.PARTIAL).length,gap:finalProfiles.filter(p=>p.card.status===COVERAGE.GAP).length}},summary:{lands:targets.lands,nonlands:selected.length,themeCards:counts.theme,themeAvailability,themeEvidenceCounts,roleCounts:Object.fromEntries(Object.entries(counts).filter(([k])=>k!=="theme")),themeFacets:facetCounts,basicLands:landPlan.basicCount,nonbasicLands:landPlan.nonbasicCount},shortages,mana:{pipDemand:landPlan.demand,sourceTargets:landPlan.sourceTargets,sourcesByColor:landPlan.sourcesByColor,sourceCoverage:landPlan.sourceCoverage,weightedCoverage:landPlan.weightedCoverage,shortfalls:landPlan.shortfalls,restrictedSources:landPlan.restrictedSources},context:{summary:context.summary,bottlenecks:context.bottlenecks.slice(0,20),roleCoverage:context.roleCoverage,packageLinks:context.packageLinks.slice(0,50)},diagnostics:{topRejected:rejected,themeFacetCounts:facetCounts,themeEvidenceCounts,quotaRepair},deck:collapsed};
}

export const builderInternals={manaCapabilities,manaRestrictionUsability,themeRedundancyPenalty,dominantThemeFacet,lab3PrimaryCategory,repairQuotaSelection};
