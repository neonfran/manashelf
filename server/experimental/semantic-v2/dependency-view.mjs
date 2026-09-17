import fs from "node:fs";
import zlib from "node:zlib";
import {deriveInteractionSignals} from "./interaction-signals.mjs";
import {streamSemanticV2Cards} from "./graph.mjs";

export const DEPENDENCY_VIEW_VERSION=1;
const arr=x=>Array.isArray(x)?x:[];
const uniq=xs=>[...new Set(arr(xs).filter(Boolean))];
const key=x=>JSON.stringify(x);

function intrinsicSignals(card){
  const out=[];
  const familiarSubtypes=new Set(["Bat","Bird","Cat","Dragon","Faerie","Fox","Frog","Imp","Lizard","Spider"]);
  for(const face of arr(card.faces)){
    if(!["default","alternative_entry"].includes(face.access?.kind))continue;
    for(const type of arr(face.cardTypes)){
      const t=String(type||"").toLowerCase().replace(/\s+/g,"_");
      out.push(`card:type:${t}`);
      if(["Creature","Artifact","Enchantment","Planeswalker","Battle","Land"].includes(type))out.push(`permanent:${t}`);
    }
    if(arr(face.cardTypes).includes("Legendary"))for(const type of arr(face.cardTypes))if(["Creature","Artifact","Enchantment","Planeswalker","Battle","Land"].includes(type))out.push(`permanent:legendary_${String(type).toLowerCase()}`);
    const permanentFace=arr(face.cardTypes).some(t=>["Creature","Artifact","Enchantment","Planeswalker","Battle","Land","Kindred"].includes(t));
    if(arr(face.cardTypes).includes("Basic")&&arr(face.cardTypes).includes("Land"))out.push("permanent:basic_land");
    if(arr(face.cardTypes).includes("Snow")&&permanentFace)out.push("permanent:supertype:snow");
    if(permanentFace){out.push(`permanent:name:${String(face.name||card.name||"").toLowerCase().replace(/\s+/g,"_")}`);if(!arr(face.cardTypes).includes("Land"))out.push("permanent:nonland_nontoken");for(const kw of arr(card.keywords))out.push(`permanent:keyword:${String(kw||"").toLowerCase().replace(/\s+/g,"_")}`);}
    if(!arr(face.cardTypes).includes("Land")){out.push("event:spell_cast");if(!arr(face.cardTypes).includes("Creature"))out.push("event:noncreature_spell_cast");if(arr(face.cardTypes).includes("Instant")||arr(face.cardTypes).includes("Sorcery"))out.push("event:instant_sorcery_spell_cast");}
    for(const subtype of arr(face.subtypes)){
      const st=String(subtype||"").toLowerCase().replace(/\s+/g,"_");out.push(`card:subtype:${st}`);
      if(arr(face.cardTypes).some(t=>["Creature","Artifact","Enchantment","Planeswalker","Battle","Land","Kindred"].includes(t)))out.push(`permanent:subtype:${st}`);
    }
    if(permanentFace&&(arr(face.subtypes).some(st=>familiarSubtypes.has(st))||/familiar/i.test(face.name||card.name)))out.push("package:familiar");
  }
  return uniq(out);
}

function atomsByClass(atoms){
  const out={package:[],environment:[],state:[],internal:[],constraint:[],unresolved:[],unclassified:[],negated:[]};
  for(const atom of arr(atoms)){
    if(atom.negated){out.negated.push(atom);continue;}
    const k=Object.prototype.hasOwnProperty.call(out,atom.dependencyClass)?atom.dependencyClass:"unclassified";
    out[k].push(atom);
  }
  return out;
}

function buildProducerIndex(card,signals){
  const map=new Map();
  const add=(signal,producer)=>{if(!map.has(signal))map.set(signal,[]);const bucket=map.get(signal);const k=key(producer);if(!bucket.some(x=>key(x)===k))bucket.push(producer);};
  for(const signal of intrinsicSignals(card))add(signal,{source:"intrinsic",capabilityId:null});
  for(const c of arr(signals.capabilities))for(const signal of arr(c.produces))add(signal,{source:"capability",capabilityId:c.capabilityId});
  return map;
}

function buildDemandRows(capabilities){
  const map=new Map();
  for(const c of capabilities)for(const atom of arr(c.packageAtoms)){
    const signal=atom.signal;if(!map.has(signal))map.set(signal,{signal,consumers:[],requiredCount:null});
    const row=map.get(signal),count=atom.count!==null&&atom.count!==undefined&&Number.isFinite(Number(atom.count))?Number(atom.count):null;
    row.consumers.push({capabilityId:c.capabilityId,count,source:atom.source||"logic",logic:atom.logic,path:atom.path});
    if(count!==null)row.requiredCount=Math.max(Number(row.requiredCount||0),count);
  }
  return [...map.values()];
}

export function deriveDependencyView(card){
  const signals=deriveInteractionSignals(card),producers=buildProducerIndex(card,signals),capabilities=[];
  const links=[];const linkSeen=new Set();
  for(const c of arr(signals.capabilities)){
    const grouped=atomsByClass(c.needAtoms),packageAtoms=grouped.package,packageNeeds=uniq(packageAtoms.map(x=>x.signal));
    const satisfiedBySelf=[],externalNeeds=[];
    for(const signal of packageNeeds){
      const ps=arr(producers.get(signal));
      if(ps.length){
        satisfiedBySelf.push(signal);
        for(const p of ps){const l={signal,producerCapabilityId:p.capabilityId,producerSource:p.source,consumerCapabilityId:c.capabilityId};const lk=key(l);if(!linkSeen.has(lk)){linkSeen.add(lk);links.push(l);}}
      }else externalNeeds.push(signal);
    }
    capabilities.push({
      capabilityId:c.capabilityId,action:c.action,operator:c.operator,access:c.access,
      produces:arr(c.produces),packageNeeds,packageAtoms,
      environmentNeeds:uniq(grouped.environment.map(x=>x.signal)),stateNeeds:uniq(grouped.state.map(x=>x.signal)),
      internalConstraints:uniq([...grouped.internal,...grouped.constraint].map(x=>x.signal)),
      unresolvedConditions:uniq([...grouped.unresolved,...grouped.unclassified].map(x=>x.signal)),
      negatedDependencies:grouped.negated,
      requirementLogic:c.requirementLogic,conditionLogic:c.conditionLogic,
      satisfiedBySelf,externalNeeds
    });
  }
  const demands=buildDemandRows(capabilities),supply=[...producers.entries()].map(([signal,ps])=>({signal,producers:ps}));
  const packageNeeds=uniq(capabilities.flatMap(c=>c.packageNeeds)),externalNeeds=uniq(capabilities.flatMap(c=>c.externalNeeds));
  const environmentNeeds=uniq(capabilities.flatMap(c=>c.environmentNeeds)),stateNeeds=uniq(capabilities.flatMap(c=>c.stateNeeds));
  const internalConstraints=uniq(capabilities.flatMap(c=>c.internalConstraints)),unresolvedConditions=uniq(capabilities.flatMap(c=>c.unresolvedConditions));
  return {
    version:DEPENDENCY_VIEW_VERSION,oracleId:card.oracleId,name:card.name,
    produces:uniq(signals.produces),packageNeeds,externalNeeds,environmentNeeds,stateNeeds,internalConstraints,unresolvedConditions,
    supply,demands,links,capabilities,
    summary:{
      packageNeedCount:packageNeeds.length,externalNeedCount:externalNeeds.length,selfSupportedNeedCount:packageNeeds.length-externalNeeds.length,
      environmentNeedCount:environmentNeeds.length,stateNeedCount:stateNeeds.length,internalConstraintCount:internalConstraints.length,
      unresolvedConditionCount:unresolvedConditions.length,internalLinkCount:links.length,
      commanderDependent:packageNeeds.includes("commander:controlled")
    }
  };
}

export async function writeDependencyViews(inputDbPath,outputPath){
  const out=fs.createWriteStream(outputPath),gzip=outputPath.endsWith(".gz")?zlib.createGzip({level:6}):null,target=gzip||out;if(gzip)gzip.pipe(out);
  const stats={version:DEPENDENCY_VIEW_VERSION,cards:0,cardsWithPackageNeeds:0,cardsWithExternalNeeds:0,cardsWithUnresolvedConditions:0,packageNeeds:0,externalNeeds:0,internalLinks:0,uniqueSignals:new Set()};
  target.write(JSON.stringify({recordType:"header",schema:"manashelf-dependency-view-jsonl",version:DEPENDENCY_VIEW_VERSION})+'\n');
  for await(const card of streamSemanticV2Cards(inputDbPath)){
    const view=deriveDependencyView(card);stats.cards++;if(view.packageNeeds.length)stats.cardsWithPackageNeeds++;if(view.externalNeeds.length)stats.cardsWithExternalNeeds++;if(view.unresolvedConditions.length)stats.cardsWithUnresolvedConditions++;
    stats.packageNeeds+=view.packageNeeds.length;stats.externalNeeds+=view.externalNeeds.length;stats.internalLinks+=view.links.length;for(const s of [...view.produces,...view.packageNeeds])stats.uniqueSignals.add(s);
    target.write(JSON.stringify({recordType:"dependency_view",oracleId:card.oracleId,view})+'\n');
  }
  const serial={...stats,uniqueSignals:stats.uniqueSignals.size};target.write(JSON.stringify({recordType:"summary",stats:serial})+'\n');
  await new Promise((resolve,reject)=>{if(gzip){gzip.end();out.on("finish",resolve);out.on("error",reject);}else{out.end(resolve);out.on("error",reject);}});
  return serial;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const input=process.argv[2],output=process.argv[3];if(!input||!output)throw new Error("usage: node dependency-view.mjs <semantic-v2-db.jsonl.gz> <dependency-view.jsonl.gz>");
  console.log(JSON.stringify(await writeDependencyViews(input,output),null,2));
}
