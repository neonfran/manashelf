import fs from "node:fs";
import zlib from "node:zlib";
import {deriveManaView} from "./mana-view.mjs";
import {streamSemanticV2Cards} from "./graph.mjs";

export const CASTABILITY_VIEW_VERSION=1;
const arr=x=>Array.isArray(x)?x:[];
const COLORS=["W","U","B","R","G","C"];
const TRUE=x=>!x||x.op==="true";

export function manaBurden(parsed={}){
  const symbols=arr(parsed.symbols),strict={W:0,U:0,B:0,R:0,G:0,C:0},choices=[];
  let generic=0,variableCount=0,other=[];
  for(const s of symbols){
    if(s.kind==="generic")generic+=Number(s.amount||0);
    else if(s.kind==="colored"&&arr(s.colors).length===1)strict[s.colors[0]]=(strict[s.colors[0]]||0)+1;
    else if(s.kind==="choice")choices.push({colors:arr(s.colors),phyrexian:Boolean(s.phyrexian),genericAlternative:s.genericAlternative??null,raw:s.raw});
    else if(s.kind==="variable")variableCount++;
    else other.push(s.raw);
  }
  const fixedColored=COLORS.reduce((n,c)=>n+(strict[c]||0),0);
  return {generic,strictColored:strict,fixedColoredPips:fixedColored,choicePips:choices,choicePipCount:choices.length,variableCount,otherSymbols:other,
    coloredIntensity:fixedColored+choices.filter(x=>x.colors.length).length,
    hasPhyrexianChoice:choices.some(x=>x.phyrexian),hasGenericAlternative:choices.some(x=>x.genericAlternative!=null)};
}

const CAST_PERMISSION_ACTIONS=new Set(["cast_from_zone","cast_permission","play_permission","play_from_top","plot_from_zone"]);
const COST_ACTIONS=new Set(["reduce_cost","increase_cost","alternate_cost","alternate_cost_definition","replace_cost","waive_mana_cost","additional_cost","set_alternative_cost","define_keyword_cost","set_keyword_cost","cost_reduction_cap","mana_spending_flexibility","mana_payment_restriction","payment_option"]);
const RESTRICTION_ACTIONS=new Set(["casting_restriction","mana_payment_restriction"]);
const CAST_KEYWORD_ROUTES={
  flashback:{from:"graveyard",route:"keyword_cast"},
  "jump-start":{from:"graveyard",route:"keyword_cast"},
  escape:{from:"graveyard",route:"keyword_cast"},
  retrace:{from:"graveyard",route:"keyword_cast"},
  disturb:{from:"graveyard",route:"keyword_cast"},
  foretell:{from:"exile",route:"prepared_cast"},
  plot:{from:"exile",route:"prepared_cast"},
  suspend:{from:"exile",route:"delayed_cast"},
  madness:{from:"exile",route:"replacement_cast"},
  miracle:{from:"hand",route:"alternate_timing_cost"},
  blitz:{from:"hand",route:"alternate_cost"},
  emerge:{from:"hand",route:"alternate_cost"},
  evoke:{from:"hand",route:"alternate_cost"}
};
const PAYMENT_KEYWORDS=new Set(["convoke","delve","improvise","offering"]);

function normKeyword(x){return String(x||"").trim().toLowerCase();}
function capabilityFact(cap){return {capabilityId:cap.id,faceId:cap.faceId,abilityId:cap.abilityId||null,action:cap.action,operator:cap.operator,object:cap.object,zones:cap.zones,details:cap.details||{},requirements:cap.requirements,conditions:cap.conditions,costs:arr(cap.costs),coverage:cap.coverage,confidence:cap.confidence};}
function structuredScope(cap){
  const d=cap.details||{};
  if(d.costReductionScope==="self_spell"||d.scope==="self_spell")return "self";
  if(d.costReductionScope==="your_spells")return "your_spells";
  if(cap.action==="cast_from_zone"&&cap.object==="card"&&cap.zones?.owner?.kind==="you"&&TRUE(cap.requirements))return "potential_self";
  return "unspecified";
}
function intrinsicKeywords(card){
  const out=[];
  for(const cap of arr(card.capabilities))if(cap.action==="has_keyword"){
    const k=normKeyword(cap.details?.keyword);if(k)out.push({keyword:k,parameter:cap.details?.parameter??null,capabilityId:cap.id,faceId:cap.faceId});
  }
  for(const k0 of arr(card.keywords)){const k=normKeyword(k0);if(k&&!out.some(x=>x.keyword===k))out.push({keyword:k,parameter:null,capabilityId:null,faceId:null});}
  return out;
}

export function deriveCastabilityView(card){
  const mana=deriveManaView(card),keywords=intrinsicKeywords(card);
  const entries=mana.castFaces.map(f=>({faceId:f.faceId,name:f.name,access:f.access,manaValue:f.manaValue,manaCost:f.manaCost,burden:manaBurden(f.manaCost),requirements:f.requirements,coverage:f.coverage,
    defaultCastFrom:f.access==="default"||f.access==="alternative_entry"?"hand":null}));

  const permissions=[],costModifiers=[],restrictions=[];
  for(const cap of arr(card.capabilities)){
    if(CAST_PERMISSION_ACTIONS.has(cap.action))permissions.push({...capabilityFact(cap),scopeClass:structuredScope(cap)});
    if(COST_ACTIONS.has(cap.action))costModifiers.push({...capabilityFact(cap),scopeClass:structuredScope(cap)});
    if(RESTRICTION_ACTIONS.has(cap.action))restrictions.push({...capabilityFact(cap),scopeClass:structuredScope(cap)});
  }
  const keywordRoutes=[];
  const paymentMethods=[];
  for(const k of keywords){
    const route=CAST_KEYWORD_ROUTES[k.keyword];if(route)keywordRoutes.push({...route,keyword:k.keyword,parameter:k.parameter,faceId:k.faceId,capabilityId:k.capabilityId});
    if(PAYMENT_KEYWORDS.has(k.keyword))paymentMethods.push({kind:"keyword_payment",keyword:k.keyword,parameter:k.parameter,faceId:k.faceId,capabilityId:k.capabilityId});
  }
  if(costModifiers.some(x=>x.action==="mana_spending_flexibility"))paymentMethods.push({kind:"mana_spending_flexibility"});
  if(costModifiers.some(x=>x.action==="waive_mana_cost"))paymentMethods.push({kind:"waive_mana_cost"});

  const strictColoredTotals={W:0,U:0,B:0,R:0,G:0,C:0};
  for(const e of entries)for(const c of COLORS)strictColoredTotals[c]+=e.burden.strictColored[c]||0;
  return {version:CASTABILITY_VIEW_VERSION,oracleId:card.oracleId,name:card.name,entries,permissions,costModifiers,restrictions,keywordRoutes,paymentMethods,
    summary:{castFaceCount:entries.length,hasDefaultHandEntry:entries.some(e=>e.defaultCastFrom==="hand"),hasNonHandRoute:permissions.some(p=>p.zones?.source&&p.zones.source!=="hand")||keywordRoutes.some(r=>r.from!=="hand"),hasCostModification:costModifiers.length>0,hasCastingRestriction:restrictions.length>0,strictColoredTotals,
      maxColoredIntensity:entries.reduce((m,e)=>Math.max(m,e.burden.coloredIntensity),0),hasVariableCost:entries.some(e=>e.burden.variableCount>0),hasHybridOrChoice:entries.some(e=>e.burden.choicePipCount>0)}};
}

export async function writeCastabilityViews(inputDbPath,outputPath){
  const out=fs.createWriteStream(outputPath),gzip=outputPath.endsWith(".gz")?zlib.createGzip({level:6}):null,target=gzip||out;if(gzip)gzip.pipe(out);
  const stats={version:CASTABILITY_VIEW_VERSION,cards:0,cardsWithCastFaces:0,cardsWithNonHandRoute:0,cardsWithCostModification:0,cardsWithCastingRestriction:0,cardsWithHybridOrChoice:0,cardsWithVariableCost:0,permissions:0,costModifiers:0,restrictions:0,keywordRoutes:0};
  target.write(JSON.stringify({recordType:"header",schema:"manashelf-castability-view-jsonl",version:CASTABILITY_VIEW_VERSION})+'\n');
  for await(const card of streamSemanticV2Cards(inputDbPath)){
    const view=deriveCastabilityView(card);stats.cards++;if(view.entries.length)stats.cardsWithCastFaces++;if(view.summary.hasNonHandRoute)stats.cardsWithNonHandRoute++;if(view.summary.hasCostModification)stats.cardsWithCostModification++;if(view.summary.hasCastingRestriction)stats.cardsWithCastingRestriction++;if(view.summary.hasHybridOrChoice)stats.cardsWithHybridOrChoice++;if(view.summary.hasVariableCost)stats.cardsWithVariableCost++;stats.permissions+=view.permissions.length;stats.costModifiers+=view.costModifiers.length;stats.restrictions+=view.restrictions.length;stats.keywordRoutes+=view.keywordRoutes.length;
    target.write(JSON.stringify({recordType:"castability_view",oracleId:card.oracleId,view})+'\n');
  }
  target.write(JSON.stringify({recordType:"summary",stats})+'\n');
  await new Promise((resolve,reject)=>{if(gzip){gzip.end();out.on("finish",resolve);out.on("error",reject);}else{out.end(resolve);out.on("error",reject);}});
  return stats;
}
if(import.meta.url===`file://${process.argv[1]}`){const input=process.argv[2],output=process.argv[3];if(!input||!output)throw new Error("usage: node castability-view.mjs <semantic-v2-db.jsonl.gz> <castability-view.jsonl.gz>");console.log(JSON.stringify(await writeCastabilityViews(input,output),null,2));}
