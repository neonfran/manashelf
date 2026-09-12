import { sha256Object } from "./provenance.mjs";

const cleanFace=(face={})=>({
  name:face.name??null,
  type_line:face.type_line??null,
  mana_cost:face.mana_cost??null,
  cmc:face.cmc??null,
  oracle_text:face.oracle_text??null,
  keywords:Array.isArray(face.keywords)?face.keywords:null,
  colors:Array.isArray(face.colors)?face.colors:null,
  color_indicator:Array.isArray(face.color_indicator)?face.color_indicator:null,
  produced_mana:Array.isArray(face.produced_mana)?face.produced_mana:null
});

/**
 * Projection of a Scryfall card containing only fields that can affect the
 * semantic model or Commander legality. Prices, image URIs, set/collector
 * metadata, related URIs, etc. intentionally do not invalidate semantics.
 */
export function semanticInputProjection(raw={}){
  return {
    oracle_id:raw.oracle_id??raw.oracleId??null,
    name:raw.name??null,
    layout:raw.layout??null,
    type_line:raw.type_line??null,
    mana_cost:raw.mana_cost??null,
    cmc:raw.cmc??null,
    oracle_text:raw.oracle_text??null,
    keywords:Array.isArray(raw.keywords)?raw.keywords:null,
    colors:Array.isArray(raw.colors)?raw.colors:null,
    color_identity:Array.isArray(raw.color_identity)?raw.color_identity:(Array.isArray(raw.colorIdentity)?raw.colorIdentity:null),
    color_indicator:Array.isArray(raw.color_indicator)?raw.color_indicator:null,
    produced_mana:Array.isArray(raw.produced_mana)?raw.produced_mana:null,
    legalities:raw.legalities??null,
    card_faces:Array.isArray(raw.card_faces)?raw.card_faces.map(cleanFace):null
  };
}

export function semanticInputHash(raw){return sha256Object(semanticInputProjection(raw));}
export function rawRecordHash(raw){return sha256Object(raw);}
