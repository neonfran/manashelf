# ManaShelf Deck Metrics Engine — Implementation Status

**Version:** v2.5.8-beta  
**Scope:** LAB only

## Implemented

- Pure Node module: `lib/deck-metrics.mjs`
- No new npm dependencies
- Semantic role/dependency/synergy classification
- In-process semantic classification cache
- Scryfall metadata support for `manaCost` and `producedMana`
- 18 metric families from `ManaShelf_Deck_Metrics_Technical_Spec.md`
- Deterministic lightweight development simulation
- London mulligan approximation
- Mana/color source analysis
- Interaction coverage and efficiency
- Functional density
- Setup/payoff balance
- Dependency/bottleneck analysis
- Structural resilience heuristic
- Dead-card structural proxy
- Effective mana value heuristic
- Closing-power evidence heuristic
- LAB-only UI with raw evidence, confidence, classifications and T1–T7 simulation
- Existing Deck Health / Improve flow preserved
- Simulation only runs when LAB explicitly requests `includeMetrics:true`

## Deliberately not implemented

These were explicitly out of scope in the spec and remain out of scope:

- Multiplayer opponent AI
- Exact combat simulation
- Exact win percentage
- Exact turn-to-win prediction
- Universal EDH power score
- Per-card LLM calls
- Full pairwise card synergy graph

## Validation status

Code-level checks pass, but the new metrics are **not yet validated against the user's real decks**. They must remain in LAB until benchmarked and calibrated.

Recommended validation set:

- 5-color tribal
- 2-color low-curve deck
- precon / upgraded precon
- graveyard/reanimator
- combo
- control
- artifact/enchantment deck
- high-MV battlecruiser

## Promotion rule

Do not wire these metrics into production recommendations until their output is validated in LAB. Once validated, production should consume the same metric objects rather than reimplementing formulas.
