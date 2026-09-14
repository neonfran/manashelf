import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import crypto from "node:crypto";
import { once } from "node:events";
import { finished } from "node:stream/promises";
import { cardIdentityKey, cardNameAliases } from "../../lib/card-identity.mjs";
import { isDeckPlayableCard } from "./runtime-reader.mjs";

export const LAB3_SERVING_RUNTIME_VERSION=1;
export const LAB3_SERVING_RUNTIME_SCHEMA="manashelf-lab3-serving-runtime";

function readStream(file){const rs=fs.createReadStream(file);return file.endsWith(".gz")?rs.pipe(zlib.createGunzip()):rs;}
async function sha256File(file){const hash=crypto.createHash("sha256"),rs=fs.createReadStream(file);for await(const chunk of rs)hash.update(chunk);return hash.digest("hex");}
function compactFace(f={}){return {id:f.id??null,index:Number(f.index||0),name:f.name||"",typeLine:f.typeLine||"",cardTypes:f.cardTypes||[],subtypes:f.subtypes||[],manaCost:f.manaCost||"",manaValue:Number(f.manaValue||0),access:{kind:f.access?.kind||"default"},coverage:f.coverage||null};}
function compactRole(r={}){return {adjudication:r.adjudication||"no_evidence",potentialScore:Number(r.potentialScore??r.score??0),confidence:Number(r.confidence||0),conditional:Boolean(r.conditional)};}
function compactCapability(c={}){return {capabilityId:c.capabilityId||null,action:c.action||null,packageAtoms:c.packageAtoms||[],requirementLogic:c.requirementLogic||{op:"true"},conditionLogic:c.conditionLogic||{op:"true"},externalNeeds:c.externalNeeds||[]};}
function compactThemeFacet(name,r={}){return {facet:r.facet||name,strength:Number(r.strength||0)};}
function compactCastEntry(e={}){const b=e.burden||{};return {faceId:e.faceId||null,name:e.name||"",manaValue:Number(e.manaValue||0),burden:{strictColored:b.strictColored||{},choicePips:b.choicePips||[],coloredIntensity:Number(b.coloredIntensity||0),variableCount:Number(b.variableCount||0),choicePipCount:Number(b.choicePipCount||0)}};}
function compactArchetypes(rows={}){const out={};for(const [name,r0] of Object.entries(rows||{})){const r=r0||{},score=Number(r.score||0);if(r.adjudication==="positive"||score>0)out[name]={adjudication:r.adjudication||"no_evidence",score};}return out;}

export function projectRuntimeCardForServing(card={}){
  const views=card.views||{},roles=Object.fromEntries(Object.entries(views.roles||{}).map(([name,row])=>[name,compactRole(row)])),dep=views.dependency||{},theme=views.theme||{},mana=views.mana||{},castability=views.castability||{};
  const capabilities=(dep.capabilities||[]).filter(c=>(c?.packageAtoms||[]).length).map(compactCapability),facets=Object.fromEntries(Object.entries(theme.facets||{}).map(([name,row])=>[name,compactThemeFacet(name,row)])),ranked=(theme.ranked||[]).filter(x=>x?.facet).map(x=>({facet:x.facet,strength:Number(x.strength||0)}));
  return {
    runtimeSchemaVersion:Number(card.runtimeSchemaVersion||2),semanticSchema:card.semanticSchema||null,semanticSchemaVersion:Number(card.semanticSchemaVersion||0),semanticCompilerVersion:Number(card.semanticCompilerVersion||0),
    oracleId:card.oracleId||null,name:card.name||"",layout:card.layout||"normal",status:card.status||card.coverage?.status||"coverage_gap",coverage:{status:card.coverage?.status||card.status||"coverage_gap"},keywords:card.keywords||[],colorIdentity:card.colorIdentity||[],legalities:{commander:card.legalities?.commander||"not_legal"},faces:(card.faces||[]).map(compactFace),
    optionGroups:(card.optionGroups||[]).map(x=>({policy:x?.policy||null})),relations:(card.relations||[]).map(x=>({type:x?.type||null})),
    views:{
      roles,
      dependency:{produces:dep.produces||[],packageNeeds:dep.packageNeeds||[],externalNeeds:dep.externalNeeds||[],environmentNeeds:dep.environmentNeeds||[],stateNeeds:dep.stateNeeds||[],internalConstraints:dep.internalConstraints||[],unresolvedConditions:dep.unresolvedConditions||[],demands:dep.demands||[],capabilities,summary:{commanderDependent:Boolean(dep.summary?.commanderDependent)}},
      theme:{facets,ranked,summary:theme.summary||{}},
      themeFeatures:views.themeFeatures||{version:1,features:{},featureCount:0},
      mana:{sources:mana.sources||[],proxySources:mana.proxySources||[],isPlayableLand:Boolean(mana.isPlayableLand)},
      castability:{entries:(castability.entries||[]).map(compactCastEntry)}
    },
    archetypes:compactArchetypes(card.archetypes||{}),
    signals:{produces:card.signals?.produces||dep.produces||[],needs:card.signals?.needs||dep.externalNeeds||[],packageNeeds:card.signals?.packageNeeds||dep.packageNeeds||[],environmentNeeds:card.signals?.environmentNeeds||dep.environmentNeeds||[],stateNeeds:card.signals?.stateNeeds||dep.stateNeeds||[],facts:[]}
  };
}

export async function buildRuntimeServingIndex({sourceFile,outputFile}={}){
  if(!sourceFile||!outputFile)throw new Error("sourceFile and outputFile are required");
  const sourceSha256=await sha256File(sourceFile);await fsp.mkdir(path.dirname(outputFile),{recursive:true});
  const tmp=`${outputFile}.${process.pid}.${Date.now()}.tmp`,gzip=zlib.createGzip({level:6}),out=fs.createWriteStream(tmp);gzip.pipe(out);let header=null,records=0;
  const write=async line=>{if(!gzip.write(line)&&!gzip.destroyed)await once(gzip,"drain");};
  const rl=readline.createInterface({input:readStream(sourceFile),crlfDelay:Infinity});
  try{
    for await(const line of rl){if(!line.trim())continue;const row=JSON.parse(line);if(row.recordType==="header"){
        header={recordType:"header",schema:LAB3_SERVING_RUNTIME_SCHEMA,schemaVersion:LAB3_SERVING_RUNTIME_VERSION,sourceRuntime:{schema:row.schema||null,schemaVersion:Number(row.schemaVersion||0),sha256:sourceSha256},semantic:row.semantic||null,views:row.views||null,sourceCreatedAt:row.createdAt||null};await write(`${JSON.stringify(header)}\n`);continue;
      }
      const card=projectRuntimeCardForServing(row.card||{});if(!card.name||!card.oracleId)continue;await write(`${JSON.stringify({recordType:"card",card})}\n`);records++;
    }
    gzip.end();await finished(out);await fsp.rename(tmp,outputFile);return {header,records,sourceSha256,outputFile,bytes:(await fsp.stat(outputFile)).size};
  }catch(e){gzip.destroy();out.destroy();try{await fsp.unlink(tmp)}catch{}throw e;}
}

function extractJsonStringField(line,field){const re=new RegExp(`"${field}":("(?:\\\\.|[^"\\\\])*")`),m=line.match(re);if(!m)return null;try{return JSON.parse(m[1]);}catch{return null;}}
function extractOracleId(line){const m=line.match(/"oracleId":"([^"\\]+)"/);return m?.[1]||null;}
function aliasPriority(card,alias){const exact=cardIdentityKey(card?.name)===alias,legal=card?.legalities?.commander==="legal",playable=isDeckPlayableCard(card);return (legal?1000:0)+(playable?300:0)+(exact?80:0)+(String(card?.layout||"")==="normal"?10:0);}
function aliasesForRuntimeCard(card){return isDeckPlayableCard(card)?cardNameAliases(card.name):[cardIdentityKey(card.name)];}

export async function readRuntimeServingHeader(file){const rl=readline.createInterface({input:readStream(file),crlfDelay:Infinity});try{for await(const line of rl){if(!line.trim())continue;const row=JSON.parse(line);if(row.recordType!=="header")throw new Error("LAB3 serving runtime header missing");return row;}}finally{rl.close();}throw new Error("LAB3 serving runtime is empty");}

export async function loadRuntimeServingSelection(file,{names=[],oracleIds=[]}={}){
  const wantedNames=[...new Set((names||[]).map(x=>String(x||"").trim()).filter(Boolean))],wantedNameKeys=new Set(wantedNames.flatMap(cardNameAliases)),wantedOracle=new Set((oracleIds||[]).map(x=>String(x||"").trim()).filter(Boolean)),cards=new Map(),priority=new Map(),byOracleId=new Map();let header=null,scanned=0,parsed=0;
  const rl=readline.createInterface({input:readStream(file),crlfDelay:Infinity});
  for await(const line of rl){if(!line.trim())continue;if(line.includes('"recordType":"header"')){header=JSON.parse(line);continue;}scanned++;
    const oid=extractOracleId(line),name=extractJsonStringField(line,"name"),nameAliases=name?cardNameAliases(name):[],nameHit=nameAliases.some(a=>wantedNameKeys.has(a)),oracleHit=oid&&wantedOracle.has(oid);if(!nameHit&&!oracleHit)continue;
    const row=JSON.parse(line),card=row.card;if(!card?.name)continue;parsed++;if(card.oracleId)byOracleId.set(String(card.oracleId),card);
    for(const alias of aliasesForRuntimeCard(card)){if(wantedNameKeys.size&&!wantedNameKeys.has(alias))continue;const p=aliasPriority(card,alias);if(!cards.has(alias)||p>Number(priority.get(alias)||-Infinity)){cards.set(alias,card);priority.set(alias,p);}}
  }
  return {header,cards,byOracleId,stats:{scanned,parsed,requestedNames:wantedNames.length,requestedOracleIds:wantedOracle.size}};
}
