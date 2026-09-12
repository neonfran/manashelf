import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath,pathToFileURL } from "node:url";
import { CLASSIFICATION_VERSION } from "../../../lib/deck-metrics.mjs";
import { COLLECTION_BUILDER_VERSION, MANA_MODEL_VERSION } from "../../../lib/collection-deck-builder.mjs";
import { COMBO_ENGINE_VERSION } from "../../../lib/combo-engine.mjs";

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,"../../.."),semantic=path.resolve(here,"..");
assert.equal(CLASSIFICATION_VERSION,7);assert.equal(COLLECTION_BUILDER_VERSION,14);assert.equal(MANA_MODEL_VERSION,5);assert.equal(COMBO_ENGINE_VERSION,2);
const method6=fs.readFileSync(path.join(root,"lib/archidekt-size.mjs"));
assert.equal(crypto.createHash("sha256").update(method6).digest("hex"),"3494fba7dc3b05412d96f8ca9687b723b1495661656c5744d90d124d7d0e23f5","Method 6 must remain byte-for-byte frozen");

const runtime=["server.mjs",...fs.readdirSync(path.join(root,"lib")).filter(x=>x.endsWith(".mjs")).map(x=>`lib/${x}`),...fs.readdirSync(path.join(root,"public")).filter(x=>x.endsWith(".js")).map(x=>`public/${x}`)];
for(const rel of runtime){const src=fs.readFileSync(path.join(root,rel),"utf8");assert.ok(!/experimental\/semantic/.test(src),`${rel} must not import LAB3 semantic harness`);}

const required=["schema.mjs","compiler.mjs","semantic-db.mjs","role-contracts.mjs","archetype-contracts.mjs","relationship-graph.mjs","audit.mjs","unknown-cluster.mjs","drift.mjs","provenance.mjs","json-stream.mjs","castability.mjs","rulings-db.mjs","lab2-baseline.mjs","engine-versions.mjs","semantic-input.mjs","raw-delta.mjs","scryfall-bulk.mjs","semantic-update.mjs","cli/semantic-harness.mjs"];
for(const rel of required){const file=path.join(semantic,rel);assert.ok(fs.existsSync(file),`missing semantic module ${rel}`);await import(pathToFileURL(file));}
console.log(`semantic architecture tests: OK · ${required.length} modules · LAB2 frozen`);
