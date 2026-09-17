export const LAB3_AB_SCHEMA="manashelf-lab2-lab3-ab-v1";
const round=(n,d=3)=>Number((Number(n)||0).toFixed(d));
const key=s=>String(s||"").trim().toLowerCase();
const expandedNames=deck=>{const out=[];for(const c of deck||[])for(let i=0;i<Math.max(1,Number(c.quantity||1));i++)out.push(c.name);return out;};

export function compareLab2Lab3(lab2Log,lab3Build,{candidateScope="unknown"}={}){
  const l2=expandedNames(lab2Log?.deck||[]),l3=expandedNames(lab3Build?.deck||[]),s2=new Set(l2.map(key)),s3=new Set(l3.map(key)),shared=[...s3].filter(x=>s2.has(x));
  const l2Roles=lab2Log?.result?.roleCounts||{},l3Roles=lab3Build?.summary?.roleCounts||{};
  const comparable={
    ramp:[Number(l2Roles.ramp||0),Number(l3Roles.ramp||0)],
    resources:[Number(l2Roles.resources||0),Number(l3Roles.resources||0)],
    interaction:[Number(l2Roles.interaction||0),Number(l3Roles.interaction||0)],
    wipes:[Number(l2Roles.wipes||0),Number(l3Roles.wipes||0)],
    resilience:[Number(l2Roles.resilience||0),Number(l3Roles.protection||0)+Number(l3Roles.recursion||0)],
    finishers:[Number(l2Roles.finishers||0),Number(l3Roles.finishers||0)]
  };
  const roleDelta=Object.fromEntries(Object.entries(comparable).map(([k,[a,b]])=>[k,{lab2:round(a),lab3:round(b),delta:round(b-a)}]));
  return {schema:LAB3_AB_SCHEMA,createdAt:new Date().toISOString(),candidateScope,commander:lab2Log?.input?.commander||lab3Build?.deck?.[0]?.name||null,theme:lab2Log?.input?.theme?.name||lab3Build?.theme||null,
    deck:{lab2Count:l2.reduce((n)=>n+1,0),lab3Count:l3.reduce((n)=>n+1,0),uniqueLab2:s2.size,uniqueLab3:s3.size,sharedUnique:shared.length,jaccard:round(shared.length/Math.max(1,new Set([...s2,...s3]).size)),shared:shared.slice(0,200)},
    structure:{roles:roleDelta,lands:{lab2:Number(lab2Log?.result?.summary?.lands||0),lab3:Number(lab3Build?.summary?.lands||0)},themeCards:{lab2:Number(lab2Log?.result?.summary?.themeCards||0),lab3:Number(lab3Build?.summary?.themeCards||0)}},
    lab3:{semanticCoverage:lab3Build?.validation?.semanticCoverage||null,context:lab3Build?.context?.summary||null,bottlenecks:lab3Build?.context?.bottlenecks||[],shortages:lab3Build?.shortages||{}},
    caveats:[candidateScope!=="full-runtime-pool"?"A/B candidate pool is incomplete; overlap and land choices are diagnostic only, not a final quality verdict.":null].filter(Boolean)};
}
