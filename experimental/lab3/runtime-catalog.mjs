import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadRuntimeIndex } from "./runtime-reader.mjs";

export const LAB3_RUNTIME_CATALOG_VERSION=1;

export function defaultLab3IndexCandidates(projectRoot=process.cwd()){
  return [
    process.env.MANASHELF_LAB3_INDEX,
    path.join(os.homedir(),".manashelf","semantic-lab3","lab3-runtime-index.jsonl.gz"),
    path.join(projectRoot,"data","lab3-runtime-index.jsonl.gz")
  ].filter(Boolean);
}

async function firstExisting(paths){for(const p of paths){try{const st=await fs.stat(p);if(st.isFile())return {path:p,stat:st};}catch{}}return null;}

export class Lab3RuntimeCatalog{
  constructor({projectRoot=process.cwd(),paths=null}={}){this.projectRoot=projectRoot;this.paths=paths||defaultLab3IndexCandidates(projectRoot);this.loaded=null;this.loadedPath=null;this.loadedMtime=0;}
  async resolve(){return firstExisting(this.paths);}
  async status(){const found=await this.resolve();return {version:LAB3_RUNTIME_CATALOG_VERSION,available:Boolean(found),path:found?.path||null,bytes:found?.stat?.size||0,loaded:Boolean(this.loaded),loadedCards:this.loaded?.cards?.size||0,loadedOracleCards:this.loaded?.byOracleId?.size||0,header:this.loaded?.header||null,candidates:this.paths};}
  async ensureLoaded(){const found=await this.resolve();if(!found)throw new Error(`LAB3 semantic runtime index not found. Looked in: ${this.paths.join(", ")}`);if(this.loaded&&this.loadedPath===found.path&&this.loadedMtime===found.stat.mtimeMs)return this.loaded;this.loaded=await loadRuntimeIndex(found.path);this.loadedPath=found.path;this.loadedMtime=found.stat.mtimeMs;return this.loaded;}
  async get(name){const idx=await this.ensureLoaded();return idx.get(name);}
  async getByOracleId(oracleId){const idx=await this.ensureLoaded();return idx.getByOracleId(oracleId);}
  async getMany(names){const idx=await this.ensureLoaded();const out=new Map();for(const name of names){const card=idx.get(name);if(card)out.set(name,card);}return out;}
  async getManyOracleIds(oracleIds){const idx=await this.ensureLoaded();const out=new Map();for(const oracleId of oracleIds){const card=idx.getByOracleId(oracleId);if(card)out.set(String(oracleId),card);}return out;}
}
