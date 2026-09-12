import fs from "node:fs";
import zlib from "node:zlib";
import {deriveDependencyView} from "./dependency-view.mjs";
import {streamSemanticV2Cards} from "./graph.mjs";

export const THEME_VIEW_VERSION=1;
const arr=x=>Array.isArray(x)?x:[];
const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));

function combine(weights){let miss=1;for(const w of weights)miss*=1-clamp01(w);return clamp01(1-miss);}
function faceHasType(card,type){return arr(card.faces).some(f=>arr(f.cardTypes).includes(type)&&["default","alternative_entry"].includes(f.access?.kind));}
function faceHasSubtype(card,subtype){return arr(card.faces).some(f=>arr(f.subtypes).includes(subtype)&&["default","alternative_entry"].includes(f.access?.kind));}

export function deriveThemeView(card){
  const dep=deriveDependencyView(card),evidence=new Map();
  const add=(facet,role,weight,kind,value,capabilityId=null)=>{
    if(!evidence.has(facet))evidence.set(facet,[]);
    evidence.get(facet).push({role,weight:clamp01(weight),kind,value,capabilityId});
  };
  const produced=new Set(dep.produces),needed=new Set(dep.packageNeeds),state=new Set(dep.stateNeeds),keywords=new Set(arr(card.keywords).map(norm));
  const actions=new Map();for(const cap of arr(card.capabilities)){if(!actions.has(cap.action))actions.set(cap.action,[]);actions.get(cap.action).push(cap);}
  const hasAction=a=>actions.has(a),caps=a=>actions.get(a)||[];

  for(const [type,facet] of [["Artifact","artifacts"],["Enchantment","enchantments"],["Land","lands"],["Legendary","legends"]])if(faceHasType(card,type))add(facet,"identity",.9,"card_type",type);
  if(faceHasSubtype(card,"Equipment"))add("equipment","identity",1,"subtype","Equipment");
  if(faceHasSubtype(card,"Aura"))add("auras","identity",1,"subtype","Aura");
  if(faceHasSubtype(card,"Saga"))add("historic","payload",.8,"subtype","Saga");
  if(faceHasType(card,"Artifact"))add("historic","payload",.65,"card_type","Artifact");
  if(faceHasType(card,"Legendary"))add("historic","payload",.65,"card_type","Legendary");

  const packageFacet=(facet,signals,{need=.88,produce=.78}={})=>{for(const s of signals){if(needed.has(s))add(facet,"payoff",need,"dependency",s);if(produced.has(s))add(facet,"enabler",produce,"production",s);}};
  packageFacet("artifacts",["permanent:artifact","card:type:artifact"]);
  packageFacet("enchantments",["permanent:enchantment","card:type:enchantment"]);
  packageFacet("lands",["permanent:land","card:type:land","resource:land_play"]);
  packageFacet("tokens",["permanent:token","event:token_created"],{need:.92,produce:.96});
  packageFacet("lifegain",["event:life_gain"],{need:.9,produce:.9});
  packageFacet("sacrifice",["event:sacrifice","event:creature_death"],{need:.94,produce:.86});
  packageFacet("graveyard",["zone:your_graveyard","zone:graveyard","event:discard","event:mill"],{need:.94,produce:.7});
  packageFacet("spellslinger",["card:instant_sorcery","event:instant_sorcery_spell_cast","event:spell_copy"],{need:.96,produce:.76});
  packageFacet("kindred",["package:shared_creature_type"],{need:.92,produce:.55});

  if(faceHasType(card,"Instant")||faceHasType(card,"Sorcery"))add("spellslinger","payload",.7,"card_type",faceHasType(card,"Instant")?"Instant":"Sorcery");
  for(const kw of ["magecraft","storm","prowess"] )if(keywords.has(kw))add("spellslinger","payoff",kw==="magecraft"?.95:kw==="storm"?.9:.72,"keyword",kw);
  for(const kw of ["landfall"])if(keywords.has(kw))add("lands","payoff",.9,"keyword",kw);
  for(const kw of ["equip"])if(keywords.has(kw))add("equipment","enabler",.8,"keyword",kw);
  for(const kw of ["enchant"])if(keywords.has(kw))add("auras","enabler",.72,"keyword",kw);

  for(const cap of caps("copy_spell"))add("spellslinger","enabler",.9,"action","copy_spell",cap.id);
  for(const cap of [...caps("copy_permanent"),...caps("copy_permanent_state")])add("clones","enabler",.96,"action",cap.action,cap.id);
  for(const cap of [...caps("add_counter"),...caps("modify_counter"),...caps("proliferate")])add("counters","enabler",cap.action==="proliferate"?.95:.78,"action",cap.action,cap.id);
  if([...state].some(s=>s.startsWith("source_counter:")))add("counters","payoff",.9,"state_need","source_counter");
  for(const cap of caps("sacrifice"))add("sacrifice","enabler",.76,"action","sacrifice",cap.id);
  for(const cap of arr(card.capabilities))if(arr(cap.costs).some(c=>c.operation==="sacrifice"&&c.from?.kind==="controlled_permanent"))add("sacrifice","enabler",.98,"activation_cost","sacrifice_controlled_permanent",cap.id);
  for(const cap of [...caps("cast_from_zone"),...caps("return"),...caps("put_referenced_battlefield"),...caps("put")]){
    if(cap.zones?.source==="graveyard"||needed.has("zone:your_graveyard"))add("graveyard","payoff",.86,"action",cap.action,cap.id);
  }
  for(const cap of caps("put_land_battlefield"))add("lands","enabler",.88,"action","put_land_battlefield",cap.id);
  for(const cap of caps("additional_land"))add("lands","enabler",.94,"action","additional_land",cap.id);
  for(const cap of caps("attach"))add("equipment","enabler",.65,"action","attach",cap.id);

  // Kindred is open-ended: each accessible printed subtype is a potential identity
  // facet, while dependency signals can expose subtype payoffs without a hardcoded list.
  for(const face of arr(card.faces))if(["default","alternative_entry"].includes(face.access?.kind)&&(arr(face.cardTypes).includes("Creature")||arr(face.cardTypes).includes("Kindred")))for(const st of arr(face.subtypes)){
    add(`kindred:${norm(st)}`,"identity",.82,"subtype",st);
  }
  for(const s of needed)if(s.startsWith("permanent:subtype:"))add(`kindred:${norm(s.slice("permanent:subtype:".length))}`,"payoff",.94,"dependency",s);

  const facets={};
  for(const [facet,ev] of evidence){
    const roles={};for(const e of ev){if(!roles[e.role])roles[e.role]=[];roles[e.role].push(e.weight);}
    facets[facet]={facet,strength:combine(ev.map(x=>x.weight)),roles:Object.fromEntries(Object.entries(roles).map(([k,v])=>[k,combine(v)])),evidence:ev};
  }
  const ranked=Object.values(facets).sort((a,b)=>b.strength-a.strength||a.facet.localeCompare(b.facet));
  return {version:THEME_VIEW_VERSION,oracleId:card.oracleId,name:card.name,facets,ranked,summary:{facetCount:ranked.length,primary:ranked[0]?.facet||null,primaryStrength:ranked[0]?.strength||0}};
}

export async function writeThemeViews(inputDbPath,outputPath){
  const out=fs.createWriteStream(outputPath),gzip=outputPath.endsWith(".gz")?zlib.createGzip({level:6}):null,target=gzip||out;if(gzip)gzip.pipe(out);
  const stats={version:THEME_VIEW_VERSION,cards:0,cardsWithFacets:0,facetAssignments:0,byFacet:{}};
  target.write(JSON.stringify({recordType:"header",schema:"manashelf-theme-view-jsonl",version:THEME_VIEW_VERSION})+'\n');
  for await(const card of streamSemanticV2Cards(inputDbPath)){
    const view=deriveThemeView(card);stats.cards++;if(view.ranked.length)stats.cardsWithFacets++;stats.facetAssignments+=view.ranked.length;for(const f of view.ranked)stats.byFacet[f.facet]=(stats.byFacet[f.facet]||0)+1;
    target.write(JSON.stringify({recordType:"theme_view",oracleId:card.oracleId,view})+'\n');
  }
  stats.byFacet=Object.fromEntries(Object.entries(stats.byFacet).sort((a,b)=>b[1]-a[1]).slice(0,100));target.write(JSON.stringify({recordType:"summary",stats})+'\n');
  await new Promise((resolve,reject)=>{if(gzip){gzip.end();out.on("finish",resolve);out.on("error",reject);}else{out.end(resolve);out.on("error",reject);}});
  return stats;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const input=process.argv[2],output=process.argv[3];if(!input||!output)throw new Error("usage: node theme-view.mjs <semantic-v2-db.jsonl.gz> <theme-view.jsonl.gz>");
  console.log(JSON.stringify(await writeThemeViews(input,output),null,2));
}
