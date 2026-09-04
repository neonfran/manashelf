import fs from "node:fs";
const src=fs.readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
const apiStart=src.indexOf("async function api(req,res,p){");
const apiHead=src.slice(apiStart,apiStart+600);
if(!/const\s+u\s*=\s*new URL\(req\.url/.test(apiHead)){
  console.error("Query route regression failed: api() must parse req.url before routes use u.searchParams");
  process.exit(1);
}
for(const route of ["/api/deck-catalog","/api/commanders","/api/collection/lookup"]){
  const idx=src.indexOf(`p==="${route}"`);
  if(idx<0){console.error(`Query route regression failed: missing ${route}`);process.exit(1)}
  const block=src.slice(idx,idx+900);
  if(!block.includes("u.searchParams")){console.error(`Query route regression failed: ${route} no longer exercises query parsing`);process.exit(1)}
}
console.log("query route regression test: OK");
