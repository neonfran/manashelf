export const LAB3_THEME_UNDERSTANDING_VERSION=6;
export const THEME_CORPUS_RUNTIME_MEMBERSHIP_FLOOR=.18;
export const COMPOSITE_SECONDARY_SEMANTIC_FLOOR=.12;
export const COMPOSITE_SECONDARY_STRONG_FLOOR=.20;
export const COMPOSITE_SECONDARY_EXTERNAL_FLOOR=.08;
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
const featureFamily=feature=>{
  const f=String(feature||"");
  const action=f.match(/^action(?:_[^:]+)?:([^:]+)/);if(action)return `action:${action[1]}`;
  if(/^zone_(?:move|source|destination):/.test(f))return "zone_transition";
  const signal=f.match(/^(produce|need):([^:]+)/);if(signal)return `${signal[1]}:${signal[2]}`;
  const simple=f.match(/^(facet|role|type|subtype|keyword):([^:]+)/);if(simple)return `${simple[1]}:${simple[2]}`;
  return f.split(":",1)[0]||f;
};

function supportSignature(rows,{directFeature=null,maxFamilies=10}={}){
  const best=new Map();
  for(const row of rows||[]){
    if(!row?.feature||row.feature===directFeature||infrastructureFeature(row.feature))continue;
    // A composite strategy may contain an orthogonal Semantic facet in addition to
    // the direct anchor (for example, a second package learned from field evidence).
    // Keep distinct `facet:*` rows because they are runtime semantic categories, but
    // still reject lower-level printed-identity aliases (type/subtype/keyword and
    // card/permanent/package echoes) that can duplicate the same fact many times.
    if(/^(?:type|subtype|keyword):/.test(row.feature)||/^(?:produce|need):(?:card_|permanent_|package_)/.test(row.feature))continue;
    // A second facet that appears almost exclusively on anchor cards is an alias/parent
    // identity of the anchor, not an independent strategic family. Keep facet evidence
    // only when it has meaningful support outside the direct anchor population.
    if(/^facet:/.test(row.feature)&&Number(row.anchorOverlap||0)>=.85&&Number(row.nonAnchorSupport||0)<.06)continue;
    // Intrinsic keyword capabilities describe what this card *is*, not what it does for
    // the surrounding strategy.  A flying creature must not become Voltron support merely
    // because the evidence set often contains cards that grant flying.
    const family=featureFamily(row.feature);
    if(family==="action:has_keyword"||family==="action:keyword")continue;
    // Signals that merely state that this card itself was cast are identity/provenance,
    // not strategic behaviour. Keeping them lets any noncreature spell masquerade as
    // compound-theme support. Consumer-side `need:event_*_spell_cast` remains valid.
    if(/^produce:event_.*spell_cast$/.test(row.feature))continue;
    if(Number(row.weight||0)<.075||Number(row.specificity||0)<.30||Number(row.support||0)<.12)continue;
    const prev=best.get(family);
    if(!prev||Number(row.weight||0)>Number(prev.weight||0))best.set(family,{...row,family});
  }
  return [...best.values()].sort((a,b)=>Number(b.weight||0)-Number(a.weight||0)||String(a.feature).localeCompare(String(b.feature))).slice(0,maxFamilies);
}

export function runtimeThemeFeatures(card){
  const direct=card?.views?.themeFeatures?.features;
  const out=direct&&typeof direct==="object"?{...direct}:{};const add=(k,v=1)=>{v=clamp01(v);if(k&&v>Number(out[k]||0))out[k]=v;};
  if(direct&&typeof direct==="object")return out;
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
    return {version:LAB3_THEME_UNDERSTANDING_VERSION,theme,mode:direct?"semantic_direct":"external_fallback",directFacet:direct,confidence:direct?1:0,evidenceCards:0,features:direct?{[`facet:${direct}`]:1}:{},featureRows:[],composite:false,secondaryFeatures:{},secondaryFeatureRows:[],secondaryFamilyPriors:{}};
  }
  const posWeight=positive.reduce((n,x)=>n+x.w,0),lowCut=zeroShare>=.12?.001:q20,baselineRows=rows.filter(c=>extTheme(c)<=lowCut+1e-9),baselineN=Math.max(1,baselineRows.length),stats=new Map(),baseMean=new Map(),baseCount=new Map(),directFeature=direct?`facet:${direct}`:null;
  for(const c of baselineRows){for(const [feature,value] of Object.entries(runtimeThemeFeatures(c.semanticCard))){baseMean.set(feature,(baseMean.get(feature)||0)+Number(value||0));baseCount.set(feature,(baseCount.get(feature)||0)+1);}}
  for(const {candidate,w} of positive){const cardFeatures=runtimeThemeFeatures(candidate.semanticCard),hasAnchor=Boolean(directFeature&&Number(cardFeatures[directFeature]||0)>0);for(const [feature,value] of Object.entries(cardFeatures)){const st=stats.get(feature)||{weighted:0,support:0,max:0,anchorCooccur:0};st.weighted+=w*Number(value||0);st.support++;st.max=Math.max(st.max,Number(value||0));if(hasAnchor)st.anchorCooccur++;stats.set(feature,st);}}
  const directStat=directFeature?stats.get(directFeature):null,anchorEvidenceSupport=directStat?directStat.support/positive.length:0,anchorThemeMean=directStat?directStat.weighted/Math.max(.0001,posWeight):0;
  const tokens=themeTokens(theme),featureRows=[];
  for(const [feature,st] of stats){
    const themeMean=st.weighted/Math.max(.0001,posWeight),baseline=(baseMean.get(feature)||0)/baselineN,support=st.support/positive.length,lift=Math.max(0,themeMean-baseline),specificity=clamp01(lift/Math.max(.08,themeMean)),lexical=featureLexicalMatch(feature,tokens),infra=infrastructureFeature(feature)&&!infrastructureTheme(tokens),baseWeight=themeMean*Math.pow(specificity,.72)*Math.sqrt(Math.min(1,support*2.6)),weight=clamp01(baseWeight*(lexical?1.32:1)*(infra?.18:1));
    if(st.support<2||support<.06||(!lexical&&specificity<.16)||weight<(lexical?.045:.07))continue;
    const anchorOverlap=st.support?Number(st.anchorCooccur||0)/st.support:0,nonAnchorSupport=Math.max(0,st.support-Number(st.anchorCooccur||0))/positive.length;
    featureRows.push({feature,weight,themeMean,baseline,support,specificity,lexical,anchorOverlap,nonAnchorSupport});
  }
  if(direct&&!featureRows.some(x=>x.feature===`facet:${direct}`))featureRows.push({feature:`facet:${direct}`,weight:1,themeMean:1,baseline:0,support:1,specificity:1,prior:true});
  featureRows.sort((a,b)=>b.weight-a.weight||b.specificity-a.specificity||a.feature.localeCompare(b.feature));
  const kept=featureRows.slice(0,maxFeatures),features=Object.fromEntries(kept.map(x=>[x.feature,x.weight]));
  const provisional={features},posScores=positive.slice(0,400).map(x=>scoreCardForThemeModel(x.candidate.semanticCard,provisional)),baseScores=baselineRows.filter((_,i)=>i%Math.max(1,Math.floor(baselineRows.length/300))===0).slice(0,300).map(c=>scoreCardForThemeModel(c.semanticCard,provisional)),posMean=posScores.length?posScores.reduce((a,b)=>a+b,0)/posScores.length:0,baseScoreMean=baseScores.length?baseScores.reduce((a,b)=>a+b,0)/baseScores.length:0,separation=posMean-baseScoreMean,lexicalHits=kept.filter(x=>x.lexical).length;
  const evidenceFactor=clamp01(positive.length/Math.max(minEvidenceCards,18)),signal=kept.length?kept.slice(0,10).reduce((n,x)=>n+x.weight,0)/Math.min(10,kept.length):0,confidence=direct?1:clamp01((evidenceFactor*.48+signal*.27+clamp01((separation+.02)/.22)*.25)*contrastFactor);
  const reliable=separation>=.045||lexicalHits>=2&&separation>=.015;
  // Theme Understanding v3 calibrates confidence against contrastive separation.
  // A model with strong positive-vs-baseline separation should not be discarded
  // solely because generic semantic features lower the aggregate confidence score.
  // This gate is theme-agnostic and uses only evidence quality.
  const strongCompactSignal=separation>=.12&&contrastFactor>=.85&&kept.length<=16;
  const confidenceGate=confidence>=.60||(confidence>=.58&&strongCompactSignal);
  const inferred=!direct&&positive.length>=minEvidenceCards&&kept.length>=3&&contrastFactor>=.25&&reliable&&confidenceGate;
  const secondaryFeatureRows=direct?supportSignature(kept,{directFeature}):[],secondaryFeatures=Object.fromEntries(secondaryFeatureRows.map(x=>[x.feature,x.weight]));
  const secondaryPriorRaw=secondaryFeatureRows.map(row=>({family:row.family||featureFamily(row.feature),value:Number(row.weight||0)*(.65+.35*Number(row.specificity||0))*(.72+.28*Math.sqrt(clamp01(Number(row.support||0))))})),secondaryPriorDen=secondaryPriorRaw.reduce((n,x)=>n+x.value,0),secondaryFamilyPriors=Object.fromEntries(secondaryPriorRaw.map(x=>[x.family,secondaryPriorDen?x.value/secondaryPriorDen:0]));
  // A direct Semantic facet is an anchor, not necessarily the entire strategy.  When
  // independent EDHREC evidence consistently exposes multiple structured semantic
  // families, keep those families as a secondary signature.  The rule is generic:
  // no Commander/theme/card name participates in this decision.
  const composite=Boolean(direct&&positive.length>=minEvidenceCards&&secondaryFeatureRows.length>=2&&contrastFactor>=.25);
  // The direct facet's prevalence in positive evidence becomes a soft selection prior.
  // This is learned from the same evidence for every theme: a broad umbrella strategy
  // gets a lower anchor share, while a genuinely facet-centric theme can remain anchor-heavy.
  const anchorSignal=clamp01(anchorEvidenceSupport*.70+anchorThemeMean*.30),anchorTargetShare=composite?clamp01(Math.max(.12,Math.min(.78,.08+anchorSignal*1.35))):null;
  return {version:LAB3_THEME_UNDERSTANDING_VERSION,theme,mode:direct?"semantic_direct":inferred?"semantic_inferred":"external_fallback",directFacet:direct,confidence,evidenceCards:positive.length,positiveWeight:posWeight,externalContrast:contrastFactor,separation,lexicalHits,strongCompactSignal,confidenceGate,features,featureRows:kept,composite,secondaryFeatures,secondaryFeatureRows,secondaryFamilyPriors,anchorEvidenceSupport,anchorThemeMean,anchorTargetShare};
}

function scoreSignature(card,signature,{minBreadth=1,sparsePenalty=.65}={}){
  if(!card)return 0;const entries=Object.entries(signature||{});if(!entries.length)return 0;
  const features=runtimeThemeFeatures(card),matched=[];let num=0,den=0;
  for(const [feature,w] of entries){den+=w;const v=Number(features[feature]||0);if(v>0){const contribution=w*clamp01(v);num+=contribution;matched.push({feature,weight:w,value:v,contribution});}}
  const coverage=den?num/den:0;
  // Reward several independent semantic matches; one generic feature alone is not enough.
  const breadth=clamp01(matched.length/Math.min(7,entries.length));
  const breadthPenalty=matched.length < minBreadth ? sparsePenalty : 1,score=clamp01(coverage*(.72+.28*breadth)*breadthPenalty);
  return score;
}

export function scoreCardForThemeModel(card,model){return scoreSignature(card,model?.features||{});}

export function scoreCardForThemeSupportDetail(card,model){
  if(!model?.composite||!card)return {score:0,strongestFamily:null,familyScores:{},matchedFamilies:[]};
  const rows=model?.secondaryFeatureRows||[],features=runtimeThemeFeatures(card);if(!rows.length)return {score:0,strongestFamily:null,familyScores:{},matchedFamilies:[]};
  const maxWeight=Math.max(.0001,...rows.map(x=>Number(x.weight||0))),familyScores={};
  for(const row of rows){
    const family=row.family||featureFamily(row.feature),value=clamp01(features[row.feature]||0);if(value<=0)continue;
    const relative=.62+.38*clamp01(Number(row.weight||0)/maxWeight),specificity=.45+.55*clamp01(Number(row.specificity||0)),score=clamp01(value*relative*specificity);
    if(score>Number(familyScores[family]||0))familyScores[family]=score;
  }
  const ranked=Object.entries(familyScores).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),strongestFamily=ranked[0]?.[0]||null,strongest=Number(ranked[0]?.[1]||0),breadth=ranked.filter(([,score])=>score>=COMPOSITE_SECONDARY_SEMANTIC_FLOOR).length,score=clamp01(strongest*(breadth>=2?1:.94));
  return {score,strongestFamily,familyScores:Object.fromEntries(ranked),matchedFamilies:ranked.filter(([,x])=>x>=COMPOSITE_SECONDARY_SEMANTIC_FLOOR).map(([family])=>family)};
}
export function scoreCardForThemeSupport(card,model){return scoreCardForThemeSupportDetail(card,model).score;}

export function themeMembershipForProfile(profile,model){
  const combined=clamp01(profile?.themeScore||0),direct=clamp01(profile?.directSemantic||0),external=clamp01(profile?.externalTheme||0),semantic=clamp01(profile?.semanticTheme||0);
  if(!model?.composite){
    const corpusModel=model?.source==="theme_corpus"&&model?.trusted===true,membershipFloor=corpusModel?clamp01(model?.membershipThreshold??THEME_CORPUS_RUNTIME_MEMBERSHIP_FLOOR):.35,member=corpusModel?semantic>=membershipFloor:combined>=membershipFloor;
    return {member,anchor:false,secondary:false,family:null,families:[],basis:member?(corpusModel?"trusted_model":"combined"):"none",strength:corpusModel?Math.max(semantic,combined):combined,threshold:membershipFloor};
  }
  const facet=String(profile?.themeContract?.facet||"");
  const anchor=Boolean(model?.directFacet&&direct>=.35&&facet===String(model.directFacet));
  if(anchor)return {member:true,anchor:true,secondary:false,family:"__anchor",families:["__anchor"],basis:"anchor",strength:Math.max(combined,direct)};
  const detail=profile?.compositeSupport||scoreCardForThemeSupportDetail(profile?.card,model),secondary=clamp01(profile?.compositeSemantic??detail.score),family=detail?.strongestFamily||null,families=Array.isArray(detail?.matchedFamilies)?detail.matchedFamilies:family?[family]:[];
  // Composite support is family-local: a legitimate member may belong strongly to one
  // learned subpackage and need not express every other subpackage in the umbrella theme.
  // Moderate semantic support still requires independent external corroboration; external
  // evidence alone can never create semantic membership.
  const matchedFamilies=Array.isArray(detail?.matchedFamilies)?detail.matchedFamilies:[],facetMatches=matchedFamilies.filter(f=>String(f).startsWith("facet:")),behaviorMatch=matchedFamilies.some(f=>!String(f).startsWith("facet:")),identityOnly=Boolean(family&&String(family).startsWith("facet:")&&!behaviorMatch);
  // A broad identity facet by itself is not enough to turn every card of that type into
  // theme support. Identity-only matches need either a second independent learned facet
  // (a more specific semantic package) or external corroboration. Behavioural families
  // can qualify on strong structured evidence alone.
  const strongSemantic=secondary>=COMPOSITE_SECONDARY_STRONG_FLOOR&&(!identityOnly||facetMatches.length>=2);
  const corroborated=secondary>=COMPOSITE_SECONDARY_SEMANTIC_FLOOR&&external>=COMPOSITE_SECONDARY_EXTERNAL_FLOOR;
  const member=Boolean(family)&&(strongSemantic||corroborated);
  const basis=strongSemantic?"secondary_family":corroborated?"secondary_family+external":"none";
  return {member,anchor:false,secondary:member&&Boolean(family),family:member?family:null,families:member?families:[],basis,strength:member?Math.max(combined,secondary):combined};
}

export function themeModelSummary(model){return {version:model?.version||LAB3_THEME_UNDERSTANDING_VERSION,mode:model?.mode||"external_fallback",source:model?.source||"runtime_inference",confidence:Number(model?.confidence||0),evidenceCards:Number(model?.evidenceCards||0),directFacet:model?.directFacet||null,composite:Boolean(model?.composite),anchorEvidenceSupport:Number(model?.anchorEvidenceSupport||0),anchorTargetShare:model?.anchorTargetShare==null?null:Number(model.anchorTargetShare),secondaryFamilies:(model?.secondaryFeatureRows||[]).map(x=>x.family||featureFamily(x.feature)),secondaryFamilyPriors:model?.secondaryFamilyPriors||{},compositionTargets:model?.compositionTargets||null,trusted:Boolean(model?.trusted),membershipThreshold:model?.source==="theme_corpus"?Number(model?.membershipThreshold??THEME_CORPUS_RUNTIME_MEMBERSHIP_FLOOR):null,validation:model?.validation||null,topFeatures:(model?.featureRows||[]).slice(0,12).map(x=>({feature:x.feature,weight:Number(x.weight||0),support:Number(x.support||0),specificity:Number(x.specificity||0)}))};}

export function dominantThemeFeature(card,model){
  if(!model?.features)return null;const features=runtimeThemeFeatures(card);let best=null,bestScore=0;
  for(const [feature,w] of Object.entries(model.features)){const score=Number(w||0)*Number(features[feature]||0);if(score>bestScore){best=feature;bestScore=score;}}
  return best;
}
