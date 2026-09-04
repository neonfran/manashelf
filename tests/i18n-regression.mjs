import fs from "node:fs";
import assert from "node:assert/strict";
const src=fs.readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
assert.match(src,/uiObserver\?\.disconnect\(\)/,"translator must disconnect its observer before DOM writes");
assert.match(src,/finally\s*\{[\s\S]*startUiObserver\(\)/,"translator must restart observer in finally");
assert.match(src,/uiTranslationQueued/,"dynamic translation refresh must be coalesced");
assert.doesNotMatch(src,/queueMicrotask\(\(\)=>applyLanguage\(\"en\"\)\)/,"old recursive microtask translation loop must not return");
assert.doesNotMatch(src,/themeToggle\?\.addEventListener\([^\n]+applyLanguage/,"theme toggle must not retranslate the whole DOM");

assert.match(src,/data-info-es=/,"info bubbles must carry Spanish text explicitly");
assert.match(src,/data-info-en=/,"info bubbles must carry English text explicitly");
assert.match(src,/info-popover/,"info bubbles must use the viewport popover instead of layout-breaking inline content");
assert.match(src,/Métricas principales/,"Spanish metrics section label must be present");
assert.match(src,/Simulación de desarrollo/,"Spanish development simulation label must be present");
console.log("i18n regression test: OK");
