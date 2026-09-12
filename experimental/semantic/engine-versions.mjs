import { SEMANTIC_SCHEMA_VERSION, SEMANTIC_COMPILER_VERSION, SEMANTIC_DB_SCHEMA_VERSION, SEMANTIC_AUDIT_SCHEMA_VERSION } from "./schema.mjs";
import { ROLE_CONTRACT_VERSION } from "./role-contracts.mjs";
import { ARCHETYPE_CONTRACT_VERSION } from "./archetype-contracts.mjs";
import { RELATIONSHIP_GRAPH_VERSION } from "./relationship-graph.mjs";
import { CASTABILITY_MODEL_VERSION } from "./castability.mjs";
import { SEMANTIC_AUDIT_VERSION } from "./audit.mjs";
import { RULINGS_DB_SCHEMA_VERSION } from "./rulings-db.mjs";
import { CLASSIFICATION_VERSION } from "../../lib/deck-metrics.mjs";
import { sha256Object } from "./provenance.mjs";

export const SOURCE_SNAPSHOT_SCHEMA_VERSION=1;
export const RAW_SEMANTIC_INDEX_VERSION=1;
export const RAW_DELTA_VERSION=1;
export const SEMANTIC_UPDATE_PIPELINE_VERSION=1;

export function semanticDbEngineVersions(){
  return {
    semanticSchemaVersion:SEMANTIC_SCHEMA_VERSION,
    semanticDbSchemaVersion:SEMANTIC_DB_SCHEMA_VERSION,
    compilerVersion:SEMANTIC_COMPILER_VERSION
  };
}

export function analysisEngineVersions(){
  return {
    ...semanticDbEngineVersions(),
    roleContractVersion:ROLE_CONTRACT_VERSION,
    archetypeContractVersion:ARCHETYPE_CONTRACT_VERSION,
    relationshipGraphVersion:RELATIONSHIP_GRAPH_VERSION,
    castabilityModelVersion:CASTABILITY_MODEL_VERSION,
    semanticAuditSchemaVersion:SEMANTIC_AUDIT_SCHEMA_VERSION,
    semanticAuditVersion:SEMANTIC_AUDIT_VERSION,
    rulingsDbSchemaVersion:RULINGS_DB_SCHEMA_VERSION,
    classificationBaselineVersion:CLASSIFICATION_VERSION
  };
}

export function semanticDbEngineFingerprint(){
  return sha256Object({kind:"semantic-db-engine",...semanticDbEngineVersions()});
}

export function analysisEngineFingerprint(){
  return sha256Object({kind:"semantic-analysis-engine",...analysisEngineVersions()});
}
