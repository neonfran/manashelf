import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {readJsonMaybeGzip,sha256File} from "./io.mjs";
import {assertThemeCorpus} from "./schema.mjs";
import {trustedThemeModel} from "./theme-corpus.mjs";
export class ThemeCorpusCatalog{
  constructor({projectRoot=process.cwd(),paths=null}={}){this.paths=paths||[process.env.MANASHELF_THEME_CORPUS,path.join(os.homedir(),".manashelf","semantic-lab3","lab3-theme-corpus.json.gz"),path.join(projectRoot,"data","lab3-theme-corpus.json.gz")].filter(Boolean);this.loaded=null;this.loadedPath=null;this.loadedMtime=0;this.sha256=null;}
  async resolve(){for(const p of this.paths){try{const stat=await fs.stat(p);if(stat.isFile())return {path:p,stat};}catch{}}return null;}
  async ensureLoaded(){const f=await this.resolve();if(!f)throw new Error(`Theme Corpus not found. Looked in: ${this.paths.join(", ")}`);if(this.loaded&&this.loadedPath===f.path&&this.loadedMtime===f.stat.mtimeMs)return this.loaded;this.loaded=assertThemeCorpus(await readJsonMaybeGzip(f.path));this.loadedPath=f.path;this.loadedMtime=f.stat.mtimeMs;this.sha256=await sha256File(f.path);return this.loaded;}
  async getTrustedModel(theme){const corpus=await this.ensureLoaded();return trustedThemeModel(corpus,theme);}
  async status(){const f=await this.resolve();if(!f)return {available:false,path:null,loaded:false,trustedThemes:0,totalThemes:0,sha256:null};let corpus=this.loaded,sha=this.sha256;if(!corpus){try{corpus=assertThemeCorpus(await readJsonMaybeGzip(f.path));sha=await sha256File(f.path);}catch(e){return {available:true,path:f.path,loaded:false,valid:false,error:String(e.message||e),sha256:null};}}return {available:true,path:f.path,bytes:f.stat.size,loaded:Boolean(this.loaded),valid:true,sha256:sha,totalThemes:corpus.themes.length,trustedThemes:corpus.themes.filter(x=>x.trusted).length,rejectedThemes:corpus.themes.filter(x=>!x.trusted).length,schemaVersion:corpus.schemaVersion,seed:corpus.seed,audit:corpus.audit?{trustRate:corpus.audit.trustRate,rejectionReasons:corpus.audit.rejectionReasons}:null};}
}
