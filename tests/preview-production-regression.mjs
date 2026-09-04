import fs from "node:fs";
import assert from "node:assert/strict";
const server=fs.readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");

// Release must expose a single production preview architecture, not the five-method lab.
for(const leaked of ["previewDiagnostic","PREVIEW_DIAG_METHODS","/api/preview-diagnostic","runPreviewDiagnosticMethod","/api/deck-preview"]){
  assert.ok(!server.includes(leaked) && !app.includes(leaked) && !html.includes(leaked) && !css.includes(leaked),`diagnostic/legacy preview path leaked: ${leaked}`);
}
assert.match(server,/async function resolveDeckPreview\(/,"single preview resolver must exist");
assert.match(server,/const sf=await fetchExactScryfallPreview\(commander\)/,"resolver must use cache/Scryfall fast path first");
assert.match(server,/fetchFullArchidektPayload\(session,id,\{attempts:3\}\)/,"missing Commander must fall back to the full Archidekt deck");
assert.match(server,/detectPremierCommanders\(payload\)/,"fallback must identify the premier Commander from the full payload");
assert.match(server,/discoverCommanderExact\(commander\)/,"fallback must reuse Discover Commander's Scryfall pipeline");
assert.match(server,/const preview=await resolveDeckPreview\(session,deck\.id\)/,"catalog hydration must use the single resolver");
assert.match(app,/deck-catalog\?hydrate=1/,"frontend must use centralized catalog hydration");
console.log("preview production regression test: OK");
