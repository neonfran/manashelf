import path from "node:path";
import fs from "node:fs/promises";
import {loadKnowledgeDb,validateKnowledgeDb} from "./knowledge-db.mjs";
export class KnowledgeCatalog{
  constructor({projectRoot=process.cwd(),knowledgePath=null,runtimePath=null,themeCorpusPath=null}={}){this.projectRoot=projectRoot;this.knowledgePath=knowledgePath||path.join(projectRoot,"data","lab3-knowledge-db.json");this.runtimePath=runtimePath||path.join(projectRoot,"data","lab3-runtime-index.jsonl.gz");this.themeCorpusPath=themeCorpusPath||path.join(projectRoot,"data","lab3-theme-corpus.json.gz");this.loaded=null;this.integrity=null;this.mtime=0;}
  async ensureLoaded(){const st=await fs.stat(this.knowledgePath);if(this.loaded&&this.mtime===st.mtimeMs)return this.loaded;this.loaded=await loadKnowledgeDb(this.knowledgePath);this.integrity=await validateKnowledgeDb(this.loaded,{runtimePath:this.runtimePath,themeCorpusPath:this.themeCorpusPath});this.mtime=st.mtimeMs;if(!this.integrity.ok)throw new Error("Knowledge integrity mismatch: Runtime and Theme Corpus do not match the pinned snapshot");return this.loaded;}
  async status(){try{const db=await this.ensureLoaded();return {available:true,integrity:"PASS",schema:db.schema,schemaVersion:db.schemaVersion,runtime:db.runtime,themeCorpus:db.themeCorpus,metadata:db.metadata||{}};}catch(e){return {available:false,integrity:"FAIL",error:String(e.message||e),path:this.knowledgePath};}}
}
