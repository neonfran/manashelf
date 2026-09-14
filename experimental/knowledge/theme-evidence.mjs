import {fingerprint} from "./io.mjs";

export const THEME_EVIDENCE_SCHEMA="manashelf-theme-evidence";
export const THEME_EVIDENCE_VERSION=2;
export const THEME_EVIDENCE_USAGE="training";
export const DEFAULT_THEME_EVIDENCE_QUALITY=Object.freeze({minThemeDecksPerSample:5});

const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const blockedSourceKinds=new Set(["stress","stress-corpus","holdout","unseen","validation","diagnostic","diagnostic-only"]);
const key=s=>String(s||"").trim().toLocaleLowerCase("en-US");
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};

export function edhrecCardScore(card={}){
  const synergy=Number(card.synergy||0),numDecks=Number(card.numDecks??card.num_decks??0)||0,potentialDecks=Number(card.potentialDecks??card.potential_decks??0)||0,raw=Number(card.inclusion||0)||0;
  const inclusion=potentialDecks>0&&numDecks>0?numDecks/potentialDecks:(raw>1?raw/100:raw),positiveSynergy=clamp01((synergy+.04)/.70);
  return clamp01(.68*clamp01(inclusion)+.32*positiveSynergy);
}

export function scoreEdhrecLists(lists=[]){
  const out=new Map();
  for(const list of lists||[])for(const card of list?.cards||[]){
    const name=String(card?.name||"").trim();if(!name)continue;
    const score=edhrecCardScore(card),k=key(name),prev=out.get(k);if(!prev||score>prev.score)out.set(k,{name,score,category:list?.label||list?.id||null});
  }
  return out;
}

export function themeSampleReliability(sample={},qualityPolicy=DEFAULT_THEME_EVIDENCE_QUALITY){
  const min=Math.max(1,Number(qualityPolicy?.minThemeDecksPerSample||DEFAULT_THEME_EVIDENCE_QUALITY.minThemeDecksPerSample)),decks=Math.max(0,Number(sample?.themeCount||0));
  if(decks<min)return {accepted:false,decks,weight:0,reason:"low_theme_deck_volume"};
  // Diminishing returns: 5 decks contribute some evidence, ~100 decks reach full row weight.
  const weight=clamp01(Math.sqrt(Math.min(100,decks)/100));
  return {accepted:true,decks,weight,reason:null};
}

function validateSource(source={}){
  const kind=key(source.kind);
  if(!kind)throw new Error("Theme Evidence source.kind is required");
  if(blockedSourceKinds.has(kind)||source.validation===true||source.diagnosticOnly===true)throw new Error(`Theme Evidence source is validation-only and cannot train the corpus: ${source.kind}`);
  if(source.independentFromValidation!==true)throw new Error("Theme Evidence source must declare independentFromValidation=true");
}

export function assertThemeEvidenceArtifact(artifact){
  if(artifact?.schema!==THEME_EVIDENCE_SCHEMA||Number(artifact?.schemaVersion)!==THEME_EVIDENCE_VERSION)throw new Error("Invalid Theme Evidence schema");
  if(artifact?.usage!==THEME_EVIDENCE_USAGE)throw new Error("Theme Evidence artifact is not marked for training use");
  validateSource(artifact.source||{});
  if(!artifact?.runtimeSha256)throw new Error("Theme Evidence artifact must pin runtimeSha256");
  if(!artifact?.themes||typeof artifact.themes!=="object"||Array.isArray(artifact.themes))throw new Error("Theme Evidence themes must be an object");
  if(!artifact?.themeStats||typeof artifact.themeStats!=="object"||Array.isArray(artifact.themeStats))throw new Error("Theme Evidence artifact must include themeStats");
  return artifact;
}

export function createThemeEvidenceArtifact({samples=[],resolveCard,runtimeSha256,seed="manashelf-theme-evidence-v2",source={},provenance={},qualityPolicy={}}={}){
  if(typeof resolveCard!=="function")throw new Error("createThemeEvidenceArtifact requires resolveCard(name)");
  if(!runtimeSha256)throw new Error("createThemeEvidenceArtifact requires runtimeSha256");
  validateSource(source);
  const policy={...DEFAULT_THEME_EVIDENCE_QUALITY,...qualityPolicy},grouped=new Map(),stats=new Map(),commanders=new Set(),unresolved=new Set();let samplesInput=0,samplesAccepted=0,samplesRejectedLowVolume=0;
  for(const sample of samples||[]){
    const theme=String(sample?.theme||sample?.themeName||"").trim(),commander=String(sample?.commander||"").trim();if(!theme||!commander)continue;
    samplesInput++;const reliability=themeSampleReliability(sample,policy),themeStat=stats.get(theme)||{theme,samplesInput:0,samplesAccepted:0,samplesRejectedLowVolume:0,commanderOracleIds:new Set(),commanders:new Set(),themeDeckCounts:[],totalThemeDecks:0};themeStat.samplesInput++;
    if(!reliability.accepted){samplesRejectedLowVolume++;themeStat.samplesRejectedLowVolume++;stats.set(theme,themeStat);continue;}
    samplesAccepted++;themeStat.samplesAccepted++;themeStat.commanders.add(commander);if(sample.commanderOracleId)themeStat.commanderOracleIds.add(String(sample.commanderOracleId));themeStat.themeDeckCounts.push(reliability.decks);themeStat.totalThemeDecks+=reliability.decks;stats.set(theme,themeStat);commanders.add(commander);
    const base=scoreEdhrecLists(sample.baseLists||[]),themed=scoreEdhrecLists(sample.themeLists||[]),names=new Set([...base.keys(),...themed.keys()]),themeMap=grouped.get(theme)||new Map();
    for(const nameKey of names){
      const display=themed.get(nameKey)?.name||base.get(nameKey)?.name||nameKey,semanticCard=resolveCard(display);if(!semanticCard){unresolved.add(display);continue;}
      const oracleId=String(semanticCard.oracleId||semanticCard.oracle_id||"");if(!oracleId){unresolved.add(display);continue;}
      const row=themeMap.get(oracleId)||{oracleId,name:semanticCard.name||display,themeWeightedSum:0,baseWeightedSum:0,weightSum:0,samples:0,sourceDecks:0,sourceRefs:[]};
      row.themeWeightedSum+=Number(themed.get(nameKey)?.score||0)*reliability.weight;row.baseWeightedSum+=Number(base.get(nameKey)?.score||0)*reliability.weight;row.weightSum+=reliability.weight;row.samples++;row.sourceDecks+=reliability.decks;
      if(sample.sourceId&&row.sourceRefs.length<20)row.sourceRefs.push(String(sample.sourceId));
      themeMap.set(oracleId,row);
    }
    grouped.set(theme,themeMap);
  }
  const themes={},themeStats={};let evidenceRows=0;
  for(const theme of [...new Set([...grouped.keys(),...stats.keys()])].sort((a,b)=>a.localeCompare(b))){
    const rows=[...(grouped.get(theme)||new Map()).values()].map(r=>({oracleId:r.oracleId,name:r.name,edhrecThemeScore:clamp01(r.themeWeightedSum/Math.max(.000001,r.weightSum)),edhrecBaseScore:clamp01(r.baseWeightedSum/Math.max(.000001,r.weightSum)),sampleCount:r.samples,sourceWeight:Number(r.weightSum.toFixed(6)),sourceDecks:r.sourceDecks,sourceRefs:[...new Set(r.sourceRefs)].sort()})).sort((a,b)=>a.oracleId.localeCompare(b.oracleId));
    themes[theme]=rows;evidenceRows+=rows.length;
    const s=stats.get(theme)||{samplesInput:0,samplesAccepted:0,samplesRejectedLowVolume:0,commanderOracleIds:new Set(),commanders:new Set(),themeDeckCounts:[],totalThemeDecks:0},decks=s.themeDeckCounts||[];
    themeStats[theme]={samplesInput:s.samplesInput||0,samplesAccepted:s.samplesAccepted||0,samplesRejectedLowVolume:s.samplesRejectedLowVolume||0,sourceCommanders:(s.commanderOracleIds?.size||s.commanders?.size||0),sourceCommanderOracleIds:[...(s.commanderOracleIds||[])].sort(),totalThemeDecks:s.totalThemeDecks||0,minThemeDecks:decks.length?Math.min(...decks):0,medianThemeDecks:median(decks),maxThemeDecks:decks.length?Math.max(...decks):0};
  }
  const core={schema:THEME_EVIDENCE_SCHEMA,schemaVersion:THEME_EVIDENCE_VERSION,usage:THEME_EVIDENCE_USAGE,seed,runtimeSha256,source:{...source},qualityPolicy:policy,provenance:{...provenance},themes,themeStats,summary:{samplesInput,samplesAccepted,samplesRejectedLowVolume,commanders:commanders.size,themes:Object.keys(themes).length,evidenceRows,unresolvedCards:unresolved.size}};
  return {...core,fingerprint:fingerprint(core),unresolvedCards:[...unresolved].sort()};
}
