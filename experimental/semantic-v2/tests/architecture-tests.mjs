import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,"../../..");
for(const p of ["experimental/semantic-v2/role-views.mjs","experimental/semantic-v2/mana-view.mjs","experimental/semantic-v2/interaction-signals.mjs","experimental/semantic-v2/dependency-view.mjs","experimental/semantic-v2/theme-view.mjs","experimental/semantic-v2/castability-view.mjs","experimental/semantic-v2/context-optimizer.mjs"]){
  const src=fs.readFileSync(path.join(root,p),"utf8");
  assert.ok(!/source\?\.rawText|source\.rawText|rawAbilityText/.test(src),`${p} must not reinterpret Oracle/raw ability text`);
}
console.log("semantic-v2 architecture tests: PASS · LAB3 intentionally unfrozen after pre-builder gate");
