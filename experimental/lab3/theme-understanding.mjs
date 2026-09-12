export const LAB3_THEME_UNDERSTANDING_VERSION=1;
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const arr=x=>Array.isArray(x)?x:[];
const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const extTheme=c=>clamp01(Number(c?.edhrecThemeScore??c?.themeAffinity??0));
const extBase=c=>clamp01(Number(c?.edhrecBaseScore??c?.commanderAffinity??0));
const singular=x=>{const s=norm(x),irr={mice:"mouse",people:"person",elves:"elf",dwarves:"dwarf",wolves:"wolf",zombies:"zombie",faeries:"faerie",auras:"aura",ninjas:"ninja"};if(irr[s])return irr[s];if(/(?:ches|shes|xes|zes)$/.test(s))return s.slice(0,-2);if(s.endsWith("ies"))return s.slice(0,-3)+"y";return s.endsWith("s")&&!/(?:ss|us|is)$/.test(s)?s.slice(0,-1):s;};
const themeTokens=theme=>[...new Set(norm(theme).split("_").map(singular).filter(x=>x&&x.length>=3&&!new Set(["theme","matter","matters","deck","decks","card","cards","with","without"]).has(x)))];
const featureLexicalMatch=(feature,tokens)=>{const parts=String(feature||"").split(/[:_]+/).map(singular);return tokens.some(t=>parts.includes(t));};
const infrastructureFeature=feature=>/(?:^facet:lands$|^role:(?:mana_source|land_slot|ramp)$|add_mana|play_as_land|be_land|resource_mana|permanent_land|card_type_land|^type:land$)/.test(String(feature||""));
const infrastructureTheme=tokens=>tokens.some(t=>["land","mana","ramp"].includes(t));

export function runtimeThemeFeatures(card){
  const direct=card?.views?.themeFeatures?.features;if(direct&&typeof direct==="object")return direct;
  const out={};const add=(k,v=1)=>{v=clamp01(v);if(k&&v>Number(out[k]||0))out[k]=v;};
  for(const row of arr(card?.views?.theme?.ranked))add(`facet:${row.facet}`,row.strength);
  for(const [role,row] of Object.entries(card?.views?.roles||{}))add(`role:${norm(role)}`,row?.potentialScore??row?.score??0);
  for(const kw of arr(card?.keywords))add(`keyword:${norm(kw)}`,1);
  for(const face of arr(card?.faces)){
    if(!["default","alternative_entry"].includes(face?.access?.kind||"default"))continue;
    for(const type of arr(face?.cardTypes))add(`type:${norm(type)}`,.9);
    for(const st of arr(face?.subtypes))add(`subtype:${norm(st)}`,.82);
  }
  for(const s of arr(card?.views?.dependency?.produces))add(`produce:${norm(s)}`,.78);
  for(const s of arr(card?.views?.dependency?.externalNeeds))add(`need:${norm(s)}`,.72);
  return out;
}

function evidenceWeight(candidate){
  const theme=extTheme(candidate),base=extBase(candidate);
  // Theme-specific evidence should dominate generic Commander staples.  This is
  // contrastive, not theme-specific: every EDHREC theme uses the same formula.
  const residual=Math.max(0,theme-base*.42);
  return residual>0?Math.pow(residual,1.35):theme>0?Math.pow(theme*.35,1.35):0;
}

export function inferThemeModel(candidates,{theme="",directFacet=null,minEvidenceCards=6,maxFeatures=36}={}){
  const rows=(candidates||[]).filter(c=>c?.semanticCard),positive=rows.map(c=>({candidate:c,w:evidenceWeight(c)})).filter(x=>x.w>.005);
  const rawScores=rows.map(extTheme).sort((a,b)=>a-b),quantile=q=>rawScores.length?rawScores[Math.min(rawScores.length-1,Math.max(0,Math.floor((rawScores.length-1)*q)))]:0,q20=quantile(.2),q80=quantile(.8),zeroShare=rawScores.length?rawScores.filter(x=>x<=.001).length/rawScores.length:1,contrastFactor=clamp01(Math.max((q80-q20)/.28,zeroShare*.9));
  const direct=directFacet?String(directFacet):null;
  if(!positive.length){
    return {version:LAB3_THEME_UNDERSTANDING_VERSION,theme,mode:direct?"semantic_direct":"external_fallback",directFacet:direct,confidence:direct?1:0,evidenceCards:0,features:direct?{[`facet:${direct}`]:1}:{},featureRows:[]};
  }
  const posWeight=positive.reduce((n,x)=>n+x.w,0),lowCut=zeroShare>=.12?.001:q20,baselineRows=rows.filter(c=>extTheme(c)<=lowCut+1e-9),baselineN=Math.max(1,baselineRows.length),stats=new Map(),baseMean=new Map(),baseCount=new Map();
  for(const c of baselineRows){for(const [feature,value] of Object.entries(runtimeThemeFeatures(c.semanticCard))){baseMean.set(feature,(baseMean.get(feature)||0)+Number(value||0));baseCount.set(feature,(baseCount.get(feature)||0)+1);}}
  for(const {candidate,w} of positive){for(const [feature,value] of Object.entries(runtimeThemeFeatures(candidate.semanticCard))){const st=stats.get(feature)||{weighted:0,support:0,max:0};st.weighted+=w*Number(value||0);st.support++;st.max=Math.max(st.max,Number(value||0));stats.set(feature,st);}}
  const tokens=themeTokens(theme),featureRows=[];
  for(const [feature,st] of stats){
    const themeMean=st.weighted/Math.max(.0001,posWeight),baseline=(baseMean.get(feature)||0)/baselineN,support=st.support/positive.length,lift=Math.max(0,themeMean-baseline),specificity=clamp01(lift/Math.max(.08,themeMean)),lexical=featureLexicalMatch(feature,tokens),infra=infrastructureFeature(feature)&&!infrastructureTheme(tokens),baseWeight=themeMean*Math.pow(specificity,.72)*Math.sqrt(Math.min(1,support*2.6)),weight=clamp01(baseWeight*(lexical?1.32:1)*(infra?.18:1));
    if(st.support<2||support<.06||(!lexical&&specificity<.16)||weight<(lexical?.045:.07))continue;
    featureRows.push({feature,weight,themeMean,baseline,support,specificity,lexical});
  }
  if(direct&&!featureRows.some(x=>x.feature===`facet:${direct}`))featureRows.push({feature:`facet:${direct}`,weight:1,themeMean:1,baseline:0,support:1,specificity:1,prior:true});
  featureRows.sort((a,b)=>b.weight-a.weight||b.specificity-a.specificity||a.feature.localeCompare(b.feature));
  const kept=featureRows.slice(0,maxFeatures),features=Object.fromEntries(kept.map(x=>[x.feature,x.weight]));
  const provisional={features},posScores=positive.slice(0,400).map(x=>scoreCardForThemeModel(x.candidate.semanticCard,provisional)),baseScores=baselineRows.filter((_,i)=>i%Math.max(1,Math.floor(baselineRows.length/300))===0).slice(0,300).map(c=>scoreCardForThemeModel(c.semanticCard,provisional)),posMean=posScores.length?posScores.reduce((a,b)=>a+b,0)/posScores.length:0,baseScoreMean=baseScores.length?baseScores.reduce((a,b)=>a+b,0)/baseScores.length:0,separation=posMean-baseScoreMean,lexicalHits=kept.filter(x=>x.lexical).length;
  const evidenceFactor=clamp01(positive.length/Math.max(minEvidenceCards,18)),signal=kept.length?kept.slice(0,10).reduce((n,x)=>n+x.weight,0)/Math.min(10,kept.length):0,confidence=direct?1:clamp01((evidenceFactor*.48+signal*.27+clamp01((separation+.02)/.22)*.25)*contrastFactor);
  const reliable=separation>=.045||lexicalHits>=2&&separation>=.015,inferred=!direct&&positive.length>=minEvidenceCards&&kept.length>=3&&contrastFactor>=.25&&reliable&&confidence>=.65;
  return {version:LAB3_THEME_UNDERSTANDING_VERSION,theme,mode:direct?"semantic_direct":inferred?"semantic_inferred":"external_fallback",directFacet:direct,confidence,evidenceCards:positive.length,positiveWeight:posWeight,externalContrast:contrastFactor,separation,lexicalHits,features,featureRows:kept};
}

export function scoreCardForThemeModel(card,model){
  if(!model||!card)return 0;const signature=model.features||{},entries=Object.entries(signature);if(!entries.length)return 0;
  const features=runtimeThemeFeatures(card),matched=[];let num=0,den=0;
  for(const [feature,w] of entries){den+=w;const v=Number(features[feature]||0);if(v>0){const contribution=w*clamp01(v);num+=contribution;matched.push({feature,weight:w,value:v,contribution});}}
  const coverage=den?num/den:0;
  // Reward several independent semantic matches; one generic feature alone is not enough.
  const breadth=clamp01(matched.length/Math.min(7,entries.length));
  const score=clamp01(coverage*(.72+.28*breadth));
  return score;
}

export function themeModelSummary(model){return {version:model?.version||LAB3_THEME_UNDERSTANDING_VERSION,mode:model?.mode||"external_fallback",confidence:Number(model?.confidence||0),evidenceCards:Number(model?.evidenceCards||0),directFacet:model?.directFacet||null,topFeatures:(model?.featureRows||[]).slice(0,12).map(x=>({feature:x.feature,weight:Number(x.weight||0),support:Number(x.support||0),specificity:Number(x.specificity||0)}))};}

export function dominantThemeFeature(card,model){
  if(!model?.features)return null;const features=runtimeThemeFeatures(card);let best=null,bestScore=0;
  for(const [feature,w] of Object.entries(model.features)){const score=Number(w||0)*Number(features[feature]||0);if(score>bestScore){best=feature;bestScore=score;}}
  return best;
}
