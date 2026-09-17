import {fingerprint} from "./io.mjs";
import {THEME_EVIDENCE_PLAN_SCHEMA,THEME_EVIDENCE_PLAN_VERSION} from "./theme-evidence-plan.mjs";

export const EDHREC_TRAINING_SNAPSHOT_SCHEMA="manashelf-edhrec-training-snapshot";
export const EDHREC_TRAINING_SNAPSHOT_VERSION=1;
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,Number(ms)||0)));
export const edhrecSlug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export function parseEdhrecTags(payload){
  const raw=Array.isArray(payload?.panels?.taglinks)?payload.panels.taglinks:[];
  return raw.filter(x=>x?.value).map(x=>({name:String(x.value),slug:String(x.slug||edhrecSlug(x.value)),count:Number(x.count||0)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
export function parseEdhrecLists(payload){
  const root=payload?.container?.json_dict||payload?.json_dict||payload,lists=root?.cardlists||[];
  return lists.map((l,i)=>({id:l.tag||`list-${i}`,label:l.header||l.label||String(l.tag||`List ${i+1}`),cards:(l.cardviews||l.cards||[]).filter(c=>c?.name).map(c=>{const numDecks=Number(c.num_decks??c.numDecks??0)||0,potentialDecks=Number(c.potential_decks??c.potentialDecks??0)||0,raw=Number(c.inclusion??0)||0,inclusion=potentialDecks>0&&numDecks>0?numDecks/potentialDecks:(raw>1?raw/100:raw);return {name:c.name,synergy:Number(c.synergy||0),inclusion:Math.max(0,Math.min(1,inclusion)),numDecks,potentialDecks};})}));
}
function assertPlan(plan){if(plan?.schema!==THEME_EVIDENCE_PLAN_SCHEMA||Number(plan?.schemaVersion)!==THEME_EVIDENCE_PLAN_VERSION)throw new Error("Invalid Theme Evidence training plan");if(!Array.isArray(plan.commanders)||!plan.commanders.length)throw new Error("Theme Evidence training plan has no commanders");return plan;}
async function getJson(url,{fetchImpl,retries=2,retryDelayMs=500,timeoutMs=12000,onAttempt=null}={}){
  let last=null;
  const limit=Math.max(50,Number(timeoutMs)||12000);
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      if(onAttempt)await onAttempt({url,attempt:attempt+1,maxAttempts:retries+1,timeoutMs:limit});
      const controller=typeof AbortController!=="undefined"?new AbortController():null;
      let timer=null;
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{try{controller?.abort();}catch{}const e=new Error(`Timeout after ${limit}ms for ${url}`);e.name="TimeoutError";reject(e);},limit);});
      const request=(async()=>{const r=await fetchImpl(url,controller?{signal:controller.signal}:undefined);if(r?.ok)return await r.json();const e=new Error(`HTTP ${r?.status??"unknown"} for ${url}`);if(Number(r?.status||0)===404)e.nonRetryable=true;throw e;})();
      try{return await Promise.race([request,timeout]);}finally{if(timer)clearTimeout(timer);}
    }
    catch(e){last=e;if(e?.nonRetryable)break;}
    if(attempt<retries)await sleep(retryDelayMs*(attempt+1));
  }
  throw last||new Error(`EDHREC fetch failed: ${url}`);
}
const failureKey=x=>`${x?.stage||"unknown"}|${x?.commanderOracleId||""}|${x?.themeSlug||""}`;

export async function fetchEdhrecTrainingSnapshot({plan,fetchImpl=globalThis.fetch,themesPerCommander=6,minThemeDecks=5,requestDelayMs=250,retries=2,requestTimeoutMs=12000,resume=null,onCheckpoint=null,onProgress=null}={}){
  assertPlan(plan);if(typeof fetchImpl!=="function")throw new Error("fetchEdhrecTrainingSnapshot requires fetchImpl");
  const requestedThemes=Math.max(1,Number(themesPerCommander)||1),minimumDecks=Math.max(1,Number(minThemeDecks)||1),prior=resume&&resume.schema===EDHREC_TRAINING_SNAPSHOT_SCHEMA?resume:null;
  if(prior){
    if(prior.planFingerprint!==plan.fingerprint)throw new Error("Cannot resume EDHREC snapshot with a different training plan fingerprint");
    if(Number(prior?.source?.themesPerCommander??requestedThemes)!==requestedThemes||Number(prior?.source?.minThemeDecks??minimumDecks)!==minimumDecks)throw new Error("Cannot resume EDHREC snapshot with different collection quality settings");
  }
  const sampleMap=new Map((prior?.samples||[]).filter(x=>x?.sourceId).map(x=>[String(x.sourceId),x])),failureMap=new Map((prior?.failures||[]).map(x=>[failureKey(x),x])),completed=new Set(prior?.completedCommanderOracleIds||[]),source={kind:"edhrec-independent",independentFromValidation:true,provider:"EDHREC",planFingerprint:plan.fingerprint,themesPerCommander:requestedThemes,minThemeDecks:minimumDecks};
  for(let commanderIndex=0;commanderIndex<plan.commanders.length;commanderIndex++){
    const commander=plan.commanders[commanderIndex],cid=String(commander.oracleId);if(completed.has(cid))continue;
    const progress=async event=>{if(onProgress)await onProgress({commanderIndex:commanderIndex+1,commanderTotal:plan.commanders.length,commander:commander.name,commanderOracleId:cid,...event});};
    const baseUrl=`https://json.edhrec.com/pages/commanders/${edhrecSlug(commander.name)}.json`;let basePayload;
    await progress({stage:"commander_start",message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · consultando página base…`});
    try{basePayload=await getJson(baseUrl,{fetchImpl,retries,timeoutMs:requestTimeoutMs,onAttempt:async a=>progress({stage:"request_attempt",kind:"base",...a,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · base intento ${a.attempt}/${a.maxAttempts} (timeout ${Math.round(a.timeoutMs/1000)}s)`})});failureMap.delete(`base|${cid}|`);}
    catch(e){const f={commander:commander.name,commanderOracleId:cid,stage:"base",retryable:!e?.nonRetryable,error:String(e.message||e)};failureMap.set(failureKey(f),f);if(e?.nonRetryable)completed.add(cid);await progress({stage:"base_failure",retryable:f.retryable,error:f.error,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · base FALLÓ · ${f.retryable?"reintentable":"permanente"} · ${f.error}`});if(onCheckpoint)await onCheckpoint(snapshot());continue;}
    const baseLists=parseEdhrecLists(basePayload),tags=parseEdhrecTags(basePayload).filter(x=>Number(x.count||0)>=minimumDecks).slice(0,requestedThemes);let retryableThemeFailure=false;
    await progress({stage:"base_ok",themeCount:tags.length,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · base OK · ${tags.length} themes elegibles`});
    for(let tagIndex=0;tagIndex<tags.length;tagIndex++){
      const tag=tags[tagIndex];
      const slug=tag.slug||edhrecSlug(tag.name),sourceId=`${cid}|${slug}`,themeUrl=`https://json.edhrec.com/pages/commanders/${edhrecSlug(commander.name)}/${encodeURIComponent(slug)}.json`;
      await progress({stage:"theme_start",themeIndex:tagIndex+1,themeTotal:tags.length,theme:tag.name,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · theme ${tagIndex+1}/${tags.length}: ${tag.name}`});
      try{await sleep(requestDelayMs);const themePayload=await getJson(themeUrl,{fetchImpl,retries,timeoutMs:requestTimeoutMs,onAttempt:async a=>progress({stage:"request_attempt",kind:"theme",theme:tag.name,themeIndex:tagIndex+1,themeTotal:tags.length,...a,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · ${tag.name} · intento ${a.attempt}/${a.maxAttempts} (timeout ${Math.round(a.timeoutMs/1000)}s)`})});sampleMap.set(sourceId,{sourceId,commander:commander.name,commanderOracleId:cid,colorIdentity:commander.colorIdentity||[],theme:tag.name,themeSlug:slug,themeCount:Number(tag.count||0),baseLists,themeLists:parseEdhrecLists(themePayload)});failureMap.delete(`theme|${cid}|${slug}`);}
      catch(e){const f={commander:commander.name,commanderOracleId:cid,theme:tag.name,themeSlug:slug,stage:"theme",retryable:!e?.nonRetryable,error:String(e.message||e)};failureMap.set(failureKey(f),f);if(!e?.nonRetryable)retryableThemeFailure=true;await progress({stage:"theme_failure",theme:tag.name,retryable:f.retryable,error:f.error,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · ${tag.name} FALLÓ · ${f.retryable?"reintentable":"permanente"} · ${f.error}`});}
    }
    if(!retryableThemeFailure)completed.add(cid);if(onCheckpoint)await onCheckpoint(snapshot());
    const snap=snapshot();await progress({stage:"commander_done",completed:snap.summary.commandersCompleted,samples:snap.summary.samples,retryableFailures:snap.summary.retryableFailures,message:`[${commanderIndex+1}/${plan.commanders.length}] ${commander.name} · checkpoint · completos ${snap.summary.commandersCompleted}/${plan.commanders.length} · samples ${snap.summary.samples} · retryables ${snap.summary.retryableFailures}`});
  }
  return snapshot();
  function snapshot(){const samples=[...sampleMap.values()].sort((a,b)=>String(a.sourceId).localeCompare(String(b.sourceId))),failures=[...failureMap.values()].sort((a,b)=>failureKey(a).localeCompare(failureKey(b))),core={schema:EDHREC_TRAINING_SNAPSHOT_SCHEMA,schemaVersion:EDHREC_TRAINING_SNAPSHOT_VERSION,usage:"training",source,planFingerprint:plan.fingerprint,completedCommanderOracleIds:[...completed].sort(),samples,failures,summary:{commandersRequested:plan.commanders.length,commandersCompleted:completed.size,commandersWithSamples:new Set(samples.map(x=>x.commanderOracleId)).size,samples:samples.length,failures:failures.length,retryableFailures:failures.filter(x=>x.retryable).length,themes:[...new Set(samples.map(x=>x.theme))].length,minThemeDecks:minimumDecks}};return {...core,fingerprint:fingerprint(core)};}
}
