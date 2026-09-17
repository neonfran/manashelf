import fs from "node:fs";
import zlib from "node:zlib";
import {streamRawCardsFromResultBundle} from "./source-bundle.mjs";
import {compileCardV5} from "./compiler.mjs";
import {validateSemanticV2Card} from "./schema.mjs";

const inc=(obj,key,n=1)=>obj[key]=(obj[key]||0)+n;
const addExample=(arr,value,limit=8)=>{if(arr.length<limit)arr.push(value);};
const isTrue=e=>e?.op==="true";

export async function auditBundle(bundlePath,{outputPath=null,writeDbPath=null}={}){
  const audit={
    schema:"manashelf-semantic-v2-corpus-audit",schemaVersion:1,compilerVersion:5,source:bundlePath,
    cards:{total:0,schemaErrors:0,byCoverage:{}},faces:{total:0,byAccess:{},layouts:{}},
    capabilities:{total:0,byOperator:{},topActions:{},byCoverage:{}},options:{groups:0,byPolicy:{},unlinked:0},
    gaps:{families:{},cardsWithGaps:0},invariants:{},examples:{},createdAt:new Date().toISOString()
  };
  let out=null,gzip=null;
  if(writeDbPath){fs.mkdirSync(new URL('.',`file://${writeDbPath}`).pathname,{recursive:true});out=fs.createWriteStream(writeDbPath);gzip=zlib.createGzip({level:6});gzip.pipe(out);gzip.write(JSON.stringify({recordType:"header",schema:"manashelf-semantic-v2-db",schemaVersion:1,compilerVersion:5,createdAt:audit.createdAt})+'\n');}
  for await(const raw of streamRawCardsFromResultBundle(bundlePath)){
    const c=compileCardV5(raw);audit.cards.total++;inc(audit.layouts??={},c.layout);inc(audit.cards.byCoverage,c.coverage.status);
    const errors=validateSemanticV2Card(c);if(errors.length){audit.cards.schemaErrors++;addExample(audit.examples.schemaErrors??=[],{name:c.name,errors});}
    audit.faces.total+=c.faces.length;inc(audit.faces.layouts,c.layout);
    for(const f of c.faces)inc(audit.faces.byAccess,f.access.kind);
    audit.capabilities.total+=c.capabilities.length;
    for(const cap of c.capabilities){inc(audit.capabilities.byOperator,cap.operator);inc(audit.capabilities.topActions,cap.action);inc(audit.capabilities.byCoverage,cap.coverage);for(const g of cap.gaps||[])inc(audit.gaps.families,g);}
    if(c.coverage.gapFamilies.length)audit.gaps.cardsWithGaps++;
    for(const g of c.optionGroups){audit.options.groups++;inc(audit.options.byPolicy,g.policy);if((g.options||[]).some(o=>!(o.capabilityIds||[]).length)){audit.options.unlinked++;addExample(audit.examples.unlinkedOptions??=[],{name:c.name,instruction:g.instruction,options:g.options});}}

    const inv=(key,evidence)=>{inc(audit.invariants,key);addExample(audit.examples[key]??=[],{name:c.name,...evidence});};
    for(const cap of c.capabilities){
      const t=String(cap.source?.rawText||'').toLowerCase();
      if(cap.action==='draw'&&cap.operator==='perform'&&!cap.details?.replacementResult&&cap.source?.synthetic!=='replacement_result'&&/would draw[^.]*instead/.test(t))inv('replacement_draw_as_positive_draw',{rawText:cap.source.rawText});
      if(cap.action==='gain_life'&&cap.operator==='perform'&&/can't gain life|cannot gain life/.test(t))inv('prohibition_as_positive_gain',{rawText:cap.source.rawText});
      const actionActuallyRefersToThatPlayer=(cap.action==='add_mana'&&/\bthat player adds?\b/.test(t))
        ||(cap.action==='deal_damage'&&/\b(?:damage to that player|that player[^.]{0,60}(?:deals?|is dealt)[^.]{0,40}damage)\b/.test(t))
        ||(cap.action==='draw'&&/\bthat player draws?\b/.test(t))
        ||(cap.action==='gain_life'&&/\bthat player gains?[^.]{0,30}life\b/.test(t))
        ||(cap.action==='discard'&&/\bthat player discards?\b/.test(t))
        ||(cap.action==='mill'&&/\bthat player mills?\b/.test(t));
      if(actionActuallyRefersToThatPlayer){
        const refs=[cap.actor?.kind,cap.target?.kind,cap.beneficiary?.kind];if(!refs.includes('referenced_player'))inv('that_player_reference_lost',{action:cap.action,rawText:cap.source.rawText,refs});
      }
      if(cap.action==='win_game'&&/\bif\b/.test(t)&&isTrue(cap.conditions)&&isTrue(cap.requirements))inv('conditional_win_without_requirement',{rawText:cap.source.rawText});
    }
    if(['transform','reversible_card','flip','meld'].includes(c.layout))for(const f of c.faces.slice(1))if(f.access.kind!=='state_transition')inv('sequential_face_wrong_access',{face:f.name,access:f.access});
    if(['modal_dfc','split','adventure'].includes(c.layout))if(!c.optionGroups.some(g=>g.id==='face-entry'))inv('alternative_face_group_missing',{});
    if(writeDbPath)gzip.write(JSON.stringify({recordType:'card',card:c})+'\n');
  }
  audit.capabilities.topActions=Object.fromEntries(Object.entries(audit.capabilities.topActions).sort((a,b)=>b[1]-a[1]).slice(0,100));
  audit.gaps.families=Object.fromEntries(Object.entries(audit.gaps.families).sort((a,b)=>b[1]-a[1]));
  if(gzip){await new Promise((resolve,reject)=>{gzip.end();out.on('finish',resolve);out.on('error',reject);});}
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(audit,null,2));
  return audit;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const bundle=process.argv[2],output=process.argv[3]||null,db=process.argv[4]||null;if(!bundle)throw new Error('usage: node corpus-audit.mjs <bundle.jsonl.gz> [audit.json] [semantic-v2-db.jsonl.gz]');
  const a=await auditBundle(bundle,{outputPath:output,writeDbPath:db});
  console.log(JSON.stringify({cards:a.cards,faces:a.faces,capabilities:{total:a.capabilities.total,byOperator:a.capabilities.byOperator,byCoverage:a.capabilities.byCoverage},options:a.options,gaps:{cardsWithGaps:a.gaps.cardsWithGaps,top:Object.entries(a.gaps.families).slice(0,15)},invariants:a.invariants},null,2));
}
