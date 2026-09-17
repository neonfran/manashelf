import { validateSemanticCard, ADJUDICATION, COVERAGE_STATUS, SEMANTIC_AUDIT_SCHEMA, SEMANTIC_AUDIT_SCHEMA_VERSION } from "./schema.mjs";
import { semanticClauses } from "./compiler.mjs";
import { evaluateAllRoles, ROLE_CONTRACTS } from "./role-contracts.mjs";
import { evaluateAllArchetypes, ARCHETYPE_CONTRACTS } from "./archetype-contracts.mjs";
import { classifyCard, CLASSIFICATION_VERSION } from "../../lib/deck-metrics.mjs";
import { unknownPatternFingerprint } from "./unknown-cluster.mjs";

export const SEMANTIC_AUDIT_VERSION=2;
const inc=(obj,key,n=1)=>{const k=String(key??"null");obj[k]=(obj[k]||0)+n;};
const bumpContract=(bucket,r)=>{inc(bucket,"total");inc(bucket,`status:${r.status}`);inc(bucket,`adjudication:${r.adjudication}`);};
const roleIds=legacy=>(legacy?.roles||[]).map(r=>r.id||r);

function legacyAdapter(card){
  const oracleText=(card.faces||[]).map(f=>f.oracleText).filter(Boolean).join("\n");
  const typeLine=(card.faces||[]).map(f=>f.typeLine).filter(Boolean).join(" // ");
  const manaCost=(card.faces||[]).map(f=>f.manaCost).filter(Boolean).join(" // ");
  const cmc=Math.max(0,...(card.faces||[]).map(f=>Number(f.manaValue||0)));
  return {name:card.name,meta:{oracleText,typeLine,manaCost,cmc,colorIdentity:card.colorIdentity||[],keywords:card.keywords||[]}};
}

const resolvedNegative=r=>r?.adjudication===ADJUDICATION.EXPLICIT_NEGATIVE&&r?.status===COVERAGE_STATUS.SUPPORTED;
const pendingAgainstLegacy=(legacyHasRole,r)=>legacyHasRole && !(r?.adjudication===ADJUDICATION.POSITIVE) && r?.status!==COVERAGE_STATUS.SUPPORTED;

function anomalyFamilies(card,roles,legacy){
  const out=[],pending=[];
  const clauses=semanticClauses(card,{includeEmbedded:false}).map(x=>x.clause),legacyRoles=new Set(roleIds(legacy));

  const selfDiscount=clauses.some(c=>c.action==="reduce_cost"&&c.costReductionScope==="self_spell"&&c.status!==COVERAGE_STATUS.GAP);
  if(selfDiscount&&legacyRoles.has("ramp")){
    if(resolvedNegative(roles.ramp))out.push("C7_SELF_COST_REDUCTION_AS_RAMP");
    else if(pendingAgainstLegacy(true,roles.ramp))pending.push("C7_SELF_COST_REDUCTION_AS_RAMP");
  }

  const foreignCopy=clauses.some(c=>c.action==="copy_spell"&&!["you","source_controller"].includes(c.actor)&&c.status!==COVERAGE_STATUS.GAP);
  if(foreignCopy&&legacyRoles.has("spell_copy")){
    if(resolvedNegative(roles.spell_copy))out.push("C7_COPY_AGENCY_COLLAPSE");
    else if(pendingAgainstLegacy(true,roles.spell_copy))pending.push("C7_COPY_AGENCY_COLLAPSE");
  }

  const ownGraveMovement=clauses.some(c=>c.sourceZone==="graveyard"&&c.owner==="you"&&["return","exile","put"].includes(c.action)&&c.status!==COVERAGE_STATUS.GAP);
  if(ownGraveMovement&&(legacyRoles.has("removal")||legacyRoles.has("graveyard_hate"))){
    if(resolvedNegative(roles.removal))out.push("C7_OWN_GRAVEYARD_AS_REMOVAL");
    else if(pendingAgainstLegacy(true,roles.removal))pending.push("C7_OWN_GRAVEYARD_AS_REMOVAL");
  }

  const landMana=clauses.some(c=>c.action==="add_mana"&&c.details?.mana?.isLand&&c.status!==COVERAGE_STATUS.GAP);
  if(landMana&&legacyRoles.has("ramp")){
    if(resolvedNegative(roles.ramp))out.push("C7_LAND_MANA_AS_RAMP");
    else if(pendingAgainstLegacy(true,roles.ramp))pending.push("C7_LAND_MANA_AS_RAMP");
  }

  const neutralFilter=clauses.some(c=>c.action==="add_mana"&&c.details?.mana?.reason==="mana_filter_or_nonpositive_activation"&&c.status!==COVERAGE_STATUS.GAP);
  if(neutralFilter&&legacyRoles.has("ramp")){
    if(resolvedNegative(roles.ramp))out.push("C7_FILTER_AS_RAMP");
    else if(pendingAgainstLegacy(true,roles.ramp))pending.push("C7_FILTER_AS_RAMP");
  }
  return {out,pending};
}

function structuralContradictions(card,roles){
  const out=[];
  const rampEvidence=roles.ramp?.evidence||[];
  if(roles.ramp?.adjudication===ADJUDICATION.POSITIVE&&!rampEvidence.some(e=>e.action==="put_land_battlefield"||e.action==="additional_land"||(e.action==="add_mana"&&e.details?.mana?.structuralAcceleration)||e.action==="reduce_cost"))out.push("RAMP_WITHOUT_ACCELERATION_EVIDENCE");
  if(roles.spell_copy?.adjudication===ADJUDICATION.POSITIVE&&!(roles.spell_copy.evidence||[]).some(e=>e.action==="copy_spell"&&["you","source_controller"].includes(e.actor)))out.push("SPELL_COPY_WITHOUT_SELF_AGENCY");
  if(roles.removal?.adjudication===ADJUDICATION.POSITIVE&&!(roles.removal.evidence||[]).some(e=>["destroy","exile","return","tuck","destroy_referenced","exile_referenced","tuck_referenced","sacrifice"].includes(e.action)&&e.polarity==="hostile_capable"))out.push("REMOVAL_WITHOUT_HOSTILE_CAPABILITY");
  if(roles.protection?.adjudication===ADJUDICATION.POSITIVE&&!(roles.protection.evidence||[]).some(e=>["phase_out","prevent_damage","redirect_damage","regenerate","uncounterable","grant_keyword","targeting_restriction"].includes(e.action)))out.push("PROTECTION_WITHOUT_PROTECTIVE_EVIDENCE");
  return out;
}

export async function auditCards(records,{archetypes=ARCHETYPE_CONTRACTS,compareClassification7=true,sampleLimit=5}={}){
  const report={schema:SEMANTIC_AUDIT_SCHEMA,schemaVersion:SEMANTIC_AUDIT_SCHEMA_VERSION,auditVersion:SEMANTIC_AUDIT_VERSION,createdAt:new Date().toISOString(),compareClassification7,classificationVersion:compareClassification7?CLASSIFICATION_VERSION:null,
    cards:{total:0,byStatus:{},schemaErrors:0},clauses:{total:0,byStatus:{}},unsupportedPatterns:{},unknownPatternClusters:{},byAction:{},byTrigger:{},byKeyword:{},byLayout:{},byCardType:{},roles:{},archetypes:{},anomalyFamilies:{},comparisonPendingFamilies:{},structuralContradictions:{},samples:{anomalies:{},comparisonPending:{},coverageGaps:{}}};
  for(const role of ROLE_CONTRACTS)report.roles[role]={};for(const a of archetypes)report.archetypes[a]={};
  for await(const card of records){
    report.cards.total++;inc(report.cards.byStatus,card.status);inc(report.byLayout,card.layout||"unknown");for(const k of card.keywords||[])inc(report.byKeyword,k);
    const errors=validateSemanticCard(card);if(errors.length)report.cards.schemaErrors++;
    for(const face of card.faces||[])for(const type of face.cardTypes||[])inc(report.byCardType,type);
    for(const {clause,embedded} of semanticClauses(card,{includeEmbedded:true})){
      report.clauses.total++;inc(report.clauses.byStatus,clause.status);inc(report.byAction,clause.action||"unknown");inc(report.byTrigger,clause.trigger||"unknown");
      for(const p of clause.unsupportedPatterns||[]){inc(report.unsupportedPatterns,p);if((report.samples.coverageGaps[p]||[]).length<sampleLimit)(report.samples.coverageGaps[p]??=[]).push({oracleId:card.oracleId,name:card.name,embedded,rawText:clause.rawText});}
      if((clause.unsupportedPatterns||[]).length)inc(report.unknownPatternClusters,unknownPatternFingerprint(clause));
    }
    const roles=evaluateAllRoles(card),arch=evaluateAllArchetypes(card,archetypes);
    for(const [name,r] of Object.entries(roles))bumpContract(report.roles[name],r);
    for(const [name,r] of Object.entries(arch))bumpContract(report.archetypes[name],r);
    const legacy=compareClassification7?classifyCard(legacyAdapter(card)):null;
    const fam=anomalyFamilies(card,roles,legacy);
    for(const family of fam.out){inc(report.anomalyFamilies,family);if((report.samples.anomalies[family]||[]).length<sampleLimit)(report.samples.anomalies[family]??=[]).push({oracleId:card.oracleId,name:card.name});}
    for(const family of fam.pending){inc(report.comparisonPendingFamilies,family);if((report.samples.comparisonPending[family]||[]).length<sampleLimit)(report.samples.comparisonPending[family]??=[]).push({oracleId:card.oracleId,name:card.name});}
    for(const family of structuralContradictions(card,roles))inc(report.structuralContradictions,family);
  }
  report.coverage={highConfidence:report.cards.byStatus[COVERAGE_STATUS.SUPPORTED]||0,partial:report.cards.byStatus[COVERAGE_STATUS.PARTIAL]||0,unknown:report.cards.byStatus[COVERAGE_STATUS.GAP]||0};
  return report;
}
