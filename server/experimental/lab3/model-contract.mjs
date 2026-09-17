import {LAB3_BUILDER_VERSION,LAB3_MANA_MODEL_VERSION} from "./builder.mjs";
import {LAB3_CONTEXT_ENGINE_VERSION} from "./deck-context.mjs";
import {LAB3_THEME_UNDERSTANDING_VERSION} from "./theme-understanding.mjs";
import {LAB3_RUNTIME_INDEX_VERSION} from "./runtime-index.mjs";
import {LAB3_SERVING_RUNTIME_VERSION} from "./runtime-serving.mjs";
import {LAB3_STRESS_VERSION} from "./stress-harness.mjs";
import {SEMANTIC_V2_SCHEMA_VERSION,SEMANTIC_V2_COMPILER_VERSION} from "../semantic-v2/schema.mjs";
import {KNOWLEDGE_SCHEMA_VERSION,THEME_CORPUS_VERSION,THEME_PROFILE_VERSION} from "../knowledge/schema.mjs";
import {THEME_CORPUS_SWEEP_AUDIT_VERSION} from "../knowledge/theme-corpus-sweep-audit.mjs";
import {THEME_EVIDENCE_VERSION} from "../knowledge/theme-evidence.mjs";
import {THEME_EVIDENCE_PLAN_VERSION} from "../knowledge/theme-evidence-plan.mjs";
import {EDHREC_TRAINING_SNAPSHOT_VERSION} from "../knowledge/theme-evidence-fetch.mjs";
import {BUILDER_VNEXT_STATUS,BUILDER_VNEXT_VERSION} from "../vnext/builder.mjs";

export const LAB3_MODEL_CONTRACT_SCHEMA="manashelf-lab3-model-contract";
export const LAB3_MODEL_CONTRACT_VERSION=1;

export function lab3ModelContract(){
  return {
    schema:LAB3_MODEL_CONTRACT_SCHEMA,
    schemaVersion:LAB3_MODEL_CONTRACT_VERSION,
    status:BUILDER_VNEXT_STATUS,
    components:{
      semantic:{runtimeSchemaVersion:SEMANTIC_V2_SCHEMA_VERSION,compilerVersion:SEMANTIC_V2_COMPILER_VERSION},
      runtime:{indexVersion:LAB3_RUNTIME_INDEX_VERSION,servingIndexVersion:LAB3_SERVING_RUNTIME_VERSION,interactiveFullRuntimeMaterialization:false},
      themeUnderstanding:{version:LAB3_THEME_UNDERSTANDING_VERSION,precedence:["semantic_direct","theme_corpus_trusted","semantic_inferred","external_fallback"]},
      themeEvidence:{artifactVersion:THEME_EVIDENCE_VERSION,planVersion:THEME_EVIDENCE_PLAN_VERSION,snapshotVersion:EDHREC_TRAINING_SNAPSHOT_VERSION},
      themeCorpus:{version:THEME_CORPUS_VERSION,profileVersion:THEME_PROFILE_VERSION,sweepAuditVersion:THEME_CORPUS_SWEEP_AUDIT_VERSION},
      knowledge:{schemaVersion:KNOWLEDGE_SCHEMA_VERSION},
      context:{version:LAB3_CONTEXT_ENGINE_VERSION},
      mana:{version:LAB3_MANA_MODEL_VERSION},
      builder:{version:LAB3_BUILDER_VERSION},
      stress:{version:LAB3_STRESS_VERSION},
      candidateBoundary:{version:BUILDER_VNEXT_VERSION,status:BUILDER_VNEXT_STATUS}
    },
    invariants:{
      runtimeOracleParsing:false,
      validationEvidenceMayTrainThemeCorpus:false,
      themeCorpusInstallRequiresSweepPass:true,
      knowledgeShaPinned:true,
      lab2Protected:true
    }
  };
}
