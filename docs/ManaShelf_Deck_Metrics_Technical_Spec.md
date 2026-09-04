# ManaShelf — Deck Metrics Engine
## Technical Specification for Lab → Deck Analysis / Deck Improvement

**Status:** Implementation proposal  
**Initial target:** `Lab`  
**Production targets:** `Deck Analysis`, `Deck Improvement`  
**Primary goal:** Build an explainable, resource-conscious EDH deck analysis engine based on deterministic card data, cached semantic tags, and optional simulation.

---

# 1. Core principle

ManaShelf should not begin by asking:

> Which cards should be replaced?

It should first determine:

1. **What structural weakness exists?**
2. **What measurable evidence supports it?**
3. **Which cards contribute least to the current plan?**
4. **Which candidate replacements improve the weak metric without damaging other important metrics?**

Target flow:

**Detect → Explain → Identify → Recommend → Compare**

This engine must be built and validated in `Lab` before being used in production-facing deck analysis or deck improvement.

---

# 2. Feasibility review

The proposed system is feasible if it is implemented in layers and does **not** attempt to simulate complete multiplayer Commander games.

The most realistic architecture is:

1. **Raw card facts**
2. **Cached semantic card tags**
3. **Fast deterministic deck metrics**
4. **Optional Monte Carlo development simulation**
5. **Interpretation / recommendation layer**

The following areas are highly feasible and should be implemented first:

- mana source counts and color coverage;
- interaction density and coverage;
- card-role counts;
- functional card density;
- engine density;
- threat/payoff density;
- setup/payoff balance;
- dependency/redundancy;
- printed and adjusted mana curve;
- simple draw/ramp/resource availability;
- basic Monte Carlo opening-hand / early-turn development.

The following are feasible but must remain heuristic and should not block the initial system:

- synergy strength;
- dead-card probability;
- resilience;
- gameplan consistency;
- closing power;
- estimated threat turn.

The following should **not** be attempted as part of this system:

- full multiplayer game simulation;
- exact win percentage;
- exact turn-to-win prediction;
- universal EDH power level;
- precise opponent behavior modeling;
- LLM-only deck scoring.

---

# 3. Resource-conscious design

ManaShelf should avoid expensive analysis on every page load.

## 3.1 Card-level semantic data should be cached globally

A card's functional classification should be generated once and reused across all decks.

Example:

```json
{
  "card_id": "...",
  "classification_version": 3,
  "roles": [
    "ramp",
    "mana_fixing"
  ],
  "synergy_tags": [
    "land"
  ],
  "dependencies": [],
  "confidence": 0.98
}
```

Recalculate only when:

- Oracle text changes;
- classification rules change;
- semantic classification version changes.

Do **not** rerun an LLM per card per deck.

---

## 3.2 Deck metrics should be cached by deck hash

Suggested key:

```text
deck_hash
commander_id
metrics_version
classification_version
simulation_version
```

A deck analysis is invalidated only when:

- the decklist changes;
- commander changes;
- metric logic changes;
- classification changes;
- simulation logic changes.

---

## 3.3 Simulations should be opt-in or cached

Recommended modes:

```text
Fast / preview       500–1,000 simulations
Normal               5,000 simulations
Lab validation       10,000–25,000 simulations
```

There is no need to run 50,000 simulations during normal use.

For most deck-development probabilities, 5,000 runs should already be sufficient for user-facing estimates.

---

## 3.4 Heavy semantic analysis should not run continuously

Preferred priority:

1. structured card data;
2. deterministic rules;
3. regex / Oracle-text parsing;
4. stored semantic classifications;
5. LLM fallback only for ambiguous cases.

---

# 4. System architecture

## Layer 1 — Raw Card Facts

Source: Scryfall or equivalent card database.

Recommended stored fields:

```text
id
name
oracle_text
mana_cost
mana_value
colors
color_identity
type_line
supertypes
subtypes
keywords
power
toughness
loyalty
produced_mana
legalities
card_faces
```

These are objective facts and should not contain AI interpretation.

---

## Layer 2 — Semantic Card Classification

Cards may receive multiple roles.

Recommended initial role taxonomy:

```text
ramp
mana_fixing
card_draw
card_selection
tutor
recursion

creature_removal
artifact_removal
enchantment_removal
planeswalker_removal
land_interaction
graveyard_interaction
counterspell
board_wipe
protection

cost_reduction
token_generation
engine
payoff
threat
finisher
setup

evasion
haste
sacrifice_outlet
damage_engine
combat_payoff
tribal_payoff
```

Additional fields:

```text
synergy_tags
dependencies
confidence
classification_source
classification_version
```

Example:

```json
{
  "card": "Dragon Tempest",
  "roles": [
    "haste",
    "tribal_payoff",
    "damage_engine",
    "engine"
  ],
  "synergy_tags": [
    "dragon",
    "creature_etb"
  ],
  "dependencies": [
    "dragon"
  ],
  "confidence": 0.98
}
```

### Important implementation rule

Do not try to perfectly understand every Magic card before shipping the first version.

The classification engine must support:

```text
unknown
ambiguous
manual_override
```

Lab should expose classification errors so they can be corrected.

---

## Layer 3 — Fast Deck Metrics

These are calculated from Layers 1 and 2 and should be inexpensive.

Examples:

- land count;
- mana source count;
- colored source count;
- ramp count;
- draw count;
- interaction coverage;
- functional density;
- payoff density;
- engine density;
- dependency;
- redundancy;
- setup/payoff ratio;
- mana curve.

These should be usable immediately after a deck change.

---

## Layer 4 — Development Simulation

This is **not a full Magic simulator**.

The simulator only needs to model:

```text
shuffle
opening hand
mulligan
draw per turn
land drops
basic mana production
ramp
mana fixing
basic setup
commander castability
engine availability
payoff availability
threat availability
```

Opponent boards and actual combat are out of scope.

---

# 5. Metric definitions

---

## METRIC 01 — Mana Reliability

### Feasibility
**HIGH**

One of the safest metrics to automate.

### Inputs

For each mana source:

```text
colors produced
conditional or unconditional
enters tapped
required activation cost
land or nonland
turn realistically available
amount produced
```

For each spell:

```text
mana_cost
mana_value
colored pips
```

### Calculate

```text
P(land drop T1)
P(land drop T2)
P(land drop T3)
P(land drop T4)

P(color X available by turn N)

P(required colors available by turn N)

average mana available by turn
untapped source percentage
ramp availability
```

### Production output example

```text
Land drop T3             91%
Required colors T3       87%
Ramp by T3               74%
All five colors by T5    81%
```

### Initial implementation note

Do not try to determine an ideal casting turn for every spell initially.

First version should evaluate:

- early colored requirements;
- commander requirements;
- aggregate deck color demand.

Later versions can model spell-specific castability.

---

## METRIC 02 — Early-Game Development

### Feasibility
**HIGH with simple simulation**

### Track T1–T4

```text
available mana
mana spent
land drops
ramp deployed
fixing deployed
setup deployed
engine deployed
```

### Calculate

```text
productive T1 %
productive T2 %
productive T3 %

average usable mana by turn
mana utilization %
ramp deployed by T3 %
```

### Definition of "productive"

Must be rule-based and configurable.

Examples:

- ramp;
- fixing;
- relevant setup;
- card selection;
- engine setup.

Holding removal should **not** automatically count as a productive play unless the simulation specifically models reactive availability.

---

## METRIC 03 — Card Advantage / Resource Access

### Feasibility
**HIGH for counting, MEDIUM for estimated output**

### Tags

```text
draw_immediate
draw_repeatable
impulse_draw
card_selection
tutor
recursion
cast_from_graveyard
cast_from_exile
resource_engine
```

### First version

Calculate:

```text
immediate draw effects
repeatable engines
tutors
recursion sources
total resource effects
```

### Simulation extension

```text
P(resource effect available T4)
P(resource effect available T5)
P(resource effect available T6)
```

### Avoid initially

Do not attempt to estimate that a repeatable engine will draw an exact number of cards in a multiplayer game.

---

## METRIC 04 — Interaction Density & Coverage

### Feasibility
**VERY HIGH**

### Tags

```text
creature_removal
artifact_removal
enchantment_removal
planeswalker_removal
land_interaction
graveyard_interaction
counterspell
board_wipe
protection
stax
```

### Calculate

```text
Interaction Density =
cards with interactive role / nonland cards
```

Also count coverage by category.

### Example output

```text
Creature       9
Artifact       7
Enchantment    6
Graveyard      2
Stack          1
Land           1
Board wipes    3
```

### Detectable gaps

```text
LOW graveyard coverage
NO stack interaction
LOW enchantment coverage
```

Thresholds should be archetype-aware and configurable in Lab.

---

## METRIC 05 — Interaction Efficiency

### Feasibility
**HIGH**

### Inputs

```text
mana_value
instant / sorcery
target breadth
exile / destroy / bounce
conditionality
additional cost
restrictions
number of targets
```

### Suggested components

```text
CostScore
SpeedScore
CoverageScore
ReliabilityScore
RestrictionPenalty
```

### Important

Do not present the composite score as objective truth.

Prefer user-facing facts:

```text
Average removal MV     1.9
Instant-speed          78%
Broad answers          54%
Conditional answers    17%
```

A hidden score may still be useful for recommendation ranking.

---

## METRIC 06 — Threat / Payoff Density

### Feasibility
**HIGH once semantic tags exist**

### Roles

```text
threat
payoff
finisher
engine
setup
utility
```

Cards may belong to more than one role.

### Calculate

```text
Threat Density
Payoff Density
Finisher Count
```

### Simulation extension

```text
P(payoff available by T5)
P(threat available by T6)
```

---

## METRIC 07 — Engine Density

### Feasibility
**HIGH**

### Engine definition

A card counts as an engine when it:

1. generates repeatable value;
2. can trigger or activate more than once;
3. has a realistic activation condition for the deck.

### Calculate

```text
Engine Count
Engine Density
```

Optional simulation:

```text
P(engine available T4)
P(engine available T5)
P(engine available T6)
```

---

## METRIC 08 — Functional Card Density

### Feasibility
**VERY HIGH**

Each card may perform multiple relevant functions.

Suggested weights:

```text
Primary role          1.00
Strong secondary      0.50
Minor utility         0.25
```

### Calculate

```text
Functional Density =
sum(weighted relevant roles) / nonland cards
```

### Additional output

```text
1-role cards
2-role cards
3+-role cards
```

### Important

Only roles relevant to the deck should count strongly.

A card having many generic Oracle functions should not automatically receive a high score.

---

## METRIC 09 — Setup / Payoff Balance

### Feasibility
**HIGH**

Classify cards:

```text
enabler
payoff
both
neither
```

### Calculate

```text
Enabler Count
Payoff Count
Both Count
Setup / Payoff Ratio
```

### Simulation extension

```text
balanced hand %
setup-heavy hand %
payoff-heavy / unsupported hand %
```

This is more useful than enforcing one universal ideal ratio.

---

## METRIC 10 — Gameplan Consistency

### Feasibility
**MEDIUM**

This should be a derived metric, not an independent AI opinion.

### Inputs

```text
primary archetype
secondary archetype
commander tags
core roles
role redundancy
simulation availability
```

### Calculate from

```text
Role Coverage
Role Redundancy
Core Role Availability
Core Sequence Probability
```

Example:

```text
Ramp / fixing by T3    81%
Payoff by T5           92%
Engine by T5           64%
```

### Important

Do not create a single consistency score until the lower-level metrics have been validated.

---

## METRIC 11 — Synergy Density

### Feasibility
**MEDIUM**

Use tags instead of unrestricted pairwise AI comparison.

Each card may:

```text
produce tags
consume tags
benefit from tags
```

Example:

```text
Dragon creature
produces: dragon, creature_etb

Dragon Tempest
benefits_from: dragon, creature_etb
```

### Initial output

```text
Strong synergy cards
Moderate synergy cards
Generic cards
Low-synergy cards
```

### Avoid initially

Do not evaluate every possible card pair with an LLM.

That is expensive and unnecessary.

---

## METRIC 12 — Dependency / Bottleneck Risk

### Feasibility
**HIGH**

Supported dependency types:

```text
commander
graveyard
creatures
artifacts
enchantments
tribe
combat
tokens
specific role
specific card
```

### Calculate

```text
Commander Dependency
Graveyard Dependency
Creature Dependency
Artifact Dependency
Role Redundancy
Single-role Bottlenecks
```

### Suggested logic

Dependency should measure how many relevant cards lose function if a dependency is unavailable.

Example:

```text
commander_dependency =
weighted cards depending on commander /
weighted relevant nonland cards
```

---

## METRIC 13 — Dead Card Risk

### Feasibility
**MEDIUM / ADVANCED**

Dependencies may include:

```text
requires_creature
requires_graveyard
requires_commander
requires_artifact
requires_tribe
requires_opponent_target
requires_token
```

### Future simulation

When a card is observed:

```text
usable
partially_usable
unusable
```

Then:

```text
Dead Card Rate =
unusable observations / total observations
```

### Important

This should stay in Lab until heavily tested.

A simplistic implementation can produce misleading results because Magic cards often have situational utility that a goldfish simulator cannot see.

---

## METRIC 14 — Resilience / Recovery

### Feasibility
**MEDIUM**

Do not simulate full post-wipe games initially.

Instead perform structural stress tests.

### Scenarios

```text
commander unavailable
creature board unavailable
graveyard unavailable
artifacts unavailable
primary engine removed
```

### Calculate

Compare role coverage before and after each scenario.

```text
Structural Resilience =
post-disruption functional coverage /
baseline functional coverage
```

Example:

```text
Baseline               100%
Without commander       78%
Without graveyard       94%
Without artifacts       73%
```

This should be described as **structural resilience**, not actual win probability after disruption.

---

## METRIC 15 — Effective Mana Value

### Feasibility
**HIGH for simple discounts, MEDIUM for complex alternate costs**

Start with:

```text
Printed MV
```

Then model reliable cost modifiers:

```text
commander eminence
global cost reduction
tribal cost reduction
affinity-like mechanics
convoke
delve
alternate costs
```

### Recommended v1

Only adjust costs for reductions that are deterministic or highly predictable.

Example:

```text
Printed Average MV      4.2
Reliable Adjusted MV    3.8
```

### Avoid

Do not model every conditional discount as exact expected mana without sufficient simulation support.

---

## METRIC 16 — Speed / Turn of Relevance

### Feasibility
**MEDIUM**

Do not describe this as "turn to win".

Define observable milestones:

```text
commander castable
engine available
major threat available
payoff available
relevant board development threshold
```

### Output

```text
Relevant development by:

T3   7%
T4   24%
T5   53%
T6   79%
T7   92%
```

A median relevance turn may be shown if the threshold is clearly defined.

---

## METRIC 17 — Closing Power

### Feasibility
**MEDIUM / HEURISTIC**

Supported tags:

```text
infinite_combo
mass_damage
overrun
extra_combat
commander_damage
mass_reanimation
mass_evasion
damage_multiplier
direct_life_loss
large_scaling_threat
```

### Initial output should be evidence-first

```text
Finishers             5
Infinite lines        0
Extra combats         2
Mass evasion          3
Damage multipliers    2
```

Then an interpretation:

```text
Closing Power: HIGH
Confidence: MEDIUM
```

### Avoid

Do not claim exact closing probabilities from a goldfish model.

---

## METRIC 18 — Goldfish Development

### Feasibility
**HIGH if scope stays limited**

This should become the primary simulation engine.

### Simulate

```text
shuffle
draw 7
mulligan
play land
select usable mana
cast ramp
cast fixing
cast basic setup
track card availability
track commander castability
repeat until T6/T7
```

### Track

```text
land drops
mana available
colors available
ramp
resource engine availability
payoff availability
commander castability
threat availability
```

### Example

```text
T2 ramp                  61%
T3 4+ mana               69%
T4 resource engine       42%
T5 commander castable    81%
T5 payoff available      76%
```

### Important limitation

This is a **development simulator**, not a Magic game engine.

Naming and UI should reflect that.

---

# 6. Mulligan model

A basic initial mulligan heuristic is sufficient.

Suggested starting rule:

Keep if:

```text
2–4 lands
AND
reasonable color access
AND
at least one early relevant action
```

Then apply London Mulligan rules.

Later, archetype-specific mulligan profiles can exist.

Examples:

```text
low_curve
high_commander_mv
lands
reanimator
combo
battlecruiser
```

Mulligan logic must be versioned.

---

# 7. Archetype detection

### Feasibility
**MEDIUM, but useful**

Initial supported archetypes:

```text
tribal
tokens
aristocrats
spellslinger
reanimator
voltron
control
combo
lands
artifacts
enchantress
battlecruiser
stax
blink
counters
```

A deck may have:

```text
primary_archetype
secondary_archetype
```

Archetype detection should influence:

- expected role ranges;
- setup/payoff interpretation;
- dependency interpretation;
- threat definition;
- closing-power interpretation;
- later mulligan profiles.

### Important

Archetype detection should not block the basic metric engine.

The first implementation can allow manual archetype override in Lab.

---

# 8. Confidence model

Each user-facing metric should expose confidence internally.

Recommended:

```text
HIGH
MEDIUM
LOW
```

Internal representation:

```text
0.0 – 1.0
```

Examples:

### HIGH

- land probability;
- color-source count;
- interaction count;
- role count.

### MEDIUM

- synergy;
- dependency;
- effective MV with conditional reducers;
- threat classification.

### LOW / ESTIMATED

- closing power;
- dead-card rate in complex decks;
- resilience interpretation.

Suggested data model:

```json
{
  "metric": "interaction_coverage",
  "value": {},
  "confidence": 0.96,
  "method": "deterministic",
  "evidence": {},
  "version": 2
}
```

---

# 9. Explainability requirement

Every production metric must be able to answer:

```text
What was measured?
What was found?
Why does it matter?
Which cards contributed?
Which cards caused the weakness?
How confident is the result?
```

Example:

```text
Interaction Coverage — Weak

11 interactive cards detected.

Creature       8
Artifact       6
Enchantment    5
Graveyard      1
Stack          0

Primary issue:
Very low graveyard coverage.
```

The recommendation engine should use this exact evidence later.

---

# 10. Lab requirements

Create a dedicated Lab view:

## Deck Metrics Lab

### Header

```text
Deck
Commander
Deck Hash
Classification Version
Metrics Version
Simulation Version
Simulation Count
Last Analysis
```

### Overview

Suggested categories:

```text
Mana
Development
Resources
Interaction
Threats
Consistency
Dependency
Synergy
```

### Raw Metrics

Expose raw metric outputs before interpretation.

### Card Classification Table

Recommended columns:

```text
Card
Primary Role
Secondary Roles
Dependencies
Synergy Tags
Confidence
Classification Source
```

### Simulation

Display T1–T7 results.

### Detected Issues

Examples:

```text
LOW graveyard interaction
HIGH commander dependency
LOW early development
HIGH setup density
```

### Debug / Explain

For each metric expose:

```text
inputs
formula / rule
threshold
result
metric version
```

This debug information should remain Lab-only.

---

# 11. Manual correction tools in Lab

This is strongly recommended.

Allow a developer/admin to override:

```text
card role
dependency
synergy tag
archetype
metric interpretation
```

Store overrides separately from raw source data.

Example:

```json
{
  "card_id": "...",
  "override": {
    "add_roles": ["engine"],
    "remove_roles": ["finisher"]
  }
}
```

This makes calibration far easier than repeatedly rewriting classification logic.

---

# 12. Benchmark validation

Before production promotion, validate against a controlled set of decks.

Recommended starting set:

```text
15–25 decks
```

That is enough initially.

Include:

- precon;
- upgraded precon;
- optimized casual;
- high-power;
- cEDH;
- tribal;
- combo;
- control;
- reanimator;
- artifact;
- lands;
- 5-color;
- low-land;
- high-MV battlecruiser.

Human expectation examples:

```text
Deck A:
Mana Reliability = HIGH

Deck B:
Interaction Coverage = LOW

Deck C:
Commander Dependency = VERY HIGH
```

Benchmark expectations do not need exact numeric answers.

They should confirm whether the metric behaves directionally correctly.

---

# 13. Metric versioning

Every derived metric must include a version.

Examples:

```text
mana_reliability:v2
interaction_coverage:v1
functional_density:v3
development_simulation:v2
```

Changing a formula increments the version.

Old cached results with a different version should be ignored.

---

# 14. Implementation phases

## PHASE 0 — Inventory existing ManaShelf data

Before coding new analysis logic, verify which of these already exist:

```text
Scryfall card cache
Oracle text
mana cost parser
deck hashing
commander identification
role tags
existing deck-analysis categories
existing recommendation logic
existing Lab infrastructure
```

Reuse existing systems wherever possible.

---

## PHASE 1 — Semantic foundation

Build or formalize:

```text
role taxonomy
dependency taxonomy
synergy tag taxonomy
classification schema
classification versioning
classification cache
manual overrides
```

Deliverable:

**Card Classification Lab**

No recommendations yet.

---

## PHASE 2 — Deterministic metrics

Implement first:

1. Interaction Density
2. Interaction Coverage
3. Functional Card Density
4. Engine Density
5. Threat / Payoff Density
6. Setup / Payoff Balance
7. Dependency / Redundancy
8. Basic Resource Counts
9. Printed Mana Curve
10. Basic Mana Source Coverage

These are the best early-return features.

---

## PHASE 3 — Mana reliability

Implement:

```text
mana source parser
conditional source handling
color requirements
land-drop probabilities
color probabilities
commander color castability
ramp availability
```

Deliverable:

**Mana Reliability Lab**

---

## PHASE 4 — Development simulator

Implement:

```text
shuffle
London mulligan
land sequencing
basic ramp sequencing
basic fixing sequencing
draw per turn
commander castability
resource/payoff availability
```

Deliverables:

- Early Game Development
- Goldfish Development
- Engine Availability
- Payoff Availability
- Commander Castability

---

## PHASE 5 — Advanced derived metrics

Only after Phases 1–4 are stable:

```text
Gameplan Consistency
Synergy Density
Structural Resilience
Dead Card Risk
Threat Turn
Closing Power
```

All must expose confidence and evidence.

---

## PHASE 6 — Production promotion

Validated metrics move into:

### Deck Analysis

Purpose:

```text
detect
explain
show evidence
```

### Deck Improvement

Purpose:

```text
detect weakness
identify low-value slots
find candidate replacements
rank improvements
show IN / OUT pair
```

---

# 15. Lab → Production acceptance criteria

A metric should only move to production if all are true:

## Correctness

Known card interactions and counts are correctly detected.

## Stability

Same deck + same algorithm versions = same result within expected simulation variance.

## Explainability

The app can show why the result exists.

## Benchmark validation

Behavior is directionally correct against reference decks.

## Performance

Metric computation is fast enough for normal app usage or cached appropriately.

## Resource usage

No unnecessary LLM calls or repeated semantic reprocessing.

## Failure handling

Unknown or ambiguous cards degrade gracefully instead of inventing results.

## UX value

The metric leads to a useful deck-building conclusion.

---

# 16. Deck Improvement recommendation engine

Do not start from card popularity.

Start from diagnosed weaknesses.

Target flow:

```text
Weak Metric
↓
Cause
↓
Cards contributing least
↓
Candidate cards that improve the weak role
↓
Check legality / colors / curve / synergy
↓
Rank candidates
↓
Present IN / OUT
```

Example:

```text
Problem:
Low graveyard interaction

Evidence:
1 graveyard interaction card

OUT candidate:
Low functional density card

IN candidate:
Card with graveyard interaction + useful secondary role
```

---

# 17. OUT candidate ranking

Potential cut candidates may receive penalties for:

```text
low functional density
low synergy
high effective mana cost
duplicated nonessential role
high dependency
poor simulated usability
```

Potential protection from cuts:

```text
core engine
unique role
critical payoff
commander synergy
high functional density
critical mana source
```

The system should not recommend cutting a card simply because it has a low generic score.

---

# 18. IN candidate ranking

Candidate additions can be ranked by:

```text
weak metric improvement
needed role gain
functional density
mana curve impact
color requirement fit
commander synergy
archetype synergy
dependency risk
legality
budget preference
collection availability
```

Example hidden model:

```text
CandidateScore =
MetricGain
+ RoleGain
+ FunctionalGain
+ SynergyGain
+ CurveGain
- DependencyPenalty
```

Weights should be configurable in Lab.

---

# 19. IN / OUT explanation

Every proposed swap should show:

```text
OUT
Card A

Why:
- low role contribution;
- redundant role;
- weak fit with deck plan.

IN
Card B

Why:
- addresses missing interaction;
- lower mana cost;
- adds secondary utility.

Expected metric impact:
Interaction Coverage: +1 category
Average interaction MV: -0.3
Functional Density: +0.4
```

Card images can be shown using the card-image data already associated with the deck/card database.

---

# 20. What should stay out of the first release

Do not block the project waiting for:

```text
full synergy graph
complete card-pair analysis
opponent simulation
exact combat simulation
exact engine card-output prediction
win-rate simulation
perfect archetype detection
perfect dead-card modeling
universal deck score
```

These are not necessary to deliver strong deck analysis.

---

# 21. Recommended first production metrics

The first metrics promoted from Lab should probably be:

```text
Mana Source Coverage
Mana Reliability
Interaction Density
Interaction Coverage
Functional Card Density
Engine Density
Threat / Payoff Density
Setup / Payoff Balance
Dependency / Redundancy
Early Development
```

These provide the highest combination of:

```text
usefulness
explainability
technical feasibility
low resource cost
```

---

# 22. Recommended initial implementation order

If one agent is implementing the work, use this order:

```text
1. Audit existing ManaShelf data/model
2. Define semantic classification schema
3. Add Lab classification inspector
4. Add cached classification
5. Implement deterministic metrics
6. Validate on benchmark decks
7. Implement mana probability engine
8. Implement lightweight development simulation
9. Validate simulation
10. Add advanced derived metrics
11. Connect validated metrics to Deck Analysis
12. Connect metric weaknesses to Deck Improvement
13. Implement evidence-based IN / OUT recommendations
```

---

# 23. Final architectural rule

ManaShelf should distinguish four things clearly:

## FACT

Example:

```text
The deck contains 2 graveyard interaction cards.
```

## CALCULATION

Example:

```text
Only 2.8% of nonland cards provide graveyard interaction.
```

## INTERPRETATION

Example:

```text
Graveyard coverage is low for this deck profile.
```

## RECOMMENDATION

Example:

```text
Consider adding one flexible graveyard interaction card.
```

These four layers should remain separate in code.

This prevents hidden AI judgment from becoming indistinguishable from objective deck data.

---

# 24. Definition of success

The Lab version succeeds when it can take a decklist and produce an inspectable report such as:

```text
Mana Reliability
GOOD
Evidence: 90% land-drop T3, 87% color requirement success

Interaction Coverage
WEAK
Evidence: 10 interaction cards, only 1 graveyard answer

Functional Density
GOOD
Evidence: 63% of nonland cards perform 2+ relevant roles

Commander Dependency
HIGH
Evidence: 31% of relevant nonland functions directly rely on commander

Early Development
MEDIUM
Evidence: 58% productive T2, 79% productive T3
```

The production version succeeds when those same validated metrics can drive recommendations without introducing a separate opaque scoring system.

---

# 25. Summary

This system is technically realistic if implemented progressively.

### Do first

```text
classification
caching
deterministic metrics
mana probabilities
lightweight development simulation
```

### Do later

```text
synergy
dead-card risk
resilience
closing power
advanced gameplan consistency
```

### Do not attempt

```text
full EDH game simulation
exact win percentage
universal power score
LLM-driven analysis on every request
```

The central architecture should remain:

**Card Facts → Cached Semantic Roles → Deck Metrics → Optional Simulation → Evidence → Recommendation**
