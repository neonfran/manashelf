import { semanticClauses } from "./compiler.mjs";
import { uniq } from "./schema.mjs";
export const RELATIONSHIP_GRAPH_VERSION=1;

export function buildRelationshipGraph(card){
  const nodes=[],edges=[];
  const addNode=(id,type,data={})=>{if(!nodes.some(n=>n.id===id))nodes.push({id,type,...data});};
  const addEdge=(from,to,type,data={})=>edges.push({from,to,type,...data});
  const cardId=`card:${card.oracleId}`;addNode(cardId,"card",{name:card.name});
  for(const {face,ability,clause,embedded} of semanticClauses(card,{includeEmbedded:true})){
    const faceId=`${cardId}:face:${face.index}`;addNode(faceId,"face",{name:face.name});addEdge(cardId,faceId,"has_face");
    const abilityId=`${faceId}:ability:${ability.index}${embedded?":embedded":""}`;addNode(abilityId,embedded?"embedded_ability":"ability",{rawText:ability.rawText});addEdge(faceId,abilityId,embedded?"grants_embedded_ability":"has_ability");
    const clauseIndex=(ability.clauses||[]).indexOf(clause),clauseId=`${abilityId}:clause:${clauseIndex}`;addNode(clauseId,"clause",{action:clause.action,status:clause.status});addEdge(abilityId,clauseId,"has_clause");
    for(const dep of clause.dependencies||[]){const id=`dependency:${dep}`;addNode(id,"dependency",{name:dep});addEdge(clauseId,id,"depends_on");}
    if(clause.beneficiary){const id=`beneficiary:${clause.beneficiary}`;addNode(id,"beneficiary",{name:clause.beneficiary});addEdge(clauseId,id,"benefits");}
    if(clause.sourceZone){const id=`zone:${clause.sourceZone}`;addNode(id,"zone",{name:clause.sourceZone});addEdge(clauseId,id,"from_zone");}
    if(clause.destinationZone){const id=`zone:${clause.destinationZone}`;addNode(id,"zone",{name:clause.destinationZone});addEdge(clauseId,id,"to_zone");}
  }
  return {version:RELATIONSHIP_GRAPH_VERSION,oracleId:card.oracleId,nodes,edges,dependencyKinds:uniq(nodes.filter(n=>n.type==="dependency").map(n=>n.name))};
}
