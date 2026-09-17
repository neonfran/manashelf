import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildRuntimeServingIndex} from "../runtime-serving.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../.."),sourceFile=path.join(root,"data","lab3-runtime-index.jsonl.gz"),outputFile=path.join(root,"data","lab3-runtime-serving.jsonl.gz");
const result=await buildRuntimeServingIndex({sourceFile,outputFile});console.log(JSON.stringify(result,null,2));
