import { semanticClauses, cardManaProfile } from "./compiler.mjs";
export const CASTABILITY_MODEL_VERSION=1;

export function castabilityRequirement(card,{satisfiedDependencies=[]}={}){
  const profile=cardManaProfile(card),satisfied=new Set(satisfiedDependencies||[]);
  const faceRequirements=(card.faces||[]).map((face,index)=>{
    const base=profile.faces[index]?.minimumMana||0;
    const discounts=[];
    for(const {clause} of semanticClauses({...card,faces:[face]})){
      if(clause.action!=="reduce_cost"||clause.costReductionScope!=="self_spell")continue;
      const deps=clause.dependencies||[],ok=deps.every(d=>satisfied.has(d));
      const raw=String(clause.magnitude?.reduction||"");const n=Number(raw.replace(/[^0-9]/g,""))||0;
      discounts.push({amount:n,dependencies:deps,satisfied:ok});
    }
    const reduction=discounts.filter(d=>d.satisfied).reduce((n,d)=>n+d.amount,0);
    return {face:index,baseTotalMana:base,effectiveTotalMana:Math.max(0,base-reduction),coloredPips:profile.faces[index]?.coloredPips||0,colorReliabilityRequirement:profile.faces[index]?.coloredPips||0,totalManaCastabilityRequirement:Math.max(0,base-reduction),discounts};
  });
  return {version:CASTABILITY_MODEL_VERSION,oracleId:card.oracleId,faces:faceRequirements,minTotalManaCastability:faceRequirements.length?Math.min(...faceRequirements.map(x=>x.effectiveTotalMana)):0};
}
