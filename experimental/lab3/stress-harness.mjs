import { cardIdentityKey } from "../../lib/card-identity.mjs";

export const LAB3_STRESS_SCHEMA="manashelf-lab3-stress-corpus-v3";
export const LAB3_STRESS_VERSION=3;

const COLORS=["W","U","B","R","G"];
const round=(n,d=3)=>Number((Number(n)||0).toFixed(d));
const uniq=a=>[...new Set((a||[]).filter(Boolean))];

export function hashSeed(input="manashelf-lab3"){
  let h=2166136261>>>0;
  for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
  return h>>>0;
}
export function seededRandom(seed){
  let x=(Number(seed)>>>0)||0x9e3779b9;
  return ()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}
export function shuffleSeeded(list,seed){const out=[...(list||[])],rnd=seededRandom(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

export function colorKey(card){const ci=uniq(card?.colorIdentity||[]).filter(c=>COLORS.includes(c)).sort((a,b)=>COLORS.indexOf(a)-COLORS.indexOf(b));return ci.length?ci.join(""):"C";}
export function isLegendaryCreature(card){return (card?.faces||[]).some(f=>/legendary/i.test(String(f.typeLine||""))&&/creature/i.test(String(f.typeLine||"")));}
export function isStressCommander(card){return Boolean(card?.name)&&card?.status!=="coverage_gap"&&card?.legalities?.commander==="legal"&&isLegendaryCreature(card);}
export function identitySubset(cardIdentity,allowed){const set=new Set(allowed||[]);return (cardIdentity||[]).every(c=>set.has(c));}

function targetCommanderMix(total){
  const weights={1:.20,2:.34,3:.26,4:.10,5:.08,0:.02},raw={};let used=0;
  for(const [k,w] of Object.entries(weights)){raw[k]=Math.floor(total*w);used+=raw[k];}
  const order=[2,3,1,4,5,0];let i=0;while(used<total){raw[order[i++%order.length]]++;used++;}return raw;
}

export function selectStressCommanders({runtimeCards=[],poolCards=null,commanderCount=50,seed=1,minPool=115}={}){
  const unique=[...new Map((runtimeCards||[]).filter(isStressCommander).map(c=>[String(c.oracleId||cardIdentityKey(c.name)),c])).values()];
  const eligiblePool=[...new Map(((poolCards||runtimeCards)||[]).filter(c=>c?.name&&c?.status!=="coverage_gap"&&c?.legalities?.commander==="legal").map(c=>[String(c.oracleId||cardIdentityKey(c.name)),c])).values()];
  const buckets=new Map();for(const c of unique){const n=(c.colorIdentity||[]).length;if(!buckets.has(n))buckets.set(n,[]);buckets.get(n).push(c);}
  const mix=targetCommanderMix(commanderCount),picked=[],usedKeys=new Set(),usedColorKeys=new Map(),poolCountCache=new Map();
  const enoughPool=c=>{const allowed=c.colorIdentity||[],key=colorKey(c);if(!poolCountCache.has(key))poolCountCache.set(key,eligiblePool.reduce((sum,x)=>sum+(identitySubset(x.colorIdentity||[],allowed)?1:0),0));return Number(poolCountCache.get(key)||0)>=minPool;};
  for(const n of [0,1,2,3,4,5]){
    const shuffled=shuffleSeeded(buckets.get(n)||[],hashSeed(`${seed}:colors:${n}`));
    const want=Number(mix[n]||0);let added=0;
    // First pass favors distinct exact color identities so the corpus does not collapse into popular pairs.
    for(const c of shuffled){if(added>=want)break;const k=cardIdentityKey(c.name),ck=colorKey(c);if(usedKeys.has(k)||!enoughPool(c))continue;const same=Number(usedColorKeys.get(ck)||0);if(same>=Math.max(1,Math.ceil(want/Math.max(1,new Set(shuffled.map(colorKey)).size))))continue;picked.push(c);usedKeys.add(k);usedColorKeys.set(ck,same+1);added++;}
    for(const c of shuffled){if(added>=want)break;const k=cardIdentityKey(c.name);if(usedKeys.has(k)||!enoughPool(c))continue;picked.push(c);usedKeys.add(k);usedColorKeys.set(colorKey(c),Number(usedColorKeys.get(colorKey(c))||0)+1);added++;}
  }
  if(picked.length<commanderCount){for(const c of shuffleSeeded(unique,hashSeed(`${seed}:fill`))){if(picked.length>=commanderCount)break;const k=cardIdentityKey(c.name);if(usedKeys.has(k)||!enoughPool(c))continue;picked.push(c);usedKeys.add(k);}}
  return picked.slice(0,commanderCount);
}

export function selectStressThemes(themes,{perCommander=4,seed=1,themeUsage=new Map(),modeUsage=new Map()}={}){
  const all=(themes||[]).filter(t=>t?.name);
  if(!all.length)return[];
  const shuffled=shuffleSeeded(all,hashSeed(seed)),selected=[];
  const score=t=>{
    const key=String(t.name).toLowerCase(),mode=String(t.themeContractMode||t.mode||"semantic"),usage=Number(themeUsage.get(key)||0),musage=Number(modeUsage.get(mode)||0),pop=Math.log10(Math.max(1,Number(t.count||0)+1))/10;
    return -usage*4-musage*.25+pop+(mode==="external_fallback"?.08:0);
  };
  while(selected.length<Math.min(perCommander,all.length)){
    const remaining=shuffled.filter(t=>!selected.includes(t));remaining.sort((a,b)=>score(b)-score(a));const best=remaining[0];if(!best)break;selected.push(best);const key=String(best.name).toLowerCase(),mode=String(best.themeContractMode||best.mode||"semantic");themeUsage.set(key,Number(themeUsage.get(key)||0)+1);modeUsage.set(mode,Number(modeUsage.get(mode)||0)+1);
  }
  return selected;
}

export function playableAsLandFromHand(card){
  if(!card)return false;
  if(card?.views?.mana)return Boolean(card.views.mana.isPlayableLand);
  return (card.faces||[]).some(f=>["default","alternative_entry"].includes(f.access?.kind||"default")&&(f.cardTypes||[]).includes("Land"));
}

export function modalPotential(card){
  const layout=String(card?.layout||"normal").toLowerCase(),groups=card?.optionGroups||[],relations=card?.relations||[];
  const repeatable=groups.some(g=>g.policy==="repeatable"),exclusive=groups.some(g=>g.policy==="exclusive");
  const hasModalChoice=layout==="modal_dfc"||["split","adventure"].includes(layout)||groups.length>0;
  const mutuallyExclusive=layout==="modal_dfc"||exclusive||(["split","adventure"].includes(layout)&&!repeatable);
  const sequential=["transform","meld"].includes(layout)||relations.some(r=>["state_transition","sequence"].includes(r.type));
  return {layout,hasModalChoice,repeatable,mutuallyExclusive,sequential};
}
function selectedSemantic(build,semanticByName){const out=[];for(const row of build?.deck||[]){if(row.syntheticBasic)continue;const sem=semanticByName?.get?.(cardIdentityKey(row.name))||semanticByName?.get?.(row.name)||null;if(sem)out.push({row,sem});}return out;}

export function analyzeStressBuild({build,semanticByName,settings,themeMode}={}){
  const issues=[],push=(family,severity,message,evidence={})=>issues.push({family,severity,message,evidence});
  if(!build?.complete||Number(build?.size)!==100)push("deck_size","critical","Build incompleto o tamaño distinto de 100.",{size:build?.size,complete:build?.complete});
  if(Number(build?.validation?.semanticCoverage?.gap||0)>0)push("semantic_gap_selected","critical","Entraron cartas coverage_gap al mazo.",{gap:build.validation.semanticCoverage.gap});
  const shortages=build?.shortages||{},actionableShortages=Object.fromEntries(Object.entries(shortages).filter(([,v])=>v?.reason!=="candidate_pool_limit"));if(Object.keys(actionableShortages).length)push("structural_shortage","high","El builder terminó con cuotas estructurales alcanzables sin cubrir.",{shortages:actionableShortages});
  if(Number(build?.mana?.weightedCoverage??1)<.85)push("mana_low_coverage","high","Cobertura de maná ponderada por debajo de 85%.",{weightedCoverage:build?.mana?.weightedCoverage,coverage:build?.mana?.sourceCoverage});
  if(Object.keys(build?.mana?.shortfalls||{}).length)push("mana_shortfall","high","El modelo reconoce colores por debajo del objetivo.",{shortfalls:build.mana.shortfalls});
  if(settings?.landStyle==="safe"&&Number(build?.summary?.nonbasicLands||0)>Number(build?.summary?.lands||0)*.65)push("safe_nonbasic_pressure","medium","landStyle=safe terminó con más de 65% de no básicas.",{lands:build?.summary?.lands,nonbasic:build?.summary?.nonbasicLands,basic:build?.summary?.basicLands});
  if(themeMode==="external_fallback"&&Object.keys(build?.summary?.themeFacets||{}).length<=1&&Number(build?.summary?.themeCards||0)>=12)push("fallback_facet_collapse","medium","External fallback colapsó la densidad temática en una sola facet.",{themeFacets:build?.summary?.themeFacets,themeCards:build?.summary?.themeCards});
  const selected=selectedSemantic(build,semanticByName),declaredLandRows=(build?.deck||[]).filter(r=>r.category==="Land"||r.selectionPhase==="mana"||r.selectionPhase==="basic");
  const falseLand=selected.filter(({row,sem})=>(row.category==="Land"||row.selectionPhase==="mana")&&!playableAsLandFromHand(sem));if(falseLand.length)push("land_face_playability","critical","Cartas no jugables como tierra desde la mano ocuparon land slots.",{cards:falseLand.map(x=>({name:x.row.name,layout:x.sem.layout,faces:(x.sem.faces||[]).map(f=>f.typeLine)}))});
  const actualPlayable=declaredLandRows.filter(r=>r.syntheticBasic||playableAsLandFromHand(semanticByName?.get?.(cardIdentityKey(r.name))||semanticByName?.get?.(r.name))).reduce((n,r)=>n+Number(r.quantity||1),0);if(actualPlayable&&actualPlayable!==Number(build?.summary?.lands||0))push("land_count_disagreement","high","Land slots declarados y tierras jugables desde la mano no coinciden.",{declared:build?.summary?.lands,playable:actualPlayable});
  const demand=build?.mana?.pipDemand||{};for(const color of Object.keys(demand)){if(Number(demand[color]||0)>0){const basicName={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest"}[color],basicQty=(build?.deck||[]).find(r=>r.name===basicName)?.quantity||0;if(settings?.landStyle==="safe"&&Number(basicQty)===0)push("safe_zero_basic_color","medium",`landStyle=safe terminó sin básicas de ${color} pese a tener demanda.`,{color,demand:demand[color],basic:basicName});}}
  for(const {row,sem} of selected){const roles=row.roles||{},views=sem?.views||{},dep=views.dependency||{};
    for(const [role,score] of Object.entries(roles))if(Number(score)>=.45&&views.roles?.[role]&&views.roles[role].adjudication!=="positive")push("role_view_mismatch","high","El build exportó un role fuerte que la Role View v2 no adjudica como positivo.",{card:row.name,role,score,adjudication:views.roles[role].adjudication});
    const finisherScope=(dep.packageNeeds||[]).length+(dep.stateNeeds||[]).length+(dep.environmentNeeds||[]).length+(dep.internalConstraints||[]).length+(dep.unresolvedConditions||[]).length;
    if(Number(roles.finisher||0)>=.65&&views.roles?.finisher?.conditional&&!finisherScope)push("conditional_finisher_unscoped","medium","Finisher condicional fuerte sin ninguna condición visible en Dependency View.",{card:row.name,score:roles.finisher});
  }
  const bottlenecks=build?.context?.bottlenecks||[];if(bottlenecks.length>=8)push("context_bottleneck_density","medium","El mazo termina con muchos bottlenecks contextuales.",{count:bottlenecks.length,top:bottlenecks.slice(0,8)});
  return issues;
}

export function clusterStressIssues(cases=[]){
  const map=new Map();for(const c of cases||[])for(const i of c.anomalies||[]){if(!map.has(i.family))map.set(i.family,{family:i.family,severity:i.severity,count:0,cases:[],examples:[]});const x=map.get(i.family);x.count++;if(x.cases.length<30)x.cases.push(c.id);if(x.examples.length<5)x.examples.push({commander:c.commander,theme:c.theme,message:i.message,evidence:i.evidence});if(["critical","high","medium","low"].indexOf(i.severity)<["critical","high","medium","low"].indexOf(x.severity))x.severity=i.severity;}
  return [...map.values()].sort((a,b)=>{const s={critical:4,high:3,medium:2,low:1};return(s[b.severity]||0)-(s[a.severity]||0)||b.count-a.count;});
}

export function summarizeStressCases(cases=[]){
  const ok=cases.filter(c=>c.status==="ok"),failed=cases.filter(c=>c.status!=="ok"),anomalous=ok.filter(c=>(c.anomalies||[]).length),modes={},themes={},colors={};
  for(const c of cases){modes[c.themeMode]=(modes[c.themeMode]||0)+1;themes[c.theme]=(themes[c.theme]||0)+1;colors[c.colorKey]=(colors[c.colorKey]||0)+1;}
  const modal={selected:0,modalDfc:0,transform:0,chooseModes:0,repeatable:0};
  for(const c of ok){const m=c.modal||{};for(const k of Object.keys(modal))modal[k]+=Number(m[k]||0);}
  return {requested:cases.length,completed:ok.length,failed:failed.length,anomalous:anomalous.length,clean:ok.length-anomalous.length,themeModes:modes,uniqueThemes:Object.keys(themes).length,topThemes:Object.entries(themes).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([name,count])=>({name,count})),colorIdentities:colors,avgCandidatePool:round(ok.reduce((n,c)=>n+Number(c.candidateCount||0),0)/Math.max(1,ok.length),1),avgWeightedManaCoverage:round(ok.reduce((n,c)=>n+Number(c.metrics?.weightedManaCoverage||0),0)/Math.max(1,ok.length)),avgThemeCards:round(ok.reduce((n,c)=>n+Number(c.metrics?.themeCards||0),0)/Math.max(1,ok.length)),modal};
}
