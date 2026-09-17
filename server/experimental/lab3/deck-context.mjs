import { buildContextState as buildSemanticContextState, deriveContextProfile, evaluateProfileDependencies, evaluateProfileSupport, commanderLinkForProfiles } from "../semantic-v2/context-optimizer.mjs";
import { COVERAGE } from "../semantic-v2/schema.mjs";
import { scoreCardForThemeModel, scoreCardForThemeSupportDetail, dominantThemeFeature } from "./theme-understanding.mjs";

export const LAB3_CONTEXT_ENGINE_VERSION=7;
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const slug=s=>norm(s).replace(/\s+/g,"_");
const singular=s=>{const x=norm(s),irr={elves:"elf",dwarves:"dwarf",wolves:"wolf",zombies:"zombie",faeries:"faerie",auras:"aura",ninjas:"ninja"};if(irr[x])return irr[x];if(/(?:ches|shes|xes|zes)$/.test(x))return x.slice(0,-2);if(x.endsWith("ies"))return x.slice(0,-3)+"y";return x.endsWith("s")&&!/(?:ss|us|is)$/.test(x)?x.slice(0,-1):x;};
const accessibleFaces=card=>(card?.faces||[]).filter(f=>["default","alternative_entry"].includes(f.access?.kind||"default"));
const typeSet=card=>new Set(accessibleFaces(card).flatMap(f=>f.cardTypes||[]).map(norm));
const subtypeSet=card=>new Set(accessibleFaces(card).flatMap(f=>f.subtypes||[]).map(singular));

export function coverageWeight(status){
  const s=typeof status==="string"?status:status?.coverage?.status||status?.status;
  return s===COVERAGE.SUPPORTED?1:s===COVERAGE.PARTIAL?.74:.35;
}

export function themeFacetForLabel(theme,card=null){
  const a=norm(theme);if(!a)return {facet:null,key:null,kind:"unknown"};
  if(/balanced|good stuff/.test(a))return {facet:null,key:"Balanced",kind:"neutral"};
  const maps=[
    [/spell|instant|sorcery|magecraft|storm|cantrip/,"spellslinger","Spellslinger"],
    [/artifact/,"artifacts","Artifacts"],[/enchant/,"enchantments","Enchantments"],[/token/,"tokens","Tokens"],
    [/reanim|graveyard/,"graveyard","Graveyard"],[/aristocrat|sacrifice|death/,"sacrifice","Aristocrats"],
    [/^ramp$/,"role:ramp","Ramp"],[/^(?:lands?|lands? matter|landfall)$/,"lands","Lands"],[/equipment|voltron/,"equipment","Equipment"],
    [/aura/,"auras","Auras"],[/clone|copy/,"clones","Clones"],[/historic/,"historic","Historic"],
    [/legend/,"legends","Legends"],[/counter/,"counters","Counters"],[/life ?gain/,"lifegain","Lifegain"]
  ];
  for(const [re,facet,key] of maps)if(re.test(a))return {facet,key,kind:facet.startsWith("role:")?"role":"facet"};
  const cleaned=a.replace(/\b(kindred|tribal|typal|creatures?|theme)\b/g," ").replace(/\s+/g," ").trim(),word=singular(cleaned);
  const explicit=/\b(kindred|tribal|typal)\b/.test(a),matchesCard=card&&subtypeSet(card).has(word);
  if(word&&word.split(" ").length<=2&&(explicit||matchesCard))return {facet:`kindred:${slug(word)}`,key:"Kindred",kind:"kindred"};
  return {facet:null,key:null,kind:"unknown"};
}

export function themeSupportForCard(card,theme){
  const mapped=themeFacetForLabel(theme,card);
  if(mapped.kind==="neutral")return {supported:true,key:"Balanced",facet:null,reason:"neutral structural fallback"};
  if(mapped.facet)return {supported:true,key:mapped.key||mapped.facet,facet:mapped.facet,reason:`Semantic v2 Theme View facet ${mapped.facet}`};
  return {supported:false,key:null,facet:null,reason:"theme label not mapped to a Semantic v2 facet"};
}

export function themeModeForCard(card,theme){
  const support=themeSupportForCard(card,theme);
  return {mode:support.supported?"semantic":"external_fallback",semanticSupported:Boolean(support.supported),semanticContractKey:support.key||null,semanticFacet:support.facet||null,semanticSupportReason:support.reason};
}

export function decorateEdhrecThemesForLab3(card,tags,{limit=18}={}){
  return (Array.isArray(tags)?tags:[]).slice(0,limit).map(tag=>({...tag,...themeModeForCard(card,tag?.name),themeSource:"edhrec"}));
}

export function themeContractFor(card,theme){
  const support=themeSupportForCard(card,theme);
  if(support.key==="Balanced")return {contract:"theme_view_v1",archetype:"Balanced",status:COVERAGE.SUPPORTED,adjudication:"no_evidence",score:0,confidence:1,reason:support.reason,dependencies:[],dependencyGroups:[],evidence:[],coverageGaps:[]};
  if(!support.supported)return {contract:"theme_view_v1",archetype:String(theme||""),status:COVERAGE.GAP,adjudication:"no_evidence",score:0,confidence:0,reason:support.reason,dependencies:[],dependencyGroups:[],evidence:[],coverageGaps:[`LAB3_THEME_UNSUPPORTED:${theme}`]};
  const semantic=deriveContextProfile(card),facet=support.facet,score=facet?.startsWith("role:")?Number(semantic.roleScores[facet.slice(5)]||0):Number(semantic.theme.facets?.[facet]?.strength||0);
  return {contract:"theme_view_v1",archetype:support.key||String(theme||""),facet,status:COVERAGE.SUPPORTED,adjudication:score>0?"positive":"no_evidence",score:clamp01(score),confidence:1,reason:support.reason,dependencies:[],dependencyGroups:[],evidence:facet?.startsWith("role:")?(semantic.roles?.[facet.slice(5)]?.evidence||[]):(semantic.theme.facets?.[facet]?.evidence||[]),coverageGaps:[]};
}

export function cardProfile(card,{theme="",themeMode="semantic",themeModel=null,commander=null,external={}}={}){
  const semantic=deriveContextProfile(card),support=themeSupportForCard(card,theme),themeContract=themeContractFor(card,theme),types=typeSet(card),subtypes=subtypeSet(card);
  const directSemantic=themeContract.adjudication==="positive"?Number(themeContract.score||0):0,inferredSemantic=themeModel?.mode==="semantic_inferred"?scoreCardForThemeModel(card,themeModel):0,compositeSupport=themeModel?.composite?scoreCardForThemeSupportDetail(card,themeModel):{score:0,strongestFamily:null,familyScores:{},matchedFamilies:[]},compositeSemantic=Number(compositeSupport.score||0),semanticTheme=clamp01(Math.max(directSemantic,inferredSemantic,compositeSemantic)),externalTheme=clamp01(Number(external.themeAffinity||external.edhrecThemeScore||0)),externalCommander=clamp01(Number(external.commanderAffinity||external.edhrecBaseScore||0));
  const effectiveMode=themeModel?.mode||themeMode,externalFallback=effectiveMode==="external_fallback",fallbackThemeScore=externalTheme>0?clamp01(.18+externalTheme*.82):0;
  const themeScore=externalFallback?clamp01(fallbackThemeScore+semanticTheme*.12):effectiveMode==="semantic_inferred"?clamp01(semanticTheme*.72+externalTheme*.28):clamp01(semanticTheme*.82+externalTheme*.18),themeEvidenceSource=externalFallback?(externalTheme>0?"edhrec_external_fallback":"none"):(effectiveMode==="semantic_inferred"?(semanticTheme>0&&externalTheme>0?"semantic_inferred+edhrec":semanticTheme>0?"semantic_inferred":externalTheme>0?"edhrec_rank":"none"):(compositeSemantic>directSemantic&&compositeSemantic>0?(externalTheme>0?"semantic_composite+edhrec":"semantic_composite"):(semanticTheme>0&&externalTheme>0?"semantic+edhrec":semanticTheme>0?"semantic":externalTheme>0?"edhrec_rank":"none")));
  const inferredFacet=effectiveMode==="semantic_inferred"?dominantThemeFeature(card,themeModel):(themeModel?.composite&&compositeSemantic>directSemantic?dominantThemeFeature(card,{features:themeModel.secondaryFeatures||{}}):null),commanderProfile=commander?deriveContextProfile(commander):null,structuredCommander=commanderProfile?commanderLinkForProfiles(semantic,commanderProfile):{score:0,helpsCommander:[],helpedByCommander:[]},directCommanderSynergy=clamp01(Number(structuredCommander.score||0)*.9+externalCommander*.25);
  return {card,semantic,themeContract,themeMode:effectiveMode,themeFacet:inferredFacet?`inferred:${inferredFacet}`:support.facet,themeEvidenceSource,roleScores:semantic.roleScores,semanticTheme,directSemantic,compositeSemantic,compositeSupport,externalTheme,themeScore,statusWeight:semantic.coverageWeight,produces:uniq(semantic.dependency.produces),needs:uniq(semantic.dependency.externalNeeds),types:[...types],subtypes:[...subtypes],directCommanderSynergy,commanderSynergy:{structured:Number(structuredCommander.score||0),helpsCommander:structuredCommander.helpsCommander||[],helpedByCommander:structuredCommander.helpedByCommander||[],external:externalCommander},external};
}

function cardsOf(profiles){return (profiles||[]).map(x=>x?.card||x).filter(Boolean);}
function commanderCard(x){return x?.card||x||null;}
export function buildContextState(profiles,{commander=null,theme="",themeFacet=null,roleTargets={}}={}){
  const mapped=themeFacet||themeFacetForLabel(theme,commanderCard(commander)).facet;
  return buildSemanticContextState(cardsOf(profiles),{commander:commanderCard(commander),themeFacet:mapped?.startsWith("role:")?null:mapped,roleTargets});
}

function rowFor(profile,ctx){const id=profile?.card?.oracleId;return (id&&ctx?._rowByOracleId?.get?.(id))||ctx?.cards?.find(x=>x.oracleId===id)||null;}
export function profileDependencySatisfaction(profile,ctx){const row=rowFor(profile,ctx);return Number(row?.context?.dependencyReliability??evaluateProfileDependencies(profile.semantic,ctx).reliability);}
export function profileSupportContribution(profile,ctx){const row=rowFor(profile,ctx);return Number(row?.context?.supportContribution??evaluateProfileSupport(profile.semantic,ctx).score);}

function packageLinks(state){
  const supports=(producer,need)=>{const sigs=new Set([...(producer.dependency?.produces||[]),...(producer.card?.signals?.produces||[])]);if(sigs.has(need))return true;if(need==="card:instant_sorcery")return sigs.has("card:type:instant")||sigs.has("card:type:sorcery");if(need==="event:instant_sorcery_spell_cast")return sigs.has("card:type:instant")||sigs.has("card:type:sorcery");return false;};
  const rows=[];for(const consumer of state.cards||[]){for(const need of consumer.dependency?.externalNeeds||[]){for(const producer of state.cards||[]){if(producer.oracleId===consumer.oracleId)continue;if(supports(producer,need)){rows.push({producer:producer.name,consumer:consumer.name,signal:need,producerCoverage:producer.coverageWeight,consumerDependencySatisfaction:consumer.context?.dependencyReliability??1});if(rows.length>=200)return rows;}}}}return rows;
}
export function analyzeDeckContext(profiles,{commander=null,theme="",roleTargets={}}={}){
  const state=buildContextState(profiles,{commander,theme,roleTargets}),links=packageLinks(state),cards=state.cards.map(x=>({...x,dependencySatisfaction:x.context.dependencyReliability,supportContribution:x.context.supportContribution,unsatisfiedDependencies:(x.dependency?.externalNeeds||[]).filter(s=>state.bottlenecks.some(b=>b.signal===s)),deadCardRisk:clamp01((1-x.context.dependencyReliability)*.82+x.context.unresolvedRisk*.18),contextualSynergy:x.context.structuralScore}));
  const demanded=Object.entries(state.demand||{}),redundancy=demanded.length?demanded.reduce((n,[signal,count])=>n+clamp01(Number(state.supply?.[signal]||0)/Math.max(2,Math.min(4,Number(count)||2))),0)/demanded.length:1;
  const dependencySatisfaction=Number(state.summary.dependentCards||0)>0?Number(state.summary.avgDependentDependencyReliability||0):1;
  return {...state,cards,packageLinks:links,summary:{...state.summary,avgDependencySatisfaction:dependencySatisfaction,avgDeadCardRisk:cards.length?cards.reduce((n,x)=>n+x.deadCardRisk,0)/cards.length:0,avgContextualSynergy:state.summary.avgStructuralScore,dependencyCoverage:dependencySatisfaction,dependencyRedundancy:redundancy,packageLinks:links.length,commanderDependence:cards.length?cards.filter(x=>x.dependency?.summary?.commanderDependent).length/cards.length:0}};
}

export function dependencySatisfactionForProfile(profile,profiles){return analyzeDeckContext(profiles).cards.find(x=>x.oracleId===profile.card.oracleId)?.dependencySatisfaction??1;}
