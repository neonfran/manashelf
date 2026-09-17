import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { stableObject } from "./schema.mjs";

export async function sha256File(filePath){
  const hash=crypto.createHash("sha256");let bytes=0;
  for await (const chunk of fs.createReadStream(filePath)){hash.update(chunk);bytes+=chunk.length;}
  return {sha256:hash.digest("hex"),bytes};
}
export function sha256Object(value){return crypto.createHash("sha256").update(JSON.stringify(stableObject(value))).digest("hex");}
export async function writeJsonAtomic(filePath,value){
  await fs.promises.mkdir(path.dirname(filePath),{recursive:true});
  const tmp=`${filePath}.tmp-${process.pid}`;await fs.promises.writeFile(tmp,JSON.stringify(value,null,2)+"\n");await fs.promises.rename(tmp,filePath);
}
