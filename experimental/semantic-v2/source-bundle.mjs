import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";

export function semanticCardToRaw(card){
  const faces=(card.faces||[]).map(f=>({
    name:f.name??card.name,
    type_line:f.typeLine??null,
    mana_cost:f.manaCost??"",
    cmc:f.manaValue??0,
    oracle_text:f.oracleText??(f.abilities||[]).map(a=>a.rawText).join("\n"),
    keywords:[],
    colors:null,
    color_indicator:null,
    produced_mana:null
  }));
  const single=faces.length===1?faces[0]:null;
  return {
    oracle_id:card.oracleId,
    id:card.provenance?.scryfallId??null,
    name:card.name,
    layout:card.layout,
    type_line:single?.type_line??null,
    mana_cost:single?.mana_cost??"",
    cmc:single?.cmc??Math.min(...faces.map(f=>Number(f.cmc)||0),0),
    oracle_text:single?.oracle_text??null,
    keywords:card.keywords||[],
    color_identity:card.colorIdentity||[],
    legalities:card.legalities||{},
    card_faces:faces.length>1?faces:null,
    _semanticSource:{schemaVersion:card.schemaVersion,compilerVersion:card.compilerVersion}
  };
}

export async function* streamSemanticCardsFromResultBundle(filePath){
  const raw=fs.createReadStream(filePath);
  const input=filePath.endsWith(".gz")?raw.pipe(zlib.createGunzip()):raw;
  const rl=readline.createInterface({input,crlfDelay:Infinity});
  for await(const line of rl){
    const s=line.trim();if(!s)continue;
    const record=JSON.parse(s);
    if(record.recordType==="semantic_card"&&record.data)yield record.data;
  }
}

export async function* streamRawCardsFromResultBundle(filePath){
  for await(const card of streamSemanticCardsFromResultBundle(filePath))yield semanticCardToRaw(card);
}
