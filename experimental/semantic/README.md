# Experimental Semantic Harness

This directory is an isolated pre-LAB3 semantic engine. It is executable, but it is **not** imported by LAB2, `server.mjs`, `public/` or the production `lib/` runtime.

Current experimental contracts:

- Semantic schema v1 / compiler v1.
- Card → face → ability → clause representation.
- Oracle newlines are ability boundaries; MDFC/card faces remain separate.
- Role and archetype contracts consume compiled semantic facts only; they do not parse Oracle again.
- `supported`, `partial` and `coverage_gap` are separate from `positive`, `no_evidence` and `explicit_negative` adjudication.
- Classification 7 is used only by the audit layer for read-only A/B diagnostics.
- Current Scryfall Bulk ingestion supports legacy JSON arrays, JSONL and gzip-compressed JSONL/JSON arrays.
- Source snapshots are versioned independently from semantic-engine fingerprints.

## Persistent data layout

By default managed Bulk data lives **outside the application/package** at:

```text
~/.manashelf/semantic-lab3/
  state/
  sources/<scryfall-source-id>/
    source-manifest.json
    bulk-metadata.json
    raw/
    indexes/
    delta/
  compiled/<source-id>/<semantic-db-engine-fingerprint>/
  analysis/<source-id>/<analysis-engine-fingerprint>/
```

Override with `--data-dir DIR` or `MANASHELF_SEMANTIC_DATA_DIR`.

A source update first fetches Scryfall Bulk metadata. If Oracle Cards and Rulings definitions are unchanged, it does not download or rebuild anything. If Scryfall changed, the new Oracle snapshot is compared by `oracle_id` and a semantic-input hash. Cosmetic changes such as prices/images can therefore be recorded as raw changes without forcing semantic recompilation.

When Scryfall changes but the Semantic Schema/compiler fingerprint is unchanged, only `added + semanticChanged` Oracle IDs are recompiled and unchanged compiled records are reused. When the Semantic Schema/compiler changes, the same raw source snapshot can be reused but the corpus is fully recompiled.

## Commands

```bash
npm run test:semantic
npm run semantic:harness -- smoke
npm run semantic:harness -- source-update [--data-dir DIR]
npm run semantic:harness -- corpus-build [--data-dir DIR]
npm run semantic:update -- [--data-dir DIR]

npm run semantic:harness -- build --input oracle-cards.jsonl.gz --output semantic.jsonl
npm run semantic:harness -- rulings --input rulings.jsonl.gz --output rulings.jsonl
npm run semantic:harness -- audit --db semantic.jsonl --output audit.json
npm run semantic:harness -- drift --before old.jsonl --after new.jsonl --output drift.json
npm run semantic:harness -- lab2-log --input Kess-build-log.json
```

`semantic:update` is the normal managed path: metadata check → atomic Bulk download if needed → source snapshot/hash/index → raw semantic delta → full/incremental Semantic DB build → Rulings DB → audit → semantic drift → run manifest.

The first real Scryfall snapshot necessarily compiles the whole Oracle corpus because there is no prior source index. Later source updates can use the delta.
