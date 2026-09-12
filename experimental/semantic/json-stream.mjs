import fs from "node:fs";
import readline from "node:readline";
import zlib from "node:zlib";
import { StringDecoder } from "node:string_decoder";

async function isGzip(filePath){
  const fd=await fs.promises.open(filePath,"r");
  try{const buf=Buffer.alloc(2);const {bytesRead}=await fd.read(buf,0,2,0);return bytesRead===2&&buf[0]===0x1f&&buf[1]===0x8b;}
  finally{await fd.close();}
}

async function openInputStream(filePath){
  const raw=fs.createReadStream(filePath);
  if(await isGzip(filePath))return raw.pipe(zlib.createGunzip());
  return raw;
}

async function firstMeaningfulChar(filePath){
  const input=await openInputStream(filePath);
  const decoder=new StringDecoder("utf8");let text="";
  try{
    for await(const chunk of input){
      text+=decoder.write(chunk);
      const first=text.replace(/^\uFEFF/,"").match(/\S/)?.[0];
      if(first){input.destroy();return first;}
      if(text.length>65536)break;
    }
    text+=decoder.end();
    return text.replace(/^\uFEFF/,"").match(/\S/)?.[0]||null;
  }finally{input.destroy();}
}

export async function* streamJsonArray(filePath){
  const stream=await openInputStream(filePath); const decoder=new StringDecoder("utf8");
  let started=false,inString=false,escape=false,depth=0,buf="",recordStarted=false,ended=false;
  const consume=function*(text){
    for(const ch of text){
      if(ended)continue;
      if(!started){if(ch==='['){started=true;}else if(!/\s/.test(ch))throw new Error(`Expected top-level JSON array, got ${JSON.stringify(ch)}`);continue;}
      if(!recordStarted){
        if(/\s|,/.test(ch))continue;
        if(ch===']'){ended=true;continue;}
        if(ch!=='{'&&ch!=='[')throw new Error(`Unsupported top-level JSON array value starting with ${JSON.stringify(ch)}`);
        recordStarted=true;buf=ch;depth=1;inString=false;escape=false;continue;
      }
      buf+=ch;
      if(inString){
        if(escape){escape=false;continue;}
        if(ch==='\\'){escape=true;continue;}
        if(ch==='"')inString=false;
        continue;
      }
      if(ch==='"'){inString=true;continue;}
      if(ch==='{'||ch==='[')depth++;
      else if(ch==='}'||ch===']')depth--;
      if(depth===0){const value=JSON.parse(buf);buf="";recordStarted=false;yield value;}
    }
  };
  for await (const chunk of stream){for(const value of consume(decoder.write(chunk)))yield value;}
  for(const value of consume(decoder.end()))yield value;
  if(recordStarted||depth!==0||inString)throw new Error("Truncated JSON array input");
  if(started&&!ended)throw new Error("Truncated JSON array input: missing closing bracket");
}

export async function* streamJsonLines(filePath){
  const input=await openInputStream(filePath);const rl=readline.createInterface({input,crlfDelay:Infinity});
  let lineNo=0;
  for await (const line of rl){lineNo++;const s=line.replace(/^\uFEFF/,"").trim();if(!s)continue;try{yield JSON.parse(s);}catch(err){throw new Error(`Invalid JSONL at line ${lineNo}: ${err.message}`);}}
}

export async function* streamJsonRecords(filePath){
  const first=await firstMeaningfulChar(filePath);
  if(first==='['){yield* streamJsonArray(filePath);return;}
  if(first==='{'){yield* streamJsonLines(filePath);return;}
  if(first===null)return;
  throw new Error(`Unsupported JSON input: first meaningful character is ${JSON.stringify(first)}`);
}

export const jsonStreamInternals={isGzip,openInputStream,firstMeaningfulChar};
