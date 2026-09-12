import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { sha256File, writeJsonAtomic } from "./provenance.mjs";

export const SCRYFALL_BULK_API="https://api.scryfall.com/bulk-data";
export const SCRYFALL_USER_AGENT="ManaShelf-LAB3-SemanticHarness/1.0";

const headers={"User-Agent":SCRYFALL_USER_AGENT,"Accept":"application/json;q=0.9,*/*;q=0.8"};

function normalizeDefinition(raw){
  if(!raw||typeof raw!=="object")throw new Error("Invalid Scryfall bulk definition");
  const type=String(raw.type||"").trim();
  const updatedAt=raw.updated_at||raw.updatedAt||null;
  const jsonlDownloadUri=raw.jsonl_download_uri||raw.jsonlDownloadUri||null;
  const downloadUri=raw.download_uri||raw.downloadUri||null;
  if(!type||!updatedAt||(!jsonlDownloadUri&&!downloadUri))throw new Error(`Incomplete Scryfall bulk definition for ${type||"unknown"}`);
  return {
    object:raw.object||"bulk_data",id:raw.id||null,type,name:raw.name||type,description:raw.description||null,
    updatedAt,uri:raw.uri||null,size:Number(raw.size||0)||null,compressedSize:Number(raw.compressed_size||0)||null,
    contentType:raw.content_type||null,contentEncoding:raw.content_encoding||null,jsonlDownloadUri,downloadUri,
    preferredDownloadUri:jsonlDownloadUri||downloadUri,
    preferredFormat:jsonlDownloadUri?"jsonl-gzip":"json"
  };
}

export async function fetchScryfallBulkDefinitions({types=["oracle_cards","rulings"],fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=="function")throw new Error("fetch is unavailable in this Node runtime");
  const res=await fetchImpl(SCRYFALL_BULK_API,{headers,redirect:"follow"});
  if(!res.ok)throw new Error(`Scryfall bulk metadata HTTP ${res.status}`);
  const body=await res.json();
  const list=Array.isArray(body?.data)?body.data:Array.isArray(body)?body:[];
  const byType=new Map(list.map(x=>[String(x?.type||""),normalizeDefinition(x)]));
  const out={};
  for(const type of types){if(!byType.has(type))throw new Error(`Scryfall bulk metadata missing type ${type}`);out[type]=byType.get(type);}
  return {fetchedAt:new Date().toISOString(),api:SCRYFALL_BULK_API,definitions:out};
}

function suffixFor(def){
  try{
    const pathname=new URL(def.preferredDownloadUri).pathname;
    if(pathname.endsWith(".jsonl.gz"))return ".jsonl.gz";
    if(pathname.endsWith(".json.gz"))return ".json.gz";
    if(pathname.endsWith(".jsonl"))return ".jsonl";
    if(pathname.endsWith(".json"))return ".json";
  }catch{}
  return def.preferredFormat==="jsonl-gzip"?".jsonl.gz":".json";
}

export async function downloadScryfallBulkDefinition(definition,destinationDir,{fetchImpl=globalThis.fetch,fileBase=null}={}){
  const def=normalizeDefinition(definition);
  if(typeof fetchImpl!=="function")throw new Error("fetch is unavailable in this Node runtime");
  await fs.promises.mkdir(destinationDir,{recursive:true});
  const finalPath=path.join(destinationDir,`${fileBase||def.type}${suffixFor(def)}`),tmpPath=`${finalPath}.part-${process.pid}`;
  const res=await fetchImpl(def.preferredDownloadUri,{headers:{...headers,"Accept":"application/gzip,application/x-gzip,application/json,text/plain;q=0.8,*/*;q=0.5"},redirect:"follow"});
  if(!res.ok)throw new Error(`Scryfall ${def.type} download HTTP ${res.status}`);
  if(!res.body)throw new Error(`Scryfall ${def.type} download returned no body`);
  try{
    await pipeline(Readable.fromWeb(res.body),fs.createWriteStream(tmpPath));
    await fs.promises.rename(tmpPath,finalPath);
  }catch(err){await fs.promises.rm(tmpPath,{force:true});throw err;}
  const meta=await sha256File(finalPath);
  return {type:def.type,path:finalPath,sha256:meta.sha256,bytes:meta.bytes,updatedAt:def.updatedAt,downloadUri:def.preferredDownloadUri,format:def.preferredFormat};
}

export async function writeBulkMetadataSnapshot(filePath,metadata){await writeJsonAtomic(filePath,{schema:"manashelf-scryfall-bulk-metadata",schemaVersion:1,...metadata});}
export const scryfallBulkInternals={normalizeDefinition,suffixFor};
