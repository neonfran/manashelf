import fs from "node:fs";
import assert from "node:assert/strict";
const app=fs.readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");
const server=fs.readFileSync(new URL("../server.mjs",import.meta.url),"utf8");

for(const phrase of ["ADMINISTRAR CACHÉ · PROVISORIO","Se mantiene este flujo porque aporta algo distinto","Las inclusiones sueltas de Lab se retiraron","Heurísticas de baja confianza / debug","DIAGNÓSTICO TEMPORAL","Previews de Commander · 5 métodos"]){
  assert.ok(!app.includes(phrase)&&!html.includes(phrase),`internal copy leaked into UI: ${phrase}`);
}
assert.match(html,/id="labOpenDeckLink"/,"LAB selected deck must expose Archidekt link");
assert.match(html,/id="labExportDeckBtn"/,"LAB selected deck must expose deck export");
assert.match(server,/commanderImage:primaryCommanderImage\.normal/,"deck detail must include Commander image");
assert.match(server,/negativeFresh=Boolean\(c\.notFound\)/,"null Scryfall image cache must be recoverable");
assert.match(app,/class="segmented-fill"><b style="width:\$\{localFill\}%/,"segmented bars must use child width fills");
assert.match(html,/value="type:desc"/,"deck list must expose descending sort");
assert.match(css,/\.ribbon-tabs\.floating\{/,"Improve tabs must have sticky mode");
assert.match(css,/\.metrics-confidence-pill,[\s\S]*align-items:center!important/,"confidence pills must center their content");
assert.match(server,/commander:deck\.commander\|\|null,cards/,"deck cache must persist Commander metadata");
assert.ok(!app.includes("new IntersectionObserver"),"deck preview rendering must not depend on IntersectionObserver");
assert.match(server,/deckCacheSavePromise/,"deck cache writes must be serialized");
assert.match(server,/Math\.random\(\)\.toString\(16\)/,"JSON cache writes must use unique temp files");
assert.match(app,/PRIVATE COLLECTION/,"private badge must use explicit collection label");
assert.match(app,/PUBLIC COLLECTION/,"public badge must use explicit collection label");
assert.ok(html.indexOf('id="improveTabs"')<html.indexOf('id="improveFlow"'),"Improve ribbon must sit immediately above Improve flow");
assert.match(css,/\.ribbon-tabs\.floating\{[\s\S]*position:sticky!important/,"Improve ribbon must use stable sticky navigation");
assert.match(html,/id="labTabs"/,"LAB must expose Deck Health section navigation");
assert.match(html,/data-lab-tab="rules">Estructura<\/button>/,"LAB structural tab must use the clearer Estructura label");
assert.match(app,/<h3>Estructura del mazo<\/h3>/,"LAB structural section must use the clearer title");
assert.match(app,/function syncFloatingNavGeometry\(\)/,"floating ribbons must use measured collision geometry");
assert.match(app,/mainRect\.right-r\.left\+12/,"collision geometry must reserve the actual Deck List overlap");
assert.match(css,/#improveTabs\.ribbon-tabs\.floating,[\s\S]*#labTabs\.ribbon-tabs\.floating\{[\s\S]*--deck-list-reserve/,"both floating ribbons must consume the measured Deck List reserve");
assert.ok(!css.includes('top:132px!important'),"obsolete fixed vertical Deck List offset must be removed");
assert.match(app,/function switchTheme\(theme\)/,"theme toggle must use the enhanced transition path");
assert.match(css,/@keyframes themeNeonSweep/,"theme transition must include the neon sweep");
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,"theme transition must respect reduced motion");
assert.match(css,/body\.improve-with-inspector main,[\s\S]*padding-right:0!important/,"Improve must not widen the page when the inspector opens");
assert.match(app,/if\(!row\.commander&&keep\.commander\)current\.commander=keep\.commander/,"catalog refresh must not erase a resolved Commander");
assert.match(html,/ManaShelf v2\.5\.26-beta/,"HTML title must expose current beta");
assert.match(server,/const APP_VERSION = "2\.5\.26-beta"/,"server user agent/version must be current");
assert.match(server,/\.listen\(PORT,"127\.0\.0\.1"/,"local server must bind only to loopback");
for(const launcher of ["INICIAR-WINDOWS.bat","Abrir ManaShelf.bat"]){
  const src=fs.readFileSync(new URL(`../${launcher}`,import.meta.url),"utf8");
  assert.match(src,/Get-NetTCPConnection/,`${launcher} must find a free port`);
  assert.match(src,/build=2\.5\.26-beta/,`${launcher} must open the current build`);
  assert.ok(!src.includes('start "" http://127.0.0.1:3000'),`${launcher} must not hard-code port 3000`);
}
console.log("release regression test: OK");
