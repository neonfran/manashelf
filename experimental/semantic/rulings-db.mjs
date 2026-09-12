import fs from "node:fs";
import path from "node:path";
import { streamJsonRecords } from "./json-stream.mjs";
import { sha256File, writeJsonAtomic } from "./provenance.mjs";
export const RULINGS_DB_SCHEMA="manashelf-rulings-db-jsonl";
export const RULINGS_DB_SCHEMA_VERSION=1;
export async function buildRulingsDb({inputPath,outputPath,manifestPath=`${outputPath}.manifest.json`,source="scryfall-rulings",inputUpdatedAt=null}){
  await fs.promises.mkdir(path.dirname(outputPath),{recursive:true});
  const input=await sha256File(inputPath),out=fs.createWriteStream(outputPath,{encoding:"utf8"});let count=0,missingOracleId=0;
  out.write(JSON.stringify({recordType:"header",schema:RULINGS_DB_SCHEMA,schemaVersion:RULINGS_DB_SCHEMA_VERSION,source,inputSha256:input.sha256,inputUpdatedAt,createdAt:new Date().toISOString()})+"\n");
  for await(const raw of streamJsonRecords(inputPath)){
    const oracleId=String(raw.oracle_id||raw.oracleId||"").trim();if(!oracleId){missingOracleId++;continue;}
    const record={recordType:"ruling",oracleId,publishedAt:raw.published_at||null,source:raw.source||null,comment:String(raw.comment||"")};
    if(!out.write(JSON.stringify(record)+"\n"))await new Promise(resolve=>out.once("drain",resolve));count++;
  }
  await new Promise((resolve,reject)=>{out.end(resolve);out.on("error",reject);});const output=await sha256File(outputPath);
  const manifest={schema:"manashelf-rulings-manifest",schemaVersion:1,source,input:{path:inputPath,sha256:input.sha256,bytes:input.bytes,updatedAt:inputUpdatedAt},output:{path:outputPath,sha256:output.sha256,bytes:output.bytes,records:count},missingOracleId,createdAt:new Date().toISOString()};
  await writeJsonAtomic(manifestPath,manifest);return manifest;
}
