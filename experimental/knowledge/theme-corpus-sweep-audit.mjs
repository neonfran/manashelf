import {scoreCardForThemeModel} from "../lab3/theme-understanding.mjs";
import {fingerprint} from "./io.mjs";
import {assertThemeCorpus} from "./schema.mjs";

export const THEME_CORPUS_SWEEP_AUDIT_SCHEMA="manashelf-theme-corpus-sweep-audit";
export const THEME_CORPUS_SWEEP_AUDIT_VERSION=1;
export const DEFAULT_SWEEP_THRESHOLDS=Object.freeze({
  minAssignedCardsPerTrustedTheme:8,
  reviewCoverageRate:.35,
  failCoverageRate:.65,
  reviewPairJaccard:.85,
  failPairJaccard:.97,
  minPairIntersection:40,
  reviewAvgLabelsPerCard:3.5,
  failAvgLabelsPerCard:5,
  reviewP95LabelsPerCard:6,
  failP95LabelsPerCard:8
});

const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const round=(x,n=6)=>Number(Number(x||0).toFixed(n));
const q=(values,p)=>{if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*p)))];};
const colorKey=card=>{const ci=[...(card?.colorIdentity||[])].sort();return ci.length?ci.join(""):"C";};
const addIssue=(rows,code,message,data={})=>rows.push({code,message,...data});

function trustedAdmissionConsistent(model){
  if(!model?.trusted)return true;
  return model?.admission?.trusted===true&&model?.admission?.decision==="TRUSTED"&&Array.isArray(model?.admission?.reasons)&&model.admission.reasons.length===0;
}

export function auditThemeCorpusSweep({corpus,runtimeCards=[],runtimeSha256=null,minScore=.18,maxThemesPerCard=8,thresholds={},requireIndependentTraining=true}={}){
  assertThemeCorpus(corpus);
  const gate={...DEFAULT_SWEEP_THRESHOLDS,...thresholds},cards=[...(runtimeCards||[])],trusted=(corpus.themes||[]).filter(x=>x?.trusted),blockers=[],reviews=[];
  const evidenceSource=corpus?.provenance?.evidenceSource||corpus?.provenance?.source||{};
  if(!cards.length)addIssue(blockers,"runtime_empty","Semantic Runtime contains no cards.");
  if(!trusted.length)addIssue(blockers,"no_trusted_profiles","Theme Corpus contains no trusted profiles.");
  if(runtimeSha256&&corpus.runtimeSha256&&runtimeSha256!==corpus.runtimeSha256)addIssue(blockers,"runtime_sha_mismatch","Theme Corpus was trained against a different Semantic Runtime.",{expected:runtimeSha256,actual:corpus.runtimeSha256});
  if(requireIndependentTraining&&evidenceSource?.independentFromValidation!==true)addIssue(blockers,"training_independence_unproven","Theme Corpus provenance does not prove independence from Stress/unseen validation evidence.");
  const inconsistent=trusted.filter(x=>!trustedAdmissionConsistent(x)).map(x=>x.theme);
  if(inconsistent.length)addIssue(blockers,"trusted_admission_inconsistent","Trusted profiles must carry a successful explicit admission decision.",{themes:inconsistent});

  const themeStats=new Map(trusted.map(m=>[m.theme,{theme:m.theme,count:0,sumScore:0,minScore:1,maxScore:0,scores:[],colors:new Map()}]));
  const pairIntersections=new Map(),sweep=[],labelsPerCard=[];
  for(const card of cards){
    const labels=[];
    for(const model of trusted){
      const score=scoreCardForThemeModel(card,model);
      if(score<minScore)continue;
      labels.push({theme:model.theme,score});
    }
    labels.sort((a,b)=>b.score-a.score||String(a.theme).localeCompare(String(b.theme)));
    const kept=labels.slice(0,Math.max(1,Number(maxThemesPerCard)||1));
    labelsPerCard.push(kept.length);
    if(!kept.length)continue;
    const compact=kept.map(x=>({theme:x.theme,score:round(x.score)}));
    sweep.push({oracleId:card.oracleId||null,name:card.name||null,themes:compact});
    const ck=colorKey(card);
    for(const x of kept){
      const s=themeStats.get(x.theme);if(!s)continue;s.count++;s.sumScore+=x.score;s.minScore=Math.min(s.minScore,x.score);s.maxScore=Math.max(s.maxScore,x.score);s.scores.push(x.score);s.colors.set(ck,(s.colors.get(ck)||0)+1);
    }
    for(let i=0;i<kept.length;i++)for(let j=i+1;j<kept.length;j++){
      const a=String(kept[i].theme),b=String(kept[j].theme),key=a<b?`${a}\u0000${b}`:`${b}\u0000${a}`;pairIntersections.set(key,(pairIntersections.get(key)||0)+1);
    }
  }
  const total=Math.max(1,cards.length),perTheme=[];
  for(const s of themeStats.values()){
    const colors=[...s.colors.entries()].map(([key,count])=>({colorIdentity:key,count,share:s.count?count/s.count:0})).sort((a,b)=>b.count-a.count||a.colorIdentity.localeCompare(b.colorIdentity));
    const row={theme:s.theme,assignedCards:s.count,coverageRate:s.count/total,score:{min:s.count?round(s.minScore):null,mean:s.count?round(s.sumScore/s.count):null,p50:s.count?round(q(s.scores,.5)):null,p95:s.count?round(q(s.scores,.95)):null,max:s.count?round(s.maxScore):null},topColorIdentities:colors.slice(0,5).map(x=>({...x,share:round(x.share)}))};
    perTheme.push(row);
    if(s.count<gate.minAssignedCardsPerTrustedTheme)addIssue(reviews,"trusted_profile_sparse","Trusted profile assigns very few cards in the full Runtime sweep.",{theme:s.theme,assignedCards:s.count,minimum:gate.minAssignedCardsPerTrustedTheme});
    if(row.coverageRate>=gate.failCoverageRate)addIssue(blockers,"theme_extremely_broad","Trusted profile covers an implausibly large fraction of the Runtime.",{theme:s.theme,coverageRate:round(row.coverageRate),threshold:gate.failCoverageRate});
    else if(row.coverageRate>=gate.reviewCoverageRate)addIssue(reviews,"theme_broad","Trusted profile has broad Runtime coverage and requires review.",{theme:s.theme,coverageRate:round(row.coverageRate),threshold:gate.reviewCoverageRate});
  }
  perTheme.sort((a,b)=>b.assignedCards-a.assignedCards||a.theme.localeCompare(b.theme));

  const counts=new Map(perTheme.map(x=>[x.theme,x.assignedCards])),overlaps=[];
  for(const [key,intersection] of pairIntersections){
    const [a,b]=key.split("\u0000"),ca=counts.get(a)||0,cb=counts.get(b)||0,union=ca+cb-intersection,jaccard=union?intersection/union:0;
    if(intersection<gate.minPairIntersection)continue;
    overlaps.push({themeA:a,themeB:b,intersection,union,jaccard});
    if(jaccard>=gate.failPairJaccard)addIssue(blockers,"profiles_collapsed","Two trusted profiles classify nearly the same card set.",{themeA:a,themeB:b,intersection,jaccard:round(jaccard),threshold:gate.failPairJaccard});
    else if(jaccard>=gate.reviewPairJaccard)addIssue(reviews,"profiles_high_overlap","Two trusted profiles have unusually high card-set overlap.",{themeA:a,themeB:b,intersection,jaccard:round(jaccard),threshold:gate.reviewPairJaccard});
  }
  overlaps.sort((a,b)=>b.jaccard-a.jaccard||b.intersection-a.intersection||a.themeA.localeCompare(b.themeA));
  const assignedCards=sweep.length,labelAssignments=labelsPerCard.reduce((n,x)=>n+x,0),avgLabels=cards.length?labelAssignments/cards.length:0,p95Labels=q(labelsPerCard,.95),maxLabels=labelsPerCard.length?Math.max(...labelsPerCard):0;
  if(avgLabels>=gate.failAvgLabelsPerCard)addIssue(blockers,"global_label_saturation","Theme Corpus assigns too many labels per Runtime card on average.",{avgLabelsPerCard:round(avgLabels),threshold:gate.failAvgLabelsPerCard});
  else if(avgLabels>=gate.reviewAvgLabelsPerCard)addIssue(reviews,"global_label_density_high","Theme Corpus label density is high and requires review.",{avgLabelsPerCard:round(avgLabels),threshold:gate.reviewAvgLabelsPerCard});
  if(p95Labels>=gate.failP95LabelsPerCard)addIssue(blockers,"global_p95_saturation","The 95th percentile of labels per card reaches the saturation ceiling.",{p95LabelsPerCard:p95Labels,threshold:gate.failP95LabelsPerCard});
  else if(p95Labels>=gate.reviewP95LabelsPerCard)addIssue(reviews,"global_p95_density_high","The 95th percentile of labels per card is high.",{p95LabelsPerCard:p95Labels,threshold:gate.reviewP95LabelsPerCard});

  const reduced=sweep.map(x=>({oracleId:x.oracleId,themes:x.themes})),sweepFingerprint=fingerprint(reduced),decision=blockers.length?"FAIL":reviews.length?"REVIEW":"PASS";
  const report={schema:THEME_CORPUS_SWEEP_AUDIT_SCHEMA,schemaVersion:THEME_CORPUS_SWEEP_AUDIT_VERSION,createdAt:new Date().toISOString(),decision,corpusFingerprint:corpus.fingerprint||null,runtimeSha256:runtimeSha256||corpus.runtimeSha256||null,parameters:{minScore,maxThemesPerCard,thresholds:gate,requireIndependentTraining},summary:{runtimeCards:cards.length,trustedProfiles:trusted.length,assignedCards,unassignedCards:Math.max(0,cards.length-assignedCards),assignedCardRate:cards.length?assignedCards/cards.length:0,labelAssignments,avgLabelsPerCard:round(avgLabels),p50LabelsPerCard:q(labelsPerCard,.5),p95LabelsPerCard:p95Labels,maxLabelsPerCard:maxLabels,blockers:blockers.length,reviewItems:reviews.length},blockers,reviews,perTheme,topOverlaps:overlaps.slice(0,50),sweepFingerprint};
  report.fingerprint=fingerprint({...report,createdAt:null,fingerprint:undefined});
  return {report,sweep};
}
