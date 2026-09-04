# ManaShelf — Build From Collection (concept)

Status: **planned / not implemented**. Recommended rollout: **LAB first**, same validation rule as Deck Metrics Engine.

## Goal
Given a Commander selected by the user, build the strongest coherent 99-card deck possible using the user's actual collection, rather than simply selecting the highest-ranked owned EDHREC cards.

The builder should optimize for a coherent plan while respecting Commander legality, singleton rules, color identity, owned quantities, mana curve, mana reliability, functional roles, Commander/theme synergy, and the existing ManaShelf deck-health metrics.

## User controls
Use a compact Settings panel with a small number of meaningful controls rather than dozens of quotas.

- **Theme focus** — low ↔ high. Higher values prefer cards directly connected to the selected EDHREC theme/tags.
- **Ramp** — standard / more / heavy. Changes the target ramp range while still respecting curve and Commander MV.
- **Interaction** — standard / more. Raises removal/counter/wipe targets without blindly filling every interaction slot.
- **Curve** — normal / lower / fastest coherent. Increases the penalty for expensive cards and rewards early development.
- **Synergy vs staples** — synergy-first ↔ balanced ↔ raw efficiency. Controls whether generic powerful cards may displace narrower thematic cards.
- **Protect existing decks** — on by default. Prefer free copies; optionally allow cards already committed to another deck.
- **Commander dependence** — conservative / normal / all-in. Controls how much the builder tolerates cards that are weak without the Commander.
- **Land style** — safe / balanced / lean. Alters the land target only after considering curve, ramp, draw, MDFCs if supported, and Commander cost.

## Data pipeline
`Commander + EDHREC themes/tags → legal owned candidate pool → semantic roles → candidate score → constrained deck assembly → mana base → existing metrics/simulation → repair loop → explanation`

### 1. Commander profile
Use:
- color identity;
- Commander MV and colored pip requirements;
- Oracle text / keywords;
- EDHREC themes and tags, with the selected theme receiving the strongest weight;
- Commander-linked semantic tags already available to ManaShelf.

### 2. Candidate pool
A card is eligible only if:
- Commander-legal;
- inside the Commander's color identity;
- present in the collection;
- singleton rules are respected (except basic lands/cards whose Oracle text permits multiples);
- availability policy is satisfied (`free copy` first unless the user allows cards used elsewhere).

### 3. Dynamic role targets
Do not hard-code one universal EDH list. Start from ranges and shift them based on archetype, curve and Commander.

Illustrative baseline before archetype adjustment:
- Lands: 35–38
- Ramp/fixing: 9–12
- Card advantage / selection: 9–12
- Spot interaction: 8–11
- Board wipes: 2–4
- Protection / recursion: 3–7 depending on plan
- Engines / setup / payoffs / threats: fill remaining slots according to Commander/theme profile

Adjustments:
- expensive Commander / high effective MV → more lands + ramp;
- low curve + many cheap cantrips → can tolerate fewer lands;
- graveyard deck → more recursion/enablers, less generic draw if graveyard itself is the resource engine;
- tokens/aristocrats → enough token generation + outlets + payoffs, not simply a fixed creature quota;
- spellslinger → interaction can overlap with theme slots and should not be double-counted as separate filler.

### 4. Candidate score
Each candidate gets a transparent score. Example normalized formulation:

`Score = 0.28 CommanderAffinity + 0.22 ThemeAffinity + 0.17 RoleNeed + 0.12 FunctionalDensity + 0.09 CurveFit + 0.07 ManaFit + 0.05 Availability - penalties`

Weights are changed by user settings rather than changing the underlying facts.

Penalties include:
- dead-card/dependency risk;
- redundant role already over target;
- excessive MV for the current curve target;
- colored-pip stress;
- cards requiring support the deck does not currently contain;
- consuming the only free copy from another protected deck when that option is enabled.

### 5. Assembly algorithm
Use an iterative constrained selector rather than picking the top 99 scores once.

1. Reserve Commander.
2. Build role/theme target ranges.
3. Select irreplaceable theme engines/enablers with strong evidence.
4. Fill critical structural minima (mana, draw, interaction).
5. Add complementary setup/payoff packages.
6. Add flexible multi-role cards when multiple deficits exist.
7. Build the mana base after nonlands are provisionally known.
8. Run existing ManaShelf metrics and development simulation.
9. Repair the deck with swaps until critical deficits stop improving or no better owned candidate exists.
10. Return the deck plus an audit report.

This can be implemented greedily first; a later version may use beam search/local search across swap candidates. A full game-playing AI is not required.

## Mana base calculation
Land count should be derived, not fixed.

Start near 37 and adjust using:
- average/effective MV;
- Commander MV;
- number and MV of ramp pieces;
- cheap draw/selection;
- desired land-drop probability from the existing simulator;
- user `safe/balanced/lean` setting.

Color distribution should use **colored pip demand weighted by desired casting turn**, not only total pips. Early double-pip requirements get more weight than late splash requirements. Fixing lands and mana rocks contribute to source counts according to the colors they can actually produce.

Target check: run the existing T1–T7 simulation and adjust lands/fixing until the selected reliability band is reached or the collection cannot improve it further.

## Shortage / fallback behavior
If the collection cannot satisfy a target, ManaShelf should not silently pad with random cards.

Backfill order:
1. same theme + same role;
2. Commander synergy + same role;
3. generic efficient card for the missing role;
4. flexible multi-role card;
5. best legal coherent card remaining.

The final report must say what was compromised, e.g.:
- `Target: 10 ramp pieces · found 7 strong matches · added 2 generic mana rocks · still 1 below target.`
- `Theme density target could not be reached with owned cards; 8 generic interaction/resource cards were used as structural backfill.`
- `Mana base remains short of two reliable blue sources for the requested curve.`

## Output
Return:
- proposed 99-card list;
- selected theme and detected subthemes;
- cards taken from free copies vs cards already used elsewhere;
- role counts;
- curve and mana-source summary;
- Deck Metrics snapshot;
- explicit compromises/shortages;
- optional alternate cards for the weakest slots;
- export to text / Archidekt only after user review.

## Validation plan
Build in LAB first and validate against known real decks:
1. Commander/theme identification is correct.
2. Generated list is legal and exactly 99 + Commander.
3. No unavailable copy is used unless allowed.
4. Mana reliability is plausible.
5. Structural role ranges are coherent for archetype, not universal quotas.
6. Theme density is meaningfully higher than a generic-staples baseline.
7. Existing Deck Metrics do not reveal obvious regressions.
8. Every fallback is explained rather than hidden.

Only after those checks should the feature be promoted outside LAB.
