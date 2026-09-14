import crypto from "node:crypto";
import {fingerprint} from "./io.mjs";

export const THEME_EVIDENCE_PLAN_SCHEMA="manashelf-theme-evidence-plan";
export const THEME_EVIDENCE_PLAN_VERSION=1;
const COLORS=["W","U","B","R","G"];
const hashRank=(seed,key)=>crypto.createHash("sha256").update(`${seed}|${key}`).digest("hex");
const typeLine=card=>(card?.faces||[]).map(f=>f?.typeLine||"").join(" // ");
const isLegendaryCreature=card=>/\blegendary\b/i.test(typeLine(card))&&/\bcreature\b/i.test(typeLine(card));
export const colorIdentityKey=card=>{const ci=[...new Set(card?.colorIdentity||[])].filter(c=>COLORS.includes(c)).sort((a,b)=>COLORS.indexOf(a)-COLORS.indexOf(b));return ci.length?ci.join(""):"C";};
export function isTrainingCommanderCandidate(card){return Boolean(card?.oracleId&&card?.name&&card?.legalities?.commander==="legal"&&isLegendaryCreature(card));}

export function createThemeEvidencePlan({runtimeCards=[],runtimeSha256,seed="manashelf-theme-evidence-plan-v1",count=300,excludeOracleIds=[]}={}){
  if(!runtimeSha256)throw new Error("Theme Evidence plan requires runtimeSha256");
  const excluded=new Set([...excludeOracleIds].map(String)),buckets=new Map();
  for(const card of runtimeCards||[]){if(!isTrainingCommanderCandidate(card)||excluded.has(String(card.oracleId)))continue;const k=colorIdentityKey(card),arr=buckets.get(k)||[];arr.push(card);buckets.set(k,arr);}
  for(const arr of buckets.values())arr.sort((a,b)=>hashRank(seed,a.oracleId).localeCompare(hashRank(seed,b.oracleId))||String(a.oracleId).localeCompare(String(b.oracleId)));
  const bucketKeys=[...buckets.keys()].sort((a,b)=>a.length-b.length||a.localeCompare(b)),selected=[];let round=0;
  while(selected.length<count){let added=0;for(const k of bucketKeys){const card=buckets.get(k)?.[round];if(!card)continue;selected.push(card);added++;if(selected.length>=count)break;}if(!added)break;round++;}
  const commanders=selected.map((c,i)=>({index:i+1,name:c.name,oracleId:String(c.oracleId),colorIdentity:[...(c.colorIdentity||[])],colorKey:colorIdentityKey(c),rank:hashRank(seed,c.oracleId)}));
  const colorDistribution={};for(const c of commanders)colorDistribution[c.colorKey]=(colorDistribution[c.colorKey]||0)+1;
  const core={schema:THEME_EVIDENCE_PLAN_SCHEMA,schemaVersion:THEME_EVIDENCE_PLAN_VERSION,seed,runtimeSha256,requested:Number(count),excludedOracleIds:[...excluded].sort(),commanders,summary:{selected:commanders.length,availableCandidates:[...buckets.values()].reduce((n,a)=>n+a.length,0),excluded:excluded.size,colorDistribution}};
  return {...core,fingerprint:fingerprint(core)};
}
