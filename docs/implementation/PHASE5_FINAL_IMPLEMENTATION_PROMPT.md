# PHASE-5 FINAL IMPLEMENTATION PROMPT
## Gnome Civilization Layer, World Events, Factions, and Autonomous Lore Expansion

---

# SYSTEM ROLE

You are a senior software engineer operating in autonomous implementation mode inside a production-oriented repository.

You are continuing the GNOMES migration.

Previous phases established:

- PHASE-1: foundation layer
- PHASE-2: live multi-gnome runtime routing
- PHASE-3: adaptive character evolution and relationship memory
- PHASE-4: ensemble orchestration, narrative arcs, and autonomy primitives

PHASE-5 is the final system phase.

The goal is to transform the GNOMES runtime from a multi-persona reply engine into a **persistent gnome civilization layer** with world-state, factions, rituals, event cycles, and bounded autonomous lore expansion.

The output must still remain safe, deterministic where required, platform-compatible, and operationally controllable.

---

# PRIMARY SOURCE OF TRUTH

The repository root contains:

```text
gnomes_master_spec_bundle.zip
```

This bundle remains the canonical source for:

- core architecture
- routing assumptions
- memory model
- database model
- gnome definitions
- character evolution rules

PHASE-5 extends that architecture without violating prior contracts.

If conflicts occur, use this priority order:

1. `specs/MASTER_SPEC.md`
2. JSON schemas
3. `database/schema.sql`
4. config definitions
5. examples
6. prior implementation prompts and repository conventions

---

# PHASE-5 OBJECTIVE

Introduce a controlled **civilization simulation layer** that allows the GNOMES system to feel like a living world.

After PHASE-5 the system should support:

- persistent world-state
- faction membership and faction tone
- market rituals and recurring event cycles
- world events that influence routing and tone
- autonomous lore expansion under strict rules
- gnome-to-gnome ideological differences
- society-level continuity across many interactions

This must never degrade into uncontrolled randomness or unsafe autonomous posting behavior.

---

# CORE PRINCIPLE

The GNOMES system is now composed of five nested layers:

1. **Character Layer**  
   Individual gnome identity, traits, memories, relationships.

2. **Ensemble Layer**  
   Multi-gnome interactions, cameos, role switching, thread continuity.

3. **Narrative Layer**  
   Recurring arcs like market funerals, rug cope cycles, fake builder exposure.

4. **World Layer**  
   Shared events, world-state, rituals, factional moods, civilization motifs.

5. **Governance Layer**  
   Safety, pacing, determinism, anti-spam, bounded autonomy, auditability.

PHASE-5 primarily implements layers 4 and 5 while integrating cleanly with layers 1–3.

---

# FEATURE SET

---

# 1. WORLD STATE ENGINE

Create:

```text
src/world/
```

Files:

```text
src/world/worldState.ts
src/world/worldStateStore.ts
src/world/worldSignals.ts
src/world/worldStateReducer.ts
```

Responsibilities:

- maintain shared world-state for the gnome civilization
- update global mood and active motifs
- store ongoing world conditions influenced by market patterns and prior events
- expose bounded world context to routing, prompting, and ensemble logic

Example world-state fields:

```ts
type WorldState = {
  epoch: string;
  civilizationMood: "mournful" | "feral" | "mocking" | "ritual" | "chaotic" | "builder_skeptic";
  activeEventIds: string[];
  activeFactionTensions: string[];
  activeMyths: string[];
  globalHeatLevel: number;
  updatedAt: string;
};
```

The world-state must be compact, queryable, and auditable.

---

# 2. FACTION SYSTEM

Create:

```text
src/factions/
```

Files:

```text
src/factions/factionRegistry.ts
src/factions/factionPolicy.ts
src/factions/factionResolver.ts
src/factions/factionEffects.ts
```

Purpose:

Group gnomes into worldview clusters or symbolic camps.

Possible faction examples:

- **Ash Circle** — funeral, memory, collapse, post-rug priests
- **Neon Burrow** — manic meme chaos, velocity, ape/jeet energy
- **Root Ledger** — skeptical builders, receipts, anti-fake-tech observers
- **Moss Court** — dry ancient witnesses, detached irony, ruins and cycles
- **Thorn Watch** — defensive anti-manipulation, disciplined hostility control

Each faction may influence:

- phrase choice
- cameo patterns
- event interpretation
- rivalry dynamics
- world-event participation

Factions must not override core persona identity.
They add contextual flavor and world continuity.

---

# 3. WORLD EVENTS ENGINE

Create:

```text
src/events/
```

Files:

```text
src/events/worldEventRegistry.ts
src/events/worldEventScheduler.ts
src/events/worldEventResolver.ts
src/events/worldEventEffects.ts
```

Purpose:

Model symbolic recurring world events that color replies and ensemble behavior.

Initial event classes:

- `chart_funeral_rite`
- `liquidity_festival`
- `fake_builder_trial`
- `copium_season`
- `ashen_revival_cycle`
- `thirst_moon`
- `dead_cat_parade`

Each event should define:

- trigger conditions
- start / end rules
- affected gnomes / factions
- tone effects
- allowed motifs
- prompt fragments

Events may be tied to:

- market energy
- narrative arc prevalence
- volume of certain intents
- repeat mentions from specific user clusters

Events must remain optional and bounded.

---

# 4. RITUAL SYSTEM

Create:

```text
src/rituals/
```

Files:

```text
src/rituals/ritualRegistry.ts
src/rituals/ritualSelector.ts
src/rituals/ritualEffects.ts
```

Purpose:

Represent recurring civilization behaviors that show up as stylistic overlays rather than literal roleplay.

Examples:

- chart funeral blessing
- liquidity lament
- builder skepticism rite
- post-rug ash reading
- degenerate victory chant

Rituals should affect:

- phrasing motifs
- cadence
- word choice
- emoji / punctuation tendencies if the platform strategy allows them

Rituals must never push replies over safety or length limits.

---

# 5. AUTONOMOUS LORE EXPANSION

Create:

```text
src/lore/
```

Files:

```text
src/lore/loreExpansionEngine.ts
src/lore/loreCandidateGenerator.ts
src/lore/loreCanonicalizer.ts
src/lore/loreSafetyGuard.ts
```

Purpose:

Allow the system to generate **candidate lore fragments** based on repeated motifs and world events.

Examples of allowed expansions:

- naming a recurring collapse pattern
- creating a symbolic holiday around repeated chart funerals
- adding a civilization proverb if it naturally emerged repeatedly

All lore expansion must be:

- summarized
- reviewable
- bounded by canonical rules
- non-defamatory
- non-political unless explicitly already part of the safe existing canon

No uncontrolled freeform myth generation should directly alter live prompts.

All new lore must pass canonicalization and safety checks before activation.

---

# 6. CANONICALIZATION PIPELINE FOR NEW LORE

Create:

```text
src/lore/canonicalization/
```

Files:

```text
src/lore/canonicalization/loreReviewQueue.ts
src/lore/canonicalization/loreActivationPolicy.ts
src/lore/canonicalization/loreVersioning.ts
```

Purpose:

Separate generated lore candidates from active lore.

Required lore states:

- `candidate`
- `reviewed`
- `approved`
- `active`
- `archived`
- `rejected`

Only `active` lore may influence runtime prompts.

The activation pipeline must be explicit and logged.

---

# 7. CIVILIZATION MEMORY LAYER

Create:

```text
src/memory/civilization/
```

Files:

```text
src/memory/civilization/worldMemoryStore.ts
src/memory/civilization/eventMemory.ts
src/memory/civilization/factionMemory.ts
```

Purpose:

Store higher-order shared history that belongs neither to a single gnome nor only to a single user interaction.

Examples:

- the last three major chart funeral eras
- which faction dominated recent meme chaos
- which ritual styles were recently overused
- recurring users who became part of civilization myths

Memory must remain summarized and privacy-conscious.

---

# 8. SOCIETY-LEVEL ROUTING INFLUENCE

Enhance routing so that gnome selection may also consider:

- current world-state
- active faction dynamics
- event overlays
- civilization mood
- overuse balancing

Example:

- during `chart_funeral_rite`, EMBER and MOSS become more likely
- during `liquidity_festival`, SPARK and WINK become more likely
- during `fake_builder_trial`, GRIT and BURL gain higher routing weight

This must remain a weighted influence, not a hard override.

---

# 9. WORLD-AWARE ENSEMBLE ORCHESTRATION

Enhance the ensemble layer so cameos and swarm replies can be influenced by:

- faction synergy
- active world events
- narrative arcs
- prior rivalry patterns

Example:

- GORKY + SPARK during feral meme cycles
- MOSS + EMBER during chart funeral cycles
- GRIT + THORN during anti-manipulation callouts

Use strict pacing limits to prevent gimmick overload.

---

# 10. WORLD EVENT PACING + GOVERNANCE

Create:

```text
src/governance/worldGovernance.ts
```

Responsibilities:

- limit event frequency
- prevent constant high-intensity overlays
- rotate motifs to avoid repetition
- cap swarm / cameo frequency
- prevent lore pollution and tonal collapse

The world simulation must feel coherent, not noisy.

---

# 11. OPERATOR CONTROL SURFACE

Create:

```text
src/control/
```

Files:

```text
src/control/operatorOverrides.ts
src/control/worldDebugView.ts
src/control/featureGates.ts
```

Purpose:

Provide operational control for:

- enabling / disabling world events
- pausing lore expansion
- forcing safe mode
- resetting or archiving unstable world-state
- inspecting active faction and event overlays

This is critical for production safety.

---

# 12. VISUALIZATION / DEBUG OUTPUT

If the codebase already includes diagnostics or audit reporting, extend it to expose:

- active world-state
- active events
- selected gnome + faction
- narrative arc
- ritual overlays
- lore candidates pending review

Do not expose sensitive internals in public outputs.
Use this only for operator/debug surfaces.

---

# DATABASE EXTENSIONS

Use existing migration infrastructure if present.

Add required support tables such as:

```text
factions
faction_memberships
character_relationships
world_state_snapshots
world_events
world_event_activations
rituals
ritual_usage_events
lore_candidates
lore_versions
lore_activation_log
civilization_memory_items
```

These tables should reference where relevant:

```text
gnome_id
faction_id
interaction_event_id
conversation_id
user_id
arc_id
```

Prefer relational structure with JSONB for bounded metadata fields.

---

# CONFIGURATION ADDITIONS

Add environment/config flags such as:

```text
GNOME_WORLD_ENABLED=true
GNOME_FACTIONS_ENABLED=true
GNOME_WORLD_EVENTS_ENABLED=true
GNOME_RITUALS_ENABLED=true
GNOME_LORE_EXPANSION_ENABLED=false
GNOME_LORE_AUTO_ACTIVATION=false
GNOME_WORLD_DEBUG=false
GNOME_MAX_ACTIVE_WORLD_EVENTS=2
GNOME_MAX_ACTIVE_RITUAL_OVERLAYS=1
```

Defaults should be conservative.

Autonomous lore auto-activation should default to disabled unless the repository already supports a trusted review flow.

---

# SAFETY RULES

The civilization layer must never:

- create defamatory pseudo-facts about real people
- generate targeted harassment narratives
- store private or identifying user details beyond existing safe profile patterns
- create extremist or hateful faction metaphors
- collapse into repetitive spammy roleplay
- override existing financial-advice and platform-safety constraints

All generated lore and world-state effects must remain commentary-oriented, symbolic, and bounded.

---

# TESTING REQUIREMENTS

Add or update tests for the new world systems.

## Unit

- world-state reducer
- faction resolver
- event activation logic
- ritual selector
- lore canonicalization transitions
- world governance pacing

## Integration

- world-state influences gnome selection correctly
- active events influence prompt composition
- lore candidates remain inactive until approved
- faction overlays stay compatible with selected gnome voice
- operator overrides disable autonomous systems cleanly

## Regression

- single-gnome mode still works
- GORKY-only legacy behavior still works when world features are disabled
- prompt length and safety remain intact
- no uncontrolled reply amplification occurs

Suggested test locations:

```text
tests/world/
tests/factions/
tests/events/
tests/lore/
tests/governance/
tests/regression/
```

---

# REQUIRED DELIVERABLES

By the end of PHASE-5, the repository should support:

1. a persistent world-state layer
2. faction-aware routing and ensemble behavior
3. recurring world events and rituals
4. bounded lore candidate generation and review flow
5. civilization-level memory
6. operator controls and debug visibility
7. full backward compatibility with conservative fallbacks

The bot should now feel like a **living, persistent, internally coherent gnome civilization**.

---

# APPENDIX A
## Mandatory Handling of `gnomes_master_spec_bundle.zip`

The file:

```text
gnomes_master_spec_bundle.zip
```

must be treated as active implementation context.

Mandatory procedure:

1. unpack the bundle in the repository context
2. inspect:
   - `specs/`
   - `database/`
   - `schemas/`
   - `data/`
   - `config/`
   - `examples/`
3. validate all gnome profiles against schemas
4. align world/faction/event additions with existing canonical architecture
5. document any deliberate deviations

Do not ignore the bundle.
Do not guess structures already defined there.

---

# APPENDIX B
## Target Runtime Flow After PHASE-5

The conceptual runtime flow should now become:

```text
Mention Ingest
  -> Event Analysis
  -> User / Thread Context Fetch
  -> World-State Fetch
  -> Faction / Event Overlay Resolution
  -> Gnome Selection
  -> Continuity Resolution
  -> Character + Relationship + Civilization Memory Retrieval
  -> Response Mode Resolution
  -> Ensemble / Cameo Decision
  -> Ritual / Event Prompt Overlay
  -> Gnome Prompt Composition
  -> Candidate Generation
  -> Safety Validation
  -> Final Reply Selection
  -> Publish Decision
  -> Interaction / Routing / World Writeback
  -> Lore Candidate Generation (optional)
  -> Canonical Review Queue Update
```

This flow should remain modular and observable.

---

# APPENDIX C
## Target Directory Structure After PHASE-5

```text
src
 ├─ gnomes/
 ├─ routing/
 ├─ prompts/
 ├─ memory/
 │   ├─ civilization/
 │   └─ writeback/
 ├─ evolution/
 ├─ swarm/
 ├─ ensemble/
 ├─ narrative/
 ├─ autonomy/
 ├─ world/
 ├─ factions/
 ├─ events/
 ├─ rituals/
 ├─ lore/
 │   └─ canonicalization/
 ├─ governance/
 └─ control/
```

Adapt to repository conventions, but preserve responsibility boundaries.

---

# APPENDIX D
## Definition of Success

PHASE-5 is successful when:

- the system no longer feels like a renamed single-persona bot
- gnomes behave like members of a coherent social world
- world-state and events add continuity without creating chaos
- lore can expand in a bounded and reviewable way
- operators retain control over all autonomous features
- safety, backward compatibility, and runtime stability remain intact

This phase completes the transformation into a **multi-character, memory-backed, ensemble-driven, world-aware GNOME civilization system**.

