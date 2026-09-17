export const KNOWLEDGE_SCHEMA="manashelf-knowledge-db";
export const KNOWLEDGE_SCHEMA_VERSION=1;
export const THEME_CORPUS_SCHEMA="manashelf-theme-corpus";
export const THEME_CORPUS_VERSION=1;
export const FIELD_QUALITY_REGISTRY_VERSION=1;
export const DECK_QUALITY_VERSION=6;
export const PROMOTION_GATE_VERSION=1;
export const THEME_PROFILE_VERSION=2;
export const DEFAULT_THEME_TRUST_GATE=Object.freeze({minEvidenceCards:12,minSourceCommanders:3,minSourceDecks:30,minHoldoutPositives:3,minHoldoutNegatives:8,minAuc:.65,minPrecisionAtK:.55,minFeatures:3});
export function assertThemeCorpus(corpus){if(corpus?.schema!==THEME_CORPUS_SCHEMA||Number(corpus?.schemaVersion)!==THEME_CORPUS_VERSION)throw new Error("Invalid Theme Corpus schema");if(!Array.isArray(corpus?.themes))throw new Error("Theme Corpus themes must be an array");return corpus;}
export function assertKnowledgeDb(db){if(db?.schema!==KNOWLEDGE_SCHEMA||Number(db?.schemaVersion)!==KNOWLEDGE_SCHEMA_VERSION)throw new Error("Invalid Knowledge DB schema");if(!db?.runtime?.sha256||!db?.themeCorpus?.sha256)throw new Error("Knowledge DB is missing pinned hashes");return db;}
