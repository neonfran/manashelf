import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

export const sha256Buffer=data=>crypto.createHash("sha256").update(data).digest("hex");
export async function sha256File(file){const h=crypto.createHash("sha256"),s=fs.createReadStream(file);for await(const chunk of s)h.update(chunk);return h.digest("hex");}
export function stableJson(value){
  const seen=new WeakSet();
  const walk=v=>{
    if(v===null||typeof v!=="object")return v;
    if(seen.has(v))throw new TypeError("stableJson does not support cycles");seen.add(v);
    if(Array.isArray(v)){const out=v.map(walk);seen.delete(v);return out;}
    const out={};for(const k of Object.keys(v).sort())out[k]=walk(v[k]);seen.delete(v);return out;
  };
  return JSON.stringify(walk(value));
}
export const fingerprint=value=>sha256Buffer(Buffer.from(stableJson(value)));
export async function writeJsonAtomic(file,value,{pretty=true}={}){await fsp.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;await fsp.writeFile(tmp,JSON.stringify(value,null,pretty?2:0));await fsp.rename(tmp,file);return file;}
export async function readJson(file){return JSON.parse(await fsp.readFile(file,"utf8"));}
export async function writeJsonGzipAtomic(file,value){await fsp.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}-${Date.now()}`,raw=Buffer.from(JSON.stringify(value));await fsp.writeFile(tmp,zlib.gzipSync(raw,{level:9,mtime:0}));await fsp.rename(tmp,file);return file;}
export async function readJsonMaybeGzip(file){const raw=await fsp.readFile(file),buf=(raw[0]===0x1f&&raw[1]===0x8b)?zlib.gunzipSync(raw):raw;return JSON.parse(buf.toString("utf8"));}
export async function fileExists(file){try{return (await fsp.stat(file)).isFile();}catch{return false;}}
