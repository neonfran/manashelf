import { readSemanticDb } from "./semantic-db.mjs";
import { sha256Object } from "./provenance.mjs";

export const SEMANTIC_DRIFT_VERSION=1;
function semanticComparable(card){return {schemaVersion:card.schemaVersion,compilerVersion:card.compilerVersion,oracleId:card.oracleId,name:card.name,layout:card.layout,keywords:card.keywords,colorIdentity:card.colorIdentity,faces:card.faces,status:card.status,unsupportedPatterns:card.unsupportedPatterns};}
export function semanticCardHash(card){return sha256Object(semanticComparable(card));}

async function indexDb(path){const map=new Map();for await(const card of readSemanticDb(path))map.set(card.oracleId,{hash:semanticCardHash(card),name:card.name,status:card.status});return map;}
export async function semanticDrift(beforePath,afterPath,{sampleLimit=20}={}){
  const [before,after]=await Promise.all([indexDb(beforePath),indexDb(afterPath)]);const added=[],removed=[],changed=[],unchanged=[];
  for(const [id,a] of after){const b=before.get(id);if(!b)added.push({oracleId:id,name:a.name,status:a.status});else if(a.hash!==b.hash)changed.push({oracleId:id,name:a.name,beforeStatus:b.status,afterStatus:a.status,beforeHash:b.hash,afterHash:a.hash});else unchanged.push(id);}
  for(const [id,b] of before)if(!after.has(id))removed.push({oracleId:id,name:b.name,status:b.status});
  return {schema:"manashelf-semantic-drift",schemaVersion:1,driftVersion:SEMANTIC_DRIFT_VERSION,createdAt:new Date().toISOString(),counts:{before:before.size,after:after.size,added:added.length,removed:removed.length,changed:changed.length,unchanged:unchanged.length},samples:{added:added.slice(0,sampleLimit),removed:removed.slice(0,sampleLimit),changed:changed.slice(0,sampleLimit)}};
}
