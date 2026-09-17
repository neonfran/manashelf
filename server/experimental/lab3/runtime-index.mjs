import fs from "node:fs";
import fsp from "node:fs/promises";
import zlib from "node:zlib";
import path from "node:path";
import { streamSemanticV2Cards } from "../semantic-v2/graph.mjs";
import { deriveRoleViews, ROLE_VIEW_VERSION } from "../semantic-v2/role-views.mjs";
import { deriveDependencyView, DEPENDENCY_VIEW_VERSION } from "../semantic-v2/dependency-view.mjs";
import { deriveThemeView, THEME_VIEW_VERSION } from "../semantic-v2/theme-view.mjs";
import { deriveThemeFeatures, THEME_FEATURE_VIEW_VERSION } from "../semantic-v2/theme-features.mjs";
import { deriveManaView, MANA_VIEW_VERSION } from "../semantic-v2/mana-view.mjs";
import { deriveCastabilityView, CASTABILITY_VIEW_VERSION } from "../semantic-v2/castability-view.mjs";
import { SEMANTIC_V2_SCHEMA, SEMANTIC_V2_SCHEMA_VERSION, SEMANTIC_V2_COMPILER_VERSION } from "../semantic-v2/schema.mjs";

export const LAB3_RUNTIME_INDEX_SCHEMA="manashelf-lab3-runtime-index";
export const LAB3_RUNTIME_INDEX_VERSION=2;

const arr=x=>Array.isArray(x)?x:[];
const FACET_LABELS={artifacts:"Artifacts",enchantments:"Enchantments",lands:"Lands",equipment:"Equipment",auras:"Auras",historic:"Historic",tokens:"Tokens",lifegain:"Lifegain",sacrifice:"Aristocrats",graveyard:"Graveyard",spellslinger:"Spellslinger",clones:"Clones",counters:"Counters",legends:"Legends"};

function compatRoles(roles,cardStatus){
  return Object.fromEntries(Object.entries(roles||{}).map(([name,r])=>[name,{...r,score:Number(r?.potentialScore||0),status:r?.evidence?.[0]?.coverage||cardStatus}]));
}
function compatArchetypes(theme){
  const out={};
  for(const f of arr(theme?.ranked)){
    const label=f.facet.startsWith("kindred:")?`${f.facet.slice(8).replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())} Kindred`:(FACET_LABELS[f.facet]||f.facet.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()));
    out[label]={contract:"theme_view_v1",archetype:label,status:"supported",adjudication:f.strength>0?"positive":"no_evidence",score:Number(f.strength||0),confidence:1,reason:`Theme View facet ${f.facet}`,dependencies:[],dependencyGroups:[],evidence:f.evidence||[],coverageGaps:[]};
  }
  return out;
}
function compactFaces(card){
  return arr(card.faces).map(f=>({id:f.id,index:f.index,name:f.name,typeLine:f.typeLine,cardTypes:f.cardTypes||[],subtypes:f.subtypes||[],manaCost:f.manaCost||"",manaValue:Number(f.manaValue||0),access:f.access||{kind:"default"},coverage:f.coverage}));
}

export function runtimeRecordFromSemanticV2(card){
  if(card?.schema!==SEMANTIC_V2_SCHEMA)throw new Error(`LAB3 runtime v2 requires ${SEMANTIC_V2_SCHEMA}`);
  const roles=deriveRoleViews(card),dependency=deriveDependencyView(card),theme=deriveThemeView(card),themeFeatures=deriveThemeFeatures(card,{roles,dependency,theme}),mana=deriveManaView(card),castability=deriveCastabilityView(card),status=card?.coverage?.status||"coverage_gap";
  const minCast=castability.entries.length?Math.min(...castability.entries.map(x=>Number(x.manaValue||0))):0;
  const compatProduces=[...(dependency.produces||[])];if(card.faces.some(f=>["default","alternative_entry"].includes(f.access?.kind)&&((f.cardTypes||[]).includes("Instant")||(f.cardTypes||[]).includes("Sorcery"))))compatProduces.push("card:instant_sorcery");
  return {
    runtimeSchemaVersion:LAB3_RUNTIME_INDEX_VERSION,semanticSchema:card.schema,semanticSchemaVersion:card.schemaVersion,semanticCompilerVersion:card.compilerVersion,
    oracleId:card.oracleId,name:card.name,layout:card.layout,status,coverage:card.coverage,keywords:card.keywords||[],colorIdentity:card.colorIdentity||[],legalities:card.legalities||{},
    faces:compactFaces(card),optionGroups:card.optionGroups||[],relations:card.relations||[],
    views:{roles,dependency,theme,themeFeatures,mana,castability},
    roles:compatRoles(roles,status),archetypes:compatArchetypes(theme),
    castability:{...castability,minTotalManaCastability:minCast},
    signals:{produces:[...new Set(compatProduces)],needs:dependency.externalNeeds||[],packageNeeds:dependency.packageNeeds||[],environmentNeeds:dependency.environmentNeeds||[],stateNeeds:dependency.stateNeeds||[],facts:[]}
  };
}

// Kept as an alias so existing build-time callers fail only on schema mismatch,
// not on an import rename. This function now accepts Semantic v2 cards only.
export const runtimeRecordFromSemantic=runtimeRecordFromSemanticV2;

export async function buildRuntimeIndex({semanticDbPath,outputPath}){
  await fsp.mkdir(path.dirname(outputPath),{recursive:true});
  const tmp=outputPath+'.tmp',dest=fs.createWriteStream(tmp),gzip=outputPath.endsWith('.gz')?zlib.createGzip({level:6}):null,out=gzip||dest;if(gzip)gzip.pipe(dest);
  const header={recordType:"header",schema:LAB3_RUNTIME_INDEX_SCHEMA,schemaVersion:LAB3_RUNTIME_INDEX_VERSION,semantic:{schema:SEMANTIC_V2_SCHEMA,schemaVersion:SEMANTIC_V2_SCHEMA_VERSION,compilerVersion:SEMANTIC_V2_COMPILER_VERSION},views:{roles:ROLE_VIEW_VERSION,dependency:DEPENDENCY_VIEW_VERSION,theme:THEME_VIEW_VERSION,themeFeatures:THEME_FEATURE_VIEW_VERSION,mana:MANA_VIEW_VERSION,castability:CASTABILITY_VIEW_VERSION},createdAt:new Date().toISOString(),source:path.resolve(semanticDbPath)};
  out.write(JSON.stringify(header)+'\n');let records=0;
  for await(const card of streamSemanticV2Cards(semanticDbPath)){out.write(JSON.stringify({recordType:"card",card:runtimeRecordFromSemanticV2(card)})+'\n');records++;}
  out.end();await new Promise((resolve,reject)=>dest.on('finish',resolve).on('error',reject));
  await fsp.rename(tmp,outputPath);
  return {records,outputPath,bytes:(await fsp.stat(outputPath)).size,header};
}

export { loadRuntimeIndex } from "./runtime-reader.mjs";
