import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";
import { cardIdentityKey, cardNameAliases } from "../../lib/card-identity.mjs";

export const LAB3_RUNTIME_READER_VERSION=2;
const NON_PLAYABLE_LAYOUTS=new Set(["art_series","token","double_faced_token","emblem","planar","scheme","vanguard"]);
function readStream(file){const rs=fs.createReadStream(file);return file.endsWith('.gz')?rs.pipe(zlib.createGunzip()):rs;}
export function isDeckPlayableCard(card){return Boolean(card?.name)&&!NON_PLAYABLE_LAYOUTS.has(String(card.layout||"").toLowerCase());}
function aliasPriority(card,alias){
  const exact=cardIdentityKey(card?.name)===alias;
  const legal=card?.legalities?.commander==="legal";
  const playable=isDeckPlayableCard(card);
  // Exact playable Commander-legal oracle cards must always beat aliases from
  // Art Series/tokens and face aliases. Non-playable records retain only their
  // exact full-name lookup so they can be explicitly rejected by deck building.
  return (legal?1000:0)+(playable?300:0)+(exact?80:0)+(String(card?.layout||"")==="normal"?10:0);
}

export async function loadRuntimeIndex(file,{names=null}={}){
  const wanted=names?new Set(names.flatMap(cardNameAliases).map(cardIdentityKey)):null,map=new Map(),priority=new Map(),byOracleId=new Map();let header=null;
  const rl=readline.createInterface({input:readStream(file),crlfDelay:Infinity});
  for await(const line of rl){
    if(!line.trim())continue;const row=JSON.parse(line);if(row.recordType==='header'){header=row;continue;}const c=row.card;if(!c?.name)continue;
    const playable=isDeckPlayableCard(c),aliases=playable?cardNameAliases(c.name):[cardIdentityKey(c.name)];
    if(c.oracleId)byOracleId.set(String(c.oracleId),c);
    if(wanted&&!aliases.some(a=>wanted.has(cardIdentityKey(a))))continue;
    for(const a0 of aliases){const a=cardIdentityKey(a0),p=aliasPriority(c,a);if(!a)continue;if(!map.has(a)||p>Number(priority.get(a)||-Infinity)){map.set(a,c);priority.set(a,p);}}
  }
  return {header,cards:map,byOracleId,get(name){return map.get(cardIdentityKey(name))||null;},getByOracleId(oracleId){return byOracleId.get(String(oracleId||""))||null;}};
}
