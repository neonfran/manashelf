import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const server=fs.readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");
const builder=fs.readFileSync(new URL("../lib/collection-deck-builder.mjs",import.meta.url),"utf8");
const method6=fs.readFileSync(new URL("../lib/archidekt-size.mjs",import.meta.url));

assert.match(html,/id="modeLab2"/,"LAB 2 mode must exist");
assert.match(html,/id="lab2Flow"/,"LAB 2 flow must exist");

assert.match(html,/LAB 1<small>Deck check\+\+<\/small>/,"LAB 1 must keep a short one-line descriptor");
assert.match(html,/LAB 2<small>Deck builder\+\+<\/small>/,"LAB 2 must keep a short one-line descriptor");
for(const label of ["Cualquier leyenda","Deck existente","Desde tu colección","Deck check++","Deck builder++"])assert.ok(label.length<=18,`mode subtitle should remain short: ${label}`);
assert.match(css,/\.mode>span small\{[^}]*white-space:nowrap!important/,"mode subtitles must be forced onto one line");
assert.match(server,/p==="\/api\/lab2\/access"/,"LAB 2 access-status route missing");
assert.match(server,/p==="\/api\/lab2\/unlock"/,"LAB 2 unlock route missing");
assert.match(server,/session\.lab2Unlocked!==true[^\n]*LAB 2 requiere contraseña/,"LAB 2 API routes must enforce the server-side gate");
assert.match(server,/crypto\.timingSafeEqual/,"LAB 2 password comparison must be timing-safe");
assert.match(server,/MANASHELF_LAB_PASSWORD_SCRYPT/,"LAB access must support a server-side scrypt override");
assert.match(server,/crypto\.scryptSync/,"LAB access password must use a memory-hard password KDF");
assert.match(server,/LAB_ACCESS_DEFAULT_SCRYPT = "scrypt\$16384\$8\$1\$/,"default LAB credential must be stored only as a salted scrypt record");
assert.ok(!/LAB2_PASSWORD_SHA256\s*=\s*process\.env\.MANASHELF_LAB2_PASSWORD_SHA256\s*\|\|\s*[\"']/.test(server),"a default LAB SHA-256 credential must not be embedded in server source");
assert.ok(!app.includes("LAB_ACCESS_DEFAULT_SCRYPT")&&!html.includes("LAB_ACCESS_DEFAULT_SCRYPT"),"LAB credential verifier material must never be shipped to the browser");
assert.ok(html.includes('id="modeLab2Lock" class="lab-lock" aria-hidden="true">🔒</i>'),"LAB 2 navigation must visibly start locked");
assert.ok(html.includes('id="modeLab3Lock" class="lab-lock" aria-hidden="true">🔒</i>'),"LAB 3 navigation must visibly start locked");
assert.match(app,/function syncLabLockState\(\)/,"LAB navigation lock state must follow the server-authorized session");
assert.match(app,/async function enterLab2\(\)/,"LAB 2 navigation must pass through the password gate");
assert.match(server,/availabilityExcluded=exclusions\.filter/,"protected-build diagnostics must count cards excluded by occupied copies");
assert.match(server,/theme Combo de EDHREC orienta afinidad y contexto/,"EDHREC Combo theme must be distinguished from the atomic Spellbook combo policy");
assert.match(builder,/function repairCastability\(/,"builder must have a post-build colored-pip castability repair pass");
assert.match(builder,/mana-castability-repair/,"castability swaps must be traceable in diagnostics");

assert.match(html,/id="lab2ComboPolicy"/,"LAB 2 must expose a combo construction policy");
assert.match(html,/value="infinite">Priorizar combo infinito<\/option>/,"LAB 2 must expose an infinite-combo policy");
assert.match(html,/value="basics">Básicas primero<\/option>/,"LAB 2 must expose a basics-first mana policy");
assert.match(server,/commanderSpellbookVariants/,"LAB 2 must integrate Commander Spellbook through the server layer");
assert.match(server,/comboEngineVersion:COMBO_ENGINE_VERSION/,"diagnostic logs must version the combo engine");
assert.match(builder,/availableComboPackages/,"builder must consume exact complete combo packages");
assert.match(builder,/comboComplete:comboValidation\.complete/,"builder must expose combo completeness as an invariant");
assert.match(builder,/themeFlags\.reanimator|f\.reanimator/,"builder must include an explicit Reanimator archetype profile");
assert.match(html,/id="lab2CommanderSearch"/,"LAB 2 must search legendary creatures");
assert.match(html,/id="lab2ThemeGrid"/,"LAB 2 must expose theme selection");
for(const id of ["lab2ThemeFocus","lab2Ramp","lab2Interaction","lab2Curve","lab2Synergy","lab2Dependence","lab2LandStyle","lab2ProtectDecks","lab2Generate","lab2Audit","lab2DeckTable","lab2Health"]){
  assert.ok(html.includes(`id="${id}"`),`LAB 2 control missing: ${id}`);
}
assert.match(server,/p==="\/api\/lab2\/profile"/,"LAB 2 commander profile route missing");
assert.match(server,/lab2ProfileCache/,"LAB 2 orchestration must cache the already-loaded Commander profile");
assert.match(server,/lab2CommanderProfile\(session,commander,\{reuseCached:true\}\)/,"LAB 2 build must reuse the profile already loaded for theme selection");
assert.match(server,/unique\.every\(name=>scryfallCacheRecordFresh/,"cache-only Scryfall lookups must bypass the global batch queue");
assert.match(server,/p==="\/api\/lab2\/build"/,"LAB 2 build route missing");
assert.match(server,/await edhrecTags\(name\)/,"Commander profile must use EDHREC themes");
assert.match(server,/await edhrecThemeLists\(commander,chosenTheme\)/,"selected theme must influence the candidate model");
assert.match(server,/import \{ normalizeColorIdentity \} from "\.\/lib\/color-identity\.mjs"/,"collection color identity must use the shared normalizer");
assert.match(server,/function prefilterCollectionByColorIdentity\(/,"LAB 2 must keep an explicit coarse color-identity prefilter");
assert.match(server,/batchScryfallImages\(prefilter\.eligible\.map\(c=>c\.name\),\{onProgress:/,"prefilter survivors must be validated with Scryfall metadata and expose batch progress");
assert.match(server,/m\.colorIdentity\|\|\[\]\)\.every\(x=>commanderColorSet\.has\(x\)\)/,"Scryfall color_identity must make the authoritative final legality decision");
assert.match(server,/await buildDeckHealth\(session,id,\{includeDeckMetrics:true\}\)/,"generated deck must be audited by existing Deck Health + Deck Metrics");
assert.match(builder,/function adjustLandTargetFromSelection\(/,"mana base must react to the actual provisional build");
assert.match(builder,/function selectLands\(/,"builder must construct the mana base explicitly");
assert.match(builder,/function selectNonlands\(/,"builder must assemble nonlands with structural constraints");
assert.match(builder,/buildShortages\(/,"builder must report unresolved shortages");
assert.match(app,/setupCommanderAutocomplete\(E\.lab2CommanderSearch,E\.lab2CommanderDropdown,chooseLab2Commander\)/,"LAB 2 must reuse the proven Commander search");
assert.match(app,/renderLabResult\(d\.health,E\.lab2Health,"lab2",lab2DeckDetail\)/,"LAB 2 must reuse Deck Health rendering");
assert.match(app,/inspectorMode==="lab"\|\|inspectorMode==="lab2"/,"LAB 2 health must include experimental Deck Metrics");
assert.match(css,/\.lab2-health-workspace/,"LAB 2 health workspace styling missing");

for(const id of ["lab2Export","lab2CopyArchidekt","lab2ExportLog"]){assert.ok(html.includes(`id="${id}"`),`LAB 2 export control missing: ${id}`)}
assert.match(app,/function lab2ArchidektText\(\)/,"LAB 2 must generate Archidekt import text");
assert.match(app,/\[\$\{category\}\]/,"Archidekt export must preserve categories in square brackets");
assert.match(app,/function exportLab2Log\(\)/,"LAB 2 must expose a diagnostic JSON log");
assert.match(app,/function buildDiagnosticFileName\(/,"diagnostic exports must use the shared self-describing filename contract");
assert.match(app,/buildDiagnosticFileName\(log,"LAB2"/,"LAB 2 diagnostic filename must identify LAB2 explicitly");
const filenameFns=app.match(/function lab2SafeFileName\(name\)\{[^\n]+\}\nfunction buildDiagnosticFileName\(log,lab,fallbackCommander="Commander",fallbackTheme="Theme"\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(filenameFns,"diagnostic filename helpers must remain extractable for behavior regression");
const diagnosticName=new Function(`${filenameFns}; return buildDiagnosticFileName;`)();
assert.equal(diagnosticName({appVersion:"2.5.42-beta",generatedAt:"2026-09-11T15:57:00.000Z",input:{commander:"Kess, Dissident Mage",theme:{name:"Spellslinger"}}},"LAB3"),"ManaShelf-v2.5.42-beta__LAB3__Kess-Dissident-Mage__Spellslinger__Build-Diagnostic__20260911155700Z.json","diagnostic filename must encode version/LAB/Commander/theme/type/timestamp");
assert.match(server,/schema:"manashelf-lab2-build-log-v8"/,"server must return the v8 diagnostic build log");
assert.match(server,/p==="\/api\/lab2\/build-log"/,"diagnostic build log must be fetched on demand instead of bloating the normal build response");
assert.match(server,/session\.lab2BuildLogs\.set\(id,diagnosticLog\)/,"diagnostic logs must be retained for export");
assert.match(server,/syntheticBasic:Boolean\(c\.syntheticBasic\)/,"generated detail must preserve unlimited-basic provenance");
assert.match(builder,/COLLECTION_BUILDER_VERSION = 14/,"LAB 2 must use builder v14");
assert.match(builder,/function computeColorRequirements\(/,"mana base must compute colored-source requirements");
assert.match(builder,/function hyperAtLeast\(/,"mana base must audit source reliability probabilistically");
assert.match(builder,/function typeStructureProfile\(/,"builder must enforce type-diversity floors and caps");
assert.match(builder,/function cardTraits\(/,"multi-type cards must use overlapping traits");
assert.match(builder,/function roleQuality\(/,"functional roles must be quality-weighted instead of boolean only");
assert.match(builder,/Diminishing returns:/,"builder must penalize redundant over-saturation");
assert.match(builder,/Quality upgrade pass/,"builder must run a post-construction quality upgrade pass");
assert.match(builder,/export function analyzeLandSource\(/,"mana sources must use an explicit capability model");
assert.match(builder,/MANA_MODEL_VERSION = 5/,"mana source model must be versioned");
assert.match(builder,/COLLECTION_BUILDER_VERSION = 14/,"LAB 2 must use builder v14");
assert.match(fs.readFileSync(new URL("../lib/deck-metrics.mjs",import.meta.url),"utf8"),/CLASSIFICATION_VERSION = 7/,"LAB 2 must use classification v7");
assert.match(builder,/archetypeAffinity/ ,"builder must separate archetype affinity from contextual popularity");
assert.match(builder,/effectiveThemeAffinity/ ,"builder must expose effective theme affinity");
assert.match(builder,/repairSwaps/ ,"mana model must expose repair swaps");
assert.match(builder,/effectiveSources/ ,"mana model must expose turn-aware effective sources");
assert.match(server,/healthSemanticSource:/,"diagnostic log must declare the semantic engine used by Deck Health");
assert.match(server,/diagnosticCandidatesOmitted:/,"diagnostic log must cap candidate payload while preserving counts");
assert.match(server,/deriveCardFacts/,"theme evidence must consume the canonical semantic-facts layer");
assert.match(server,/selectionPhase:c\.builder\?\.selectionPhase/,"diagnostic deck rows must expose the actual selection phase");
assert.match(server,/selectionContextScore:Number\(c\.builder\?\.selectionContextScore/,"diagnostic deck rows must expose contextual admission score");
assert.match(builder,/function validateFinalDeck\(/,"builder must revalidate hard Commander invariants after construction");
assert.match(builder,/if\(!finalValidation\.hardValid\)throw new Error/,"hard invariant violations must abort instead of emitting an invalid deck");
assert.match(builder,/selectionTrace:Object\.fromEntries\(trace\)/,"builder must preserve construction-stage provenance for selected nonlands");
assert.match(builder,/semanticFacts:c\.semantic\?\.facts\|\|\{\}/,"candidate diagnostics must expose canonical semantic facts");
assert.match(builder,/function injectUnlimitedBasics\(/,"builder must inject unlimited basics independently of collection inventory");
assert.match(server,/EDHREC_CACHE_VERSION=3/,"EDHREC recommendation cache must invalidate old inclusion semantics");
assert.match(server,/b\.cardCount-a\.cardCount/,"LAB 1 themes must rank by local deck evidence before EDHREC popularity");
assert.match(css,/theme-chart \.theme-segments \.segmented-fill/,"LAB 1 theme rails must keep empty segments visible");

// Guard the explicitly validated Method 6 against accidental edits in this experimental branch.
const sha=crypto.createHash("sha256").update(method6).digest("hex");
assert.equal(sha,"3494fba7dc3b05412d96f8ca9687b723b1495661656c5744d90d124d7d0e23f5","Method 6 changed unexpectedly");

// IDs must remain unique; this catches layout bugs that silently break querySelector/getElementById.
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,"public/index.html contains duplicate IDs");

// LAB 2 must remain isolated from the old five-method preview diagnostic experiment.
for(const leaked of ["previewDiagnostic","PREVIEW_DIAG_METHODS","/api/preview-diagnostic","runPreviewDiagnosticMethod"]){
  assert.ok(!server.includes(leaked)&&!app.includes(leaked)&&!html.includes(leaked),`legacy preview diagnostic leaked into LAB 2: ${leaked}`);
}
assert.match(fs.readFileSync(new URL("../lib/combo-engine.mjs",import.meta.url),"utf8"),/card:"\$\{safe\}"/,"Spellbook must search combos containing the Commander card, not only variants requiring commander status");
assert.match(server,/apiVariantsFetched/,"Spellbook diagnostic must separate upstream fetch count from later compatibility/availability filters");
assert.match(server,/commanderCompatible/,"Spellbook diagnostic must expose commander-compatible variant count");
assert.match(server,/infiniteComplete/,"Spellbook diagnostic must expose complete infinite combo count");
assert.match(server,/\/find-my-combos/,"LAB 2 must use Spellbook Find My Combos as a post-build fallback audit when no package was selected");
assert.match(server,/infiniteIncluded/,"fallback combo audit must distinguish complete infinite combos already present in the final list");

assert.match(server,/p==="\/api\/lab2\/progress"/,"LAB 2 must expose real server-side progress");
assert.match(server,/function setLab2Progress\(/,"LAB 2 server progress must use a shared stage setter");
assert.match(app,/function lab2ProgressOnce\(/,"LAB 2 UI must poll real progress");
assert.match(app,/setInterval\(lab2ProgressOnce,450\)/,"LAB 2 UI must refresh server progress while a build is active");
assert.match(app,/function setupPopupKeyboard\(/,"autocomplete must support keyboard confirmation");
assert.match(app,/e\.key==="Enter"/,"Enter must confirm an autocomplete selection");
assert.match(app,/function terminalShowSelection\(/,"sticky console must expose selected context");
assert.match(app,/function terminalSetActivity\(/,"sticky console must expose current processing activity");
assert.match(server,/availabilityExcluded/ ,"LAB 2 response must expose protected-copy candidate exclusions");
assert.match(builder,/structuralTradeoffs/ ,"builder must audit structural-over-theme tradeoffs");

console.log("LAB 2 regression test: OK");
