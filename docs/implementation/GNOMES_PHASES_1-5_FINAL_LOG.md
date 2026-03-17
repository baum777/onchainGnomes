# GNOMES Migration — Phases 1–5 Implementation Log

**Completed:** 2025-03-17  
**Repository:** xAi_Bot-App  
**Scope:** Multi-persona gnome civilization system

---

## Overview

All five phases of the GNOMES migration have been implemented and committed. The system supports:

- **Phase 1:** Gnome registry, routing scaffolding, prompt composition, memory primitives
- **Phase 2:** Live multi-gnome pipeline routing with affinity and writeback
- **Phase 3:** Trait evolution, running jokes, swarm/cameo replies, persona integrity
- **Phase 4:** Ensemble orchestration, narrative arcs, autonomy primitives
- **Phase 5:** World state, factions, events, rituals, lore expansion, governance, control

---

## Phase 1: Foundation

### Paths

| Component | Path |
|-----------|------|
| Gnome types | `src/gnomes/types.ts` |
| Registry | `src/gnomes/registry.ts` |
| Loader | `src/gnomes/loadGnomes.ts` |
| Gnome data | `data/gnomes/gorky.yaml`, `moss.yaml`, `spark.yaml` |
| Schema | `schemas/gnome_profile.schema.json` |
| Selector | `src/routing/gnomeSelector.ts` |
| Selector features | `src/routing/selectorFeatures.ts` |
| Continuity | `src/routing/continuityResolver.ts` |
| Prompts | `prompts/fragments/globalSafety.md`, `sharedCanon.md`, `gnomes/gorky.md` |
| Prompt fragments | `src/prompts/promptFragments.ts` |
| Compose gnome prompt | `src/prompts/composeGnomePrompt.ts` |
| Character memory | `src/memory/characterMemory.ts` |
| Shared lore | `src/memory/sharedLoreStore.ts` |
| User affinity | `src/memory/userAffinityStore.ts` |
| Interaction writeback | `src/memory/writeback/interactionWriteback.ts` |
| Config | `src/config/gnomesConfig.ts` |
| Migration | `src/state/migrations/004_gnomes_schema.sql` (gitignored) |

### Tasks

- Gnome foundation, registry, YAML profiles
- Routing scaffolding, selector, continuity resolver
- Prompt composition layer
- Memory primitives (character, shared lore, user affinity)
- Interaction writeback (fire-and-forget)
- Config flags: `GNOMES_ENABLED`, `DEFAULT_SAFE_GNOME`, `GNOME_MEMORY_ENABLED`, etc.
- Integration in `fallbackCascade` when `GNOMES_ENABLED=true`

### Commit

`92e66ad` — feat(gnomes): Phase 1 foundation - registry, routing, prompts, memory, integration

---

## Phase 2: Live Runtime Integration

### Paths

| Component | Path |
|-----------|------|
| Pipeline gnome selection | `src/canonical/pipeline.ts` |
| FallbackCascadeContext | `src/canonical/fallbackCascade.ts` |
| generateFullSpectrum | `src/canonical/fallbackCascade.ts` |
| PipelineResult type | `src/canonical/types.ts` |
| GnomeSelectionForWriteback | `src/canonical/types.ts` |
| Routing writeback | `src/memory/writeback/routingWriteback.ts` |
| Worker integration | `src/worker/pollMentions.ts` |

### Tasks

- Gnome selection in pipeline before `fallbackCascade`
- User affinity per gnome for scoring
- `gnomeSelection` in `FallbackCascadeContext`
- `generateFullSpectrum` uses pre-selection when available
- `gnomeSelection` in `PipelineResult` publish branch
- Worker: `writeRoutingDecision`, `writeInteractionEvent`, `writeReplyOutcome`
- Writeback to `DATA_DIR/gnomes_routing.jsonl`

### Commit

`078eb41` — feat(gnomes): Phase 2 - pipeline gnome selection, affinity, routing writeback

---

## Phase 3: Adaptive Character Evolution

### Paths

| Component | Path |
|-----------|------|
| Evolution signals | `src/evolution/evolutionSignals.ts` |
| Trait bounds validator | `src/evolution/traitBoundsValidator.ts` |
| Trait evolution engine | `src/evolution/traitEvolutionEngine.ts` |
| Persona integrity guard | `src/evolution/personaIntegrityGuard.ts` |
| Joke extractor | `src/memory/jokes/jokeExtractor.ts` |
| Joke store | `src/memory/jokes/jokeStore.ts` |
| Joke scorer | `src/memory/jokes/jokeScorer.ts` |
| Cameo selector | `src/swarm/cameoSelector.ts` |
| Swarm composer | `src/swarm/swarmComposer.ts` |
| Evolution writeback | `src/memory/writeback/evolutionWriteback.ts` |
| Config | `src/config/gnomesConfig.ts` |
| User affinity arcs | `src/memory/userAffinityStore.ts` (RelationshipArcs) |
| Character memory ranking | `src/memory/characterMemory.ts` |
| gnomeSelector cameos | `src/routing/gnomeSelector.ts` |
| Migration | `src/state/migrations/005_gnomes_phase3.sql` (gitignored) |
| Tests | `tests/evolution/traitEvolution.test.ts`, `tests/swarm/swarmComposer.test.ts` |

### Tasks

- Trait evolution engine with bounded adjustments
- Running joke detection (extractor, store, scorer)
- User-gnome relationship arcs (familiarity, rivalry, playful_banter, etc.)
- Character memory ranking (relevance × 0.5 + recency × 0.3 + persona_affinity × 0.2)
- Cameo selector and swarm composer
- Persona integrity guard
- Swarm-aware routing: `cameoCandidates` when thresholds met
- Config: `GNOME_EVOLUTION_ENABLED`, `GNOME_RUNNING_JOKES_ENABLED`, `GNOME_SWARM_ENABLED`, `GNOME_TRAIT_DRIFT_LIMIT`

### Commit

`5ea4ae7` — feat(gnomes): Phase 3 - trait evolution, jokes, swarm, persona guard

---

## Phase 4: Ensemble & Narrative

### Paths

| Component | Path |
|-----------|------|
| Ensemble orchestrator | `src/ensemble/ensembleOrchestrator.ts` |
| Character interaction graph | `src/ensemble/characterInteractionGraph.ts` |
| Ensemble policy | `src/ensemble/ensemblePolicy.ts` |
| Arc manager | `src/narrative/arcManager.ts` |
| Arc state store | `src/narrative/arcStateStore.ts` |
| Arc selector | `src/narrative/arcSelector.ts` |
| Autonomy signals | `src/autonomy/autonomySignals.ts` |
| Autonomy policy | `src/autonomy/autonomyPolicy.ts` |
| Autonomy safety guard | `src/autonomy/autonomySafetyGuard.ts` |
| Config | `src/config/gnomesConfig.ts` |
| Tests | `tests/ensemble/ensembleOrchestrator.test.ts` |

### Tasks

- Ensemble orchestrator (single vs swarm)
- Character relationship graph (rivalry, mentor, teasing, alliance, mockery, respect)
- Narrative arc engine (market_funeral, fake_builder_exposed, liquidity_thirst_cycle, etc.)
- Autonomy layer (extreme absurdity, viral thread, recurring user, arc continuation)
- Autonomy safety guard
- Config: `GNOME_ENSEMBLE_ENABLED`, `GNOME_AUTONOMY_ENABLED`, `GNOME_ARC_ENGINE_ENABLED`, `GNOME_MAX_CAMEOS`

### Commit

`af3be6c` — feat(gnomes): Phase 4 - ensemble orchestrator, narrative arcs, autonomy

---

## Phase 5: Civilization Layer

### Paths

| Component | Path |
|-----------|------|
| World state | `src/world/worldState.ts` |
| World state store | `src/world/worldStateStore.ts` |
| World signals | `src/world/worldSignals.ts` |
| World state reducer | `src/world/worldStateReducer.ts` |
| Faction registry | `src/factions/factionRegistry.ts` |
| Faction policy | `src/factions/factionPolicy.ts` |
| Faction resolver | `src/factions/factionResolver.ts` |
| Faction effects | `src/factions/factionEffects.ts` |
| World event registry | `src/events/worldEventRegistry.ts` |
| World event scheduler | `src/events/worldEventScheduler.ts` |
| World event resolver | `src/events/worldEventResolver.ts` |
| World event effects | `src/events/worldEventEffects.ts` |
| Ritual registry | `src/rituals/ritualRegistry.ts` |
| Ritual selector | `src/rituals/ritualSelector.ts` |
| Ritual effects | `src/rituals/ritualEffects.ts` |
| Lore expansion engine | `src/lore/loreExpansionEngine.ts` |
| Lore candidate generator | `src/lore/loreCandidateGenerator.ts` |
| Lore canonicalizer | `src/lore/loreCanonicalizer.ts` |
| Lore safety guard | `src/lore/loreSafetyGuard.ts` |
| Lore activation policy | `src/lore/canonicalization/loreActivationPolicy.ts` |
| World memory store | `src/memory/civilization/worldMemoryStore.ts` |
| Event memory | `src/memory/civilization/eventMemory.ts` |
| Faction memory | `src/memory/civilization/factionMemory.ts` |
| World governance | `src/governance/worldGovernance.ts` |
| Feature gates | `src/control/featureGates.ts` |
| Operator overrides | `src/control/operatorOverrides.ts` |
| World debug view | `src/control/worldDebugView.ts` |
| Config | `src/config/gnomesConfig.ts` |
| Tests | `tests/world/worldState.test.ts` |

### Tasks

- World state engine (epoch, civilizationMood, activeEventIds, globalHeatLevel)
- Faction system (Ash Circle, Neon Burrow, Root Ledger, Moss Court, Thorn Watch)
- World events (chart_funeral_rite, liquidity_festival, fake_builder_trial, etc.)
- Ritual system (chart funeral blessing, liquidity lament, etc.)
- Lore expansion (candidates, canonicalization, activation policy)
- Civilization memory layer
- World governance (pacing, limits)
- Operator control (feature gates, overrides, debug view)
- Config: `GNOME_WORLD_ENABLED`, `GNOME_FACTIONS_ENABLED`, `GNOME_WORLD_EVENTS_ENABLED`, `GNOME_RITUALS_ENABLED`, `GNOME_LORE_EXPANSION_ENABLED`

### Commit

(Pending)

---

## Summary Directory Structure

```
src/
├── gnomes/
├── routing/
├── prompts/
├── memory/
│   ├── jokes/
│   ├── civilization/
│   └── writeback/
├── evolution/
├── swarm/
├── ensemble/
├── narrative/
├── autonomy/
├── world/
├── factions/
├── events/
├── rituals/
├── lore/
│   └── canonicalization/
├── governance/
└── control/
```

---

## Env Flags (All Phases)

| Flag | Default | Phase |
|------|---------|-------|
| GNOMES_ENABLED | false | 1 |
| DEFAULT_SAFE_GNOME | gorky | 1 |
| GNOME_MEMORY_ENABLED | false | 1 |
| GNOME_ROUTING_DEBUG | false | 1 |
| GNOME_CONTINUITY_ENABLED | true | 1 |
| GNOME_EVOLUTION_ENABLED | false | 3 |
| GNOME_RUNNING_JOKES_ENABLED | false | 3 |
| GNOME_SWARM_ENABLED | false | 3 |
| GNOME_TRAIT_DRIFT_LIMIT | 0.25 | 3 |
| GNOME_ENSEMBLE_ENABLED | false | 4 |
| GNOME_AUTONOMY_ENABLED | false | 4 |
| GNOME_ARC_ENGINE_ENABLED | false | 4 |
| GNOME_MAX_CAMEOS | 2 | 4 |
| GNOME_WORLD_ENABLED | false | 5 |
| GNOME_FACTIONS_ENABLED | false | 5 |
| GNOME_WORLD_EVENTS_ENABLED | false | 5 |
| GNOME_RITUALS_ENABLED | false | 5 |
| GNOME_LORE_EXPANSION_ENABLED | false | 5 |

---

## Test Suites

- `tests/gnomes/registry.test.ts`
- `tests/routing/gnomeSelector.test.ts`
- `tests/memory/interactionWriteback.test.ts`
- `tests/evolution/traitEvolution.test.ts`
- `tests/swarm/swarmComposer.test.ts`
- `tests/ensemble/ensembleOrchestrator.test.ts`
- `tests/world/worldState.test.ts`
