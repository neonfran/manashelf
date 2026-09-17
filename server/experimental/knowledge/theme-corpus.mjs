import crypto from "node:crypto";
import {runtimeThemeFeatures,scoreCardForThemeModel,THEME_CORPUS_RUNTIME_MEMBERSHIP_FLOOR} from "../lab3/theme-understanding.mjs";
import {THEME_CORPUS_SCHEMA,THEME_CORPUS_VERSION,THEME_PROFILE_VERSION,DEFAULT_THEME_TRUST_GATE} from "./schema.mjs";
import {fingerprint} from "./io.mjs";

const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const extTheme=x=>clamp01(Number(x?.edhrecThemeScore??x?.themeAffinity??0));
const extBase=x=>clamp01(Number(x?.edhrecBaseScore??x?.commanderAffinity??0));
const rowWeight=x=>Math.max(.05,clamp01(Number(x?.sourceWeight??1)||1));
const keyOf=x=>String(x?.semanticCard?.oracleId||x?.oracleId||x?.name||"");
const seededBucket=(key,seed)=>{const h=crypto.createHash("sha256").update(`${seed}|${key}`).digest();return h.readUInt32BE(0)/0xffffffff;};
const quantile=(a,q)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.floor((s.length-1)*q)))];};
function labelRows(rows){
  const vals=rows.map(extTheme),q25=quantile(vals,.25),q75=quantile(vals,.75),positiveCut=Math.max(.06,q75),negativeCut=Math.min(.02,q25);
  return rows.map(row=>{const theme=extTheme(row),base=extBase(row),residual=theme-base*.42;const label=theme>=positiveCut&&residual>=.02?1:(theme<=negativeCut||theme<=.01?0:null);return {row,theme,base,residual,label,weight:rowWeight(row)};});
}
function featureModel(rows,{maxFeatures=40}={}){
  const pos=rows.filter(x=>x.label===1),neg=rows.filter(x=>x.label===0);if(!pos.length||!neg.length)return {features:{},featureRows:[]};
  const posWeight=pos.reduce((n,x)=>n+x.weight,0),negWeight=neg.reduce((n,x)=>n+x.weight,0),stats=new Map();
  const add=(group,item)=>{for(const [feature,value] of Object.entries(runtimeThemeFeatures(item.row.semanticCard)||{})){const s=stats.get(feature)||{p:0,pn:0,n:0,nn:0,pc:0,nc:0};s[group]+=Number(value||0)*item.weight;s[`${group}n`]+=item.weight;s[`${group}c`]++;stats.set(feature,s);}};
  for(const x of pos)add("p",x);for(const x of neg)add("n",x);
  const featureRows=[];
  for(const [feature,s] of stats){const pm=s.p/Math.max(.000001,posWeight),nm=s.n/Math.max(.000001,negWeight),lift=Math.max(0,pm-nm),support=s.pn/Math.max(.000001,posWeight),specificity=clamp01(lift/Math.max(.05,pm)),weight=clamp01(pm*Math.pow(specificity,.7)*Math.sqrt(Math.min(1,support*2.5)));if(s.pc<2||support<.06||lift<.03||weight<.055)continue;featureRows.push({feature,weight,positiveMean:pm,negativeMean:nm,lift,support,specificity});}
  featureRows.sort((a,b)=>b.weight-a.weight||b.lift-a.lift||a.feature.localeCompare(b.feature));return {features:Object.fromEntries(featureRows.slice(0,maxFeatures).map(x=>[x.feature,x.weight])),featureRows:featureRows.slice(0,maxFeatures)};
}
function auc(rows,scores){const pairs=rows.map((x,i)=>({label:x.label,score:scores[i]})).filter(x=>x.label===0||x.label===1),p=pairs.filter(x=>x.label===1).length,n=pairs.filter(x=>x.label===0).length;if(!p||!n)return null;const sorted=[...pairs].sort((a,b)=>a.score-b.score);let rank=1,sumPos=0;for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].score===sorted[i].score)j++;const avg=(rank+(rank+(j-i)-1))/2;for(let k=i;k<j;k++)if(sorted[k].label===1)sumPos+=avg;rank+=j-i;i=j;}return clamp01((sumPos-p*(p+1)/2)/(p*n));}
function precisionAtK(rows,scores,k){const ranked=rows.map((x,i)=>({label:x.label,score:scores[i]})).filter(x=>x.label===0||x.label===1).sort((a,b)=>b.score-a.score);const take=ranked.slice(0,Math.max(1,Math.min(k,ranked.length)));return take.length?take.filter(x=>x.label===1).length/take.length:null;}

export function evaluateThemeProfileAdmission({evidenceCards=0,sourceCommanders=0,sourceDecks=0,holdoutPositives=0,holdoutNegatives=0,auc=null,precisionAtK=null,featureCount=0,gate=DEFAULT_THEME_TRUST_GATE}={}){
  const g={...DEFAULT_THEME_TRUST_GATE,...gate};
  const checks={
    evidence_volume:{value:Number(evidenceCards||0),required:Number(g.minEvidenceCards||0),pass:Number(evidenceCards||0)>=Number(g.minEvidenceCards||0)},
    source_commanders:{value:Number(sourceCommanders||0),required:Number(g.minSourceCommanders||0),pass:Number(sourceCommanders||0)>=Number(g.minSourceCommanders||0)},
    source_decks:{value:Number(sourceDecks||0),required:Number(g.minSourceDecks||0),pass:Number(sourceDecks||0)>=Number(g.minSourceDecks||0)},
    holdout_positives:{value:Number(holdoutPositives||0),required:Number(g.minHoldoutPositives||0),pass:Number(holdoutPositives||0)>=Number(g.minHoldoutPositives||0)},
    holdout_negatives:{value:Number(holdoutNegatives||0),required:Number(g.minHoldoutNegatives||0),pass:Number(holdoutNegatives||0)>=Number(g.minHoldoutNegatives||0)},
    auc:{value:auc==null?null:Number(auc),required:Number(g.minAuc||0),pass:Number(auc??-1)>=Number(g.minAuc||0)},
    precision_at_k:{value:precisionAtK==null?null:Number(precisionAtK),required:Number(g.minPrecisionAtK||0),pass:Number(precisionAtK??-1)>=Number(g.minPrecisionAtK||0)},
    feature_count:{value:Number(featureCount||0),required:Number(g.minFeatures||0),pass:Number(featureCount||0)>=Number(g.minFeatures||0)}
  };
  const reasons=Object.entries(checks).filter(([,x])=>!x.pass).map(([name])=>name),trusted=reasons.length===0;
  return {decision:trusted?"TRUSTED":"REJECTED",trusted,reasons,checks,gate:g};
}

export function auditThemeProfile(model={}){
  const v=model.validation||{},source=model.sourceEvidence||{},admission=model.admission||evaluateThemeProfileAdmission({evidenceCards:model.evidenceCards,sourceCommanders:source.sourceCommanders,sourceDecks:source.totalThemeDecks,holdoutPositives:v.holdoutPositives,holdoutNegatives:v.holdoutNegatives,auc:v.auc,precisionAtK:v.precisionAtK,featureCount:(model.featureRows||[]).length,gate:v.gate});
  const featureRows=model.featureRows||[],featureQuality=featureRows.length?{count:featureRows.length,meanSpecificity:featureRows.reduce((n,x)=>n+Number(x.specificity||0),0)/featureRows.length,meanLift:featureRows.reduce((n,x)=>n+Number(x.lift||0),0)/featureRows.length,meanWeight:featureRows.reduce((n,x)=>n+Number(x.weight||0),0)/featureRows.length}:{count:0,meanSpecificity:0,meanLift:0,meanWeight:0};
  return {theme:model.theme||null,decision:admission.decision,trusted:Boolean(admission.trusted),reasons:[...(admission.reasons||[])],evidenceCards:Number(model.evidenceCards||0),sourceEvidence:{sourceCommanders:Number(source.sourceCommanders||0),totalThemeDecks:Number(source.totalThemeDecks||0),samplesAccepted:Number(source.samplesAccepted||0),samplesRejectedLowVolume:Number(source.samplesRejectedLowVolume||0),medianThemeDecks:Number(source.medianThemeDecks||0)},confidence:Number(model.confidence||0),validation:{trainRows:Number(v.trainRows||0),holdoutRows:Number(v.holdoutRows||0),holdoutPositives:Number(v.holdoutPositives||0),holdoutNegatives:Number(v.holdoutNegatives||0),auc:v.auc==null?null:Number(v.auc),precisionAtK:v.precisionAtK==null?null:Number(v.precisionAtK),k:Number(v.k||0)},featureQuality,checks:admission.checks};
}

export function auditThemeCorpus(corpus={}){
  const profiles=(corpus.themes||[]).map(auditThemeProfile),rejectionReasons={};for(const p of profiles)for(const r of p.reasons)rejectionReasons[r]=(rejectionReasons[r]||0)+1;
  const trusted=profiles.filter(x=>x.trusted),rejected=profiles.filter(x=>!x.trusted),avg=(rows,key)=>rows.length?rows.reduce((n,x)=>n+Number(key(x)||0),0)/rows.length:null;
  return {totalProfiles:profiles.length,trustedProfiles:trusted.length,rejectedProfiles:rejected.length,trustRate:profiles.length?trusted.length/profiles.length:null,rejectionReasons,metrics:{trustedAvgAuc:avg(trusted,x=>x.validation.auc),trustedAvgPrecisionAtK:avg(trusted,x=>x.validation.precisionAtK),trustedAvgEvidenceCards:avg(trusted,x=>x.evidenceCards),trustedAvgSourceCommanders:avg(trusted,x=>x.sourceEvidence.sourceCommanders),trustedAvgSourceDecks:avg(trusted,x=>x.sourceEvidence.totalThemeDecks)},profiles};
}

export function trainThemeProfile({theme,evidence=[],sourceEvidence={},seed="manashelf-theme-corpus-v1",trustGate=DEFAULT_THEME_TRUST_GATE,maxFeatures=40}={}){
  const usable=(evidence||[]).filter(x=>x?.semanticCard),labeled=labelRows(usable),train=[],holdout=[];for(const row of labeled){if(row.label===null)continue;(seededBucket(keyOf(row.row),`${seed}|${theme}`)<.8?train:holdout).push(row);}
  const learned=featureModel(train,{maxFeatures}),model={version:THEME_PROFILE_VERSION,theme,mode:"semantic_inferred",source:"theme_corpus",sourceEvidence:{...sourceEvidence},confidence:0,evidenceCards:train.filter(x=>x.label===1).length,features:learned.features,featureRows:learned.featureRows,directFacet:null,membershipThreshold:THEME_CORPUS_RUNTIME_MEMBERSHIP_FLOOR};
  const scores=holdout.map(x=>scoreCardForThemeModel(x.row.semanticCard,model)),holdPos=holdout.filter(x=>x.label===1).length,holdNeg=holdout.filter(x=>x.label===0).length,AUC=auc(holdout,scores),k=Math.max(1,Math.min(20,holdPos||5)),precision=precisionAtK(holdout,scores,k),gate={...DEFAULT_THEME_TRUST_GATE,...trustGate},evidenceCards=labeled.filter(x=>x.label===1).length;
  const admission=evaluateThemeProfileAdmission({evidenceCards,sourceCommanders:sourceEvidence?.sourceCommanders,sourceDecks:sourceEvidence?.totalThemeDecks,holdoutPositives:holdPos,holdoutNegatives:holdNeg,auc:AUC,precisionAtK:precision,featureCount:learned.featureRows.length,gate});
  const confidence=clamp01((Number(AUC||0)*.42+Number(precision||0)*.33+Math.min(1,evidenceCards/40)*.15+Math.min(1,Number(sourceEvidence?.sourceCommanders||0)/6)*.05+Math.min(1,Number(sourceEvidence?.totalThemeDecks||0)/100)*.05));
  Object.assign(model,{confidence,evidenceCards,validation:{trainRows:train.length,holdoutRows:holdout.length,holdoutPositives:holdPos,holdoutNegatives:holdNeg,auc:AUC,precisionAtK:precision,k,gate,trusted:admission.trusted},admission,trusted:admission.trusted});
  return model;
}
export function createThemeCorpus({themeEvidence={},themeStats={},runtimeSha256=null,seed="manashelf-theme-corpus-v1",provenance={}}={}){
  const themes=[];for(const theme of Object.keys(themeEvidence||{}).sort()){const model=trainThemeProfile({theme,evidence:themeEvidence[theme],sourceEvidence:themeStats?.[theme]||{},seed});themes.push(model);}const corpus={schema:THEME_CORPUS_SCHEMA,schemaVersion:THEME_CORPUS_VERSION,createdAt:new Date().toISOString(),seed,runtimeSha256,provenance,themes,summary:{themes:themes.length,trustedThemes:themes.filter(x=>x.trusted).length,untrustedThemes:themes.filter(x=>!x.trusted).length},fingerprint:fingerprint(themes.map(x=>({theme:x.theme,trusted:x.trusted,sourceEvidence:x.sourceEvidence,features:x.features,validation:x.validation})))};corpus.audit=auditThemeCorpus(corpus);return corpus;
}
export function emptyThemeCorpus({runtimeSha256=null,seed="manashelf-theme-corpus-v1",provenance={}}={}){return {schema:THEME_CORPUS_SCHEMA,schemaVersion:THEME_CORPUS_VERSION,createdAt:new Date().toISOString(),seed,runtimeSha256,provenance,themes:[],summary:{themes:0,trustedThemes:0,untrustedThemes:0},fingerprint:fingerprint([])};}
export function trustedThemeModel(corpus,theme){const key=String(theme||"").toLocaleLowerCase("en-US");const row=(corpus?.themes||[]).find(x=>String(x.theme||"").toLocaleLowerCase("en-US")===key);return row?.trusted?row:null;}
export function sweepThemeCorpus(corpus,runtimeCards,{minScore=.18,maxThemesPerCard=8}={}){const trusted=(corpus?.themes||[]).filter(x=>x.trusted),rows=[];for(const card of runtimeCards||[]){const labels=trusted.map(model=>({theme:model.theme,score:scoreCardForThemeModel(card,model)})).filter(x=>x.score>=minScore).sort((a,b)=>b.score-a.score).slice(0,maxThemesPerCard);if(labels.length)rows.push({oracleId:card.oracleId,name:card.name,themes:labels});}return rows;}
