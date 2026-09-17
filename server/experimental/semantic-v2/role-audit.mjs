import fs from "node:fs";
import {streamSemanticV2Cards} from "./graph.mjs";
import {deriveRoleViews,ROLE_NAMES,ROLE_VIEW_VERSION} from "./role-views.mjs";

export async function auditRoles(inputDbPath,{outputPath=null}={}){
  const out={schema:"manashelf-role-view-audit",version:ROLE_VIEW_VERSION,cards:{total:0,commanderLegal:0},roles:Object.fromEntries(ROLE_NAMES.map(r=>[r,{positive:0,conditional:0,partialEvidence:0,scoreBuckets:{strong:0,medium:0,weak:0},examples:[]}]))};
  for await(const card of streamSemanticV2Cards(inputDbPath)){
    out.cards.total++;if(card.legalities?.commander!=="legal")continue;out.cards.commanderLegal++;
    const views=deriveRoleViews(card);
    for(const role of ROLE_NAMES){const v=views[role];if(v.adjudication!=="positive")continue;const s=Number(v.potentialScore||0),r=out.roles[role];r.positive++;if(v.conditional)r.conditional++;if(v.evidence.some(e=>e.coverage==="partial"))r.partialEvidence++;if(s>=.75)r.scoreBuckets.strong++;else if(s>=.45)r.scoreBuckets.medium++;else r.scoreBuckets.weak++;if(r.examples.length<8)r.examples.push({name:card.name,score:s,conditional:v.conditional,evidence:v.evidence.slice(0,2).map(e=>({action:e.action,reason:e.reason,access:e.access,rawScore:e.rawScore}))});}
  }
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(out,null,2));return out;
}
if(import.meta.url===`file://${process.argv[1]}`){const input=process.argv[2],output=process.argv[3]||null;if(!input)throw new Error('usage: node role-audit.mjs <semantic-v2-db.jsonl.gz> [out.json]');const a=await auditRoles(input,{outputPath:output});console.log(JSON.stringify({cards:a.cards,roles:Object.fromEntries(Object.entries(a.roles).map(([k,v])=>[k,{positive:v.positive,conditional:v.conditional,partialEvidence:v.partialEvidence,scoreBuckets:v.scoreBuckets}]))},null,2));}
