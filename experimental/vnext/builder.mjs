import {buildLab3Deck,LAB3_BUILDER_VERSION,LAB3_MANA_MODEL_VERSION} from "../lab3/builder.mjs";
import {LAB3_CONTEXT_ENGINE_VERSION} from "../lab3/deck-context.mjs";
export const BUILDER_VNEXT_STATUS="candidate";
export const BUILDER_VNEXT_VERSION=1;
export function buildVNextDeck(input={}){const out=buildLab3Deck(input);return {...out,vnext:{version:BUILDER_VNEXT_VERSION,status:BUILDER_VNEXT_STATUS,builderVersion:LAB3_BUILDER_VERSION,manaModelVersion:LAB3_MANA_MODEL_VERSION,contextEngineVersion:LAB3_CONTEXT_ENGINE_VERSION}};}
export function builderVNextStatus(){return {version:BUILDER_VNEXT_VERSION,status:BUILDER_VNEXT_STATUS,builderVersion:LAB3_BUILDER_VERSION,manaModelVersion:LAB3_MANA_MODEL_VERSION,contextEngineVersion:LAB3_CONTEXT_ENGINE_VERSION};}
