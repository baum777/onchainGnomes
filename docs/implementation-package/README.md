# Gorky Bot — Implementation Package

Implementation package for the Gorky crypto-native X/Twitter reply agent. Aligned with the approved architecture in `gorky_bot_production_blueprint`.

**Master document:** [GORKY_IMPLEMENTATION_PACKAGE.md](./GORKY_IMPLEMENTATION_PACKAGE.md) — full blueprint (assumptions, files to add/touch, integration notes, risks, delivery checklist).

## Contents

| Document | Description |
|----------|-------------|
| [REPO_TREE.md](./REPO_TREE.md) | Repository structure and file map |
| [MODULE_RESPONSIBILITIES.md](./MODULE_RESPONSIBILITIES.md) | Module responsibilities and boundaries |
| [INTERFACE_CONTRACTS.md](./INTERFACE_CONTRACTS.md) | Interface contracts and type definitions |
| [ROLLOUT_CHECKLIST.md](./ROLLOUT_CHECKLIST.md) | Operational rollout checklist |
| [INTEGRATION_NOTES.md](./INTEGRATION_NOTES.md) | Pipeline/worker integration points |
| [GORKY_IMPLEMENTATION_PACKAGE.md](./GORKY_IMPLEMENTATION_PACKAGE.md) | Master blueprint (full spec) |
| [PHASE5_RESPONSE_QUALITY.md](./PHASE5_RESPONSE_QUALITY.md) | Phase 5: Response quality & launch readiness |
| [LAUNCH_READINESS_CHECKLIST.md](./LAUNCH_READINESS_CHECKLIST.md) | Quality gates and rollout criteria |

## Supporting Artifacts

| Path | Description |
|------|-------------|
| `schemas/gorky/` | JSON schemas (mention_signal, normalized_event, safety_result, relevance_result, narrative_result, pattern_selection, format_decision, llm_generation_request, validation_result, publish_result, analytics_log) |
| `config/gorky.yaml` | Gorky-specific configuration |
| `config/default.yaml` | Rollout stages, feature flags |
| `src/gorky/publishDecision.ts` | Publish decision skeleton |
| `docs/implementation-package/CODE_SKELETONS.md` | Pseudocode → code mapping |
| `tests/gorky/` | Test scaffolding, fixtures, integration, safety |

## Quick Reference

- **Entry**: `src/index.ts` → `runWorkerLoop()`
- **Pipeline**: `src/canonical/pipeline.ts` → `handleEvent()`
- **Config**: `config/default.yaml`, `config/gorky.yaml`, env vars
