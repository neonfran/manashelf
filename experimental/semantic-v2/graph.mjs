import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";
import {stable} from "./schema.mjs";

export const CAPABILITY_GRAPH_VERSION=2;

const arr=x=>Array.isArray(x)?x:[];
const clean=x=>String(x??"").trim();
const keyPart=x=>encodeURIComponent(clean(typeof x==="string"?x:JSON.stringify(stable(x))));
const edgeKey=e=>`${e.from}|${e.type}|${e.to}|${JSON.stringify(stable(e.details||{}))}`;

function logicPredicates(expr,out=[]){
  if(!expr||typeof expr!=="object")return out;
  if(expr.op==="predicate")out.push({kind:expr.kind,value:expr.value??null,extra:Object.fromEntries(Object.entries(expr).filter(([k])=>!["op","kind","value"].includes(k)))});
  if(["and","or","at_least","at_most","exactly"].includes(expr.op))for(const x of arr(expr.args))logicPredicates(x,out);
  if(expr.op==="not")logicPredicates(expr.arg,out);
  return out;
}

function featureId(type,value){return `feature:${type}:${keyPart(value)}`;}

export function buildCardCapabilityGraph(card){
  const nodes=new Map(),edges=[],edgeSeen=new Set();
  const addNode=(id,type,data={})=>{if(!nodes.has(id))nodes.set(id,{id,type,...data});return id;};
  const addEdge=(from,to,type,details={})=>{const e={from,to,type,...(Object.keys(details).length?{details}: {})};const k=edgeKey(e);if(!edgeSeen.has(k)){edgeSeen.add(k);edges.push(e);}return e;};
  const addLogicTree=(capId,expr,kind,path="0")=>{
    if(!expr||typeof expr!=="object"||expr.op==="true")return null;
    const lid=`${capId}:logic:${kind}:${path}`;addNode(lid,"logic_expr",{logicKind:kind,op:expr.op,count:expr.count??null});
    if(expr.op==="predicate"){
      const p={kind:expr.kind,value:expr.value??null,extra:Object.fromEntries(Object.entries(expr).filter(([k])=>!["op","kind","value"].includes(k)))};
      const fid=featureId(kind,{kind:p.kind,value:p.value,extra:p.extra});addNode(fid,"feature",{featureType:kind,predicate:p});addEdge(lid,fid,"logic_predicate");
    }else if(expr.op==="not"){
      const child=addLogicTree(capId,expr.arg,kind,`${path}.0`);if(child)addEdge(lid,child,"logic_arg",{index:0});
    }else if(["and","or","at_least","at_most","exactly"].includes(expr.op)){
      arr(expr.args).forEach((x,i)=>{const child=addLogicTree(capId,x,kind,`${path}.${i}`);if(child)addEdge(lid,child,"logic_arg",{index:i});});
    }
    return lid;
  };
  const cardId=`card:${card.oracleId}`;addNode(cardId,"card",{oracleId:card.oracleId,name:card.name,layout:card.layout,coverage:card.coverage?.status??null});

  for(const color of arr(card.colorIdentity)){const id=featureId("color",color);addNode(id,"feature",{featureType:"color",value:color});addEdge(cardId,id,"has_color_identity");}
  for(const kw of arr(card.keywords)){const id=featureId("keyword",kw);addNode(id,"feature",{featureType:"keyword",value:kw});addEdge(cardId,id,"has_keyword");}

  for(const face of arr(card.faces)){
    const faceId=`${cardId}:${face.id}`;addNode(faceId,"face",{faceId:face.id,index:face.index,name:face.name,typeLine:face.typeLine,access:face.access});addEdge(cardId,faceId,"has_face");
    for(const type of arr(face.cardTypes)){const id=featureId("card_type",type);addNode(id,"feature",{featureType:"card_type",value:type});addEdge(faceId,id,"has_type");}
    for(const subtype of arr(face.subtypes)){const id=featureId("subtype",subtype);addNode(id,"feature",{featureType:"subtype",value:subtype});addEdge(faceId,id,"has_subtype");}
    const accessId=featureId("access_kind",face.access?.kind||"unknown");addNode(accessId,"feature",{featureType:"access_kind",value:face.access?.kind||"unknown"});addEdge(faceId,accessId,"has_access");
  }

  for(const cap of arr(card.capabilities)){
    const capId=`${cardId}:cap:${cap.id}`;addNode(capId,"capability",{capabilityId:cap.id,operator:cap.operator,action:cap.action,object:cap.object,coverage:cap.coverage,confidence:cap.confidence,magnitude:cap.magnitude,frequency:cap.frequency,timing:cap.timing,polarity:cap.polarity,source:cap.source});addEdge(cardId,capId,"has_capability");
    if(cap.faceId)addEdge(`${cardId}:${cap.faceId}`,capId,"face_has_capability");
    const actionId=featureId("action",cap.action);addNode(actionId,"feature",{featureType:"action",value:cap.action});addEdge(capId,actionId,"performs_action",{operator:cap.operator});
    const opId=featureId("operator",cap.operator);addNode(opId,"feature",{featureType:"operator",value:cap.operator});addEdge(capId,opId,"has_operator");
    if(cap.object!==null&&cap.object!==undefined){const id=featureId("object",cap.object);addNode(id,"feature",{featureType:"object",value:cap.object});addEdge(capId,id,"acts_on_object");}
    for(const [role,ref] of [["actor",cap.actor],["target",cap.target],["beneficiary",cap.beneficiary]])if(ref?.kind){const id=featureId("entity",ref.kind);addNode(id,"feature",{featureType:"entity",value:ref.kind});addEdge(capId,id,role,{reference:ref});}
    for(const [role,z] of [["from_zone",cap.zones?.source],["to_zone",cap.zones?.destination]])if(z){const id=featureId("zone",z);addNode(id,"feature",{featureType:"zone",value:z});addEdge(capId,id,role);}
    for(const r of arr(cap.resources)){
      const id=featureId("resource",r.resource);addNode(id,"feature",{featureType:"resource",value:r.resource});
      const rel=r.direction==="produce"?"produces_resource":r.direction==="consume"?"consumes_resource":"moves_resource";addEdge(capId,id,rel,{amount:r.amount??null,from:r.from??null,to:r.to??null,beneficiary:r.beneficiary??null});
    }
    const reqRoot=addLogicTree(capId,cap.requirements,"requirement");if(reqRoot)addEdge(capId,reqRoot,"requires_logic");
    const condRoot=addLogicTree(capId,cap.conditions,"condition");if(condRoot)addEdge(capId,condRoot,"condition_logic");
    for(const p of logicPredicates(cap.requirements)){const id=featureId("requirement",{kind:p.kind,value:p.value,extra:p.extra});addNode(id,"feature",{featureType:"requirement",predicate:p});addEdge(capId,id,"requires_feature");}
    for(const p of logicPredicates(cap.conditions)){const id=featureId("condition",{kind:p.kind,value:p.value,extra:p.extra});addNode(id,"feature",{featureType:"condition",predicate:p});addEdge(capId,id,"condition_feature");}
  }

  for(const group of arr(card.optionGroups)){
    const gid=`${cardId}:option:${group.id}`;addNode(gid,"option_group",{groupId:group.id,policy:group.policy,selection:group.selection,instruction:group.instruction});addEdge(cardId,gid,"has_option_group");
    for(const cid of arr(group.capabilityIds)){const to=`${cardId}:cap:${cid}`;if(nodes.has(to))addEdge(gid,to,"offers_capability",{policy:group.policy});}
  }
  for(const rel of arr(card.relations)){
    const from=rel.fromCapabilityId?`${cardId}:cap:${rel.fromCapabilityId}`:rel.fromFaceId?`${cardId}:${rel.fromFaceId}`:rel.fromGroupId?`${cardId}:option:${rel.fromGroupId}`:null;
    const to=rel.toCapabilityId?`${cardId}:cap:${rel.toCapabilityId}`:rel.toFaceId?`${cardId}:${rel.toFaceId}`:null;
    if(from&&to&&nodes.has(from)&&nodes.has(to))addEdge(from,to,`semantic_${rel.type}`,rel.details||{});
  }

  const signals={produces:[],consumes:[],requires:[],actions:[],conditions:[]};
  for(const e of edges){const n=nodes.get(e.to);if(!n?.featureType)continue;if(e.type==="produces_resource")signals.produces.push(`resource:${n.value}`);if(e.type==="consumes_resource")signals.consumes.push(`resource:${n.value}`);if(e.type==="requires_feature")signals.requires.push(`requirement:${JSON.stringify(stable(n.predicate))}`);if(e.type==="performs_action")signals.actions.push(`${e.details?.operator||"perform"}:${n.value}`);if(e.type==="condition_feature")signals.conditions.push(`condition:${JSON.stringify(stable(n.predicate))}`);}
  for(const k of Object.keys(signals))signals[k]=[...new Set(signals[k])];
  return {version:CAPABILITY_GRAPH_VERSION,oracleId:card.oracleId,name:card.name,nodes:[...nodes.values()],edges,signals};
}

export async function* streamSemanticV2Cards(filePath){
  const raw=fs.createReadStream(filePath),input=filePath.endsWith('.gz')?raw.pipe(zlib.createGunzip()):raw;
  const rl=readline.createInterface({input,crlfDelay:Infinity});
  for await(const line of rl){const s=line.trim();if(!s)continue;const rec=JSON.parse(s);if(rec.recordType==="card"&&rec.card)yield rec.card;}
}

export async function writeGlobalCapabilityGraph(inputDbPath,outputPath){
  const out=fs.createWriteStream(outputPath),gzip=outputPath.endsWith('.gz')?zlib.createGzip({level:6}):null,target=gzip||out;if(gzip)gzip.pipe(out);
  const stats={version:CAPABILITY_GRAPH_VERSION,cards:0,nodes:0,edges:0,nodeTypes:{},edgeTypes:{},features:{}};
  target.write(JSON.stringify({recordType:"header",schema:"manashelf-capability-graph-jsonl",version:CAPABILITY_GRAPH_VERSION})+'\n');
  for await(const card of streamSemanticV2Cards(inputDbPath)){
    const graph=buildCardCapabilityGraph(card);stats.cards++;stats.nodes+=graph.nodes.length;stats.edges+=graph.edges.length;
    for(const n of graph.nodes){stats.nodeTypes[n.type]=(stats.nodeTypes[n.type]||0)+1;if(n.type==="feature")stats.features[n.featureType]=(stats.features[n.featureType]||0)+1;}
    for(const e of graph.edges)stats.edgeTypes[e.type]=(stats.edgeTypes[e.type]||0)+1;
    target.write(JSON.stringify({recordType:"card_graph",oracleId:card.oracleId,graph})+'\n');
  }
  target.write(JSON.stringify({recordType:"summary",stats})+'\n');
  await new Promise((resolve,reject)=>{if(gzip){gzip.end();out.on('finish',resolve);out.on('error',reject);}else{out.end(resolve);out.on('error',reject);}});
  return stats;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const input=process.argv[2],output=process.argv[3];if(!input||!output)throw new Error('usage: node graph.mjs <semantic-v2-db.jsonl.gz> <graph.jsonl.gz>');
  console.log(JSON.stringify(await writeGlobalCapabilityGraph(input,output),null,2));
}
