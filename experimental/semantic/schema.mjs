export const SEMANTIC_SCHEMA = "manashelf-semantic-card";
export const SEMANTIC_SCHEMA_VERSION = 1;
export const SEMANTIC_COMPILER_VERSION = 4;
export const SEMANTIC_DB_SCHEMA = "manashelf-semantic-db-jsonl";
export const SEMANTIC_DB_SCHEMA_VERSION = 1;
export const SEMANTIC_AUDIT_SCHEMA = "manashelf-semantic-audit";
export const SEMANTIC_AUDIT_SCHEMA_VERSION = 1;

export const COVERAGE_STATUS = Object.freeze({
  SUPPORTED: "supported",
  PARTIAL: "partial",
  GAP: "coverage_gap"
});

export const ADJUDICATION = Object.freeze({
  POSITIVE: "positive",
  NO_EVIDENCE: "no_evidence",
  EXPLICIT_NEGATIVE: "explicit_negative"
});

export const uniq = values => [...new Set((values || []).filter(v => v !== null && v !== undefined && v !== ""))];
export const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function stableObject(value){
  if(Array.isArray(value)) return value.map(stableObject);
  if(value && typeof value === "object"){
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  }
  return value;
}

export function validateSemanticCard(card){
  const errors=[];
  if(!card || typeof card !== "object") return ["record:not_object"];
  if(card.schema !== SEMANTIC_SCHEMA) errors.push("schema:unexpected");
  if(card.schemaVersion !== SEMANTIC_SCHEMA_VERSION) errors.push("schemaVersion:unexpected");
  if(!card.oracleId) errors.push("oracleId:missing");
  if(!Array.isArray(card.faces) || !card.faces.length) errors.push("faces:missing");
  for(const [fi,face] of (card.faces||[]).entries()){
    if(!Array.isArray(face.abilities)) errors.push(`faces.${fi}.abilities:not_array`);
    for(const [ai,ability] of (face.abilities||[]).entries()){
      if(typeof ability.rawText !== "string") errors.push(`faces.${fi}.abilities.${ai}.rawText:missing`);
      if(!Array.isArray(ability.clauses)) errors.push(`faces.${fi}.abilities.${ai}.clauses:not_array`);
      for(const [ci,clause] of (ability.clauses||[]).entries()){
        if(typeof clause.rawText !== "string") errors.push(`faces.${fi}.abilities.${ai}.clauses.${ci}.rawText:missing`);
        if(!COVERAGE_STATUS_SET.has(clause.status)) errors.push(`faces.${fi}.abilities.${ai}.clauses.${ci}.status:invalid`);
      }
    }
  }
  return errors;
}

const COVERAGE_STATUS_SET = new Set(Object.values(COVERAGE_STATUS));
