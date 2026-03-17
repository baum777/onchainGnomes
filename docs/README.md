# Documentation Index

Central entry point for the xAi Bot (GORKY_ON_SOL) project documentation.

> **Single Source of Truth**: Environment variables are documented **only** in [`docs/operations/var.README.md`](./operations/var.README.md).  
> Do not duplicate variable documentation anywhere else.

---

## Getting Started

| Topic | File | Purpose |
|-------|------|---------|
| **Quick Start** | [`docs/operations/QUICKSTART.md`](./operations/QUICKSTART.md) | Install, configure, run locally |
| **Environment Variables** | [`docs/operations/var.README.md`](./operations/var.README.md) | **Single source of truth** for all ENV vars |

---

## Core System

| Topic | File | Description |
|-------|------|-------------|
| **Persona** | [`docs/lore/PERSONA.md`](./lore/PERSONA.md) | GORKY character definition, tone rules, hard limits |
| **Lore** | [`docs/lore/LORE.md`](./lore/LORE.md) | Origin story, world canon |
| **Voice Guide** | [`docs/lore/VOICE_GUIDE.md`](./lore/VOICE_GUIDE.md) | Style and voice behavior |
| **Adaptive Intelligence** | [`docs/implementation/PHASE2_ADAPTIVE_INTELLIGENCE.md`](./implementation/PHASE2_ADAPTIVE_INTELLIGENCE.md) | Signals, roast levels, de-escalation |
| **Semantic Intelligence** | [`docs/implementation/PHASE3_SEMANTIC_INTELLIGENCE.md`](./implementation/PHASE3_SEMANTIC_INTELLIGENCE.md) | Embeddings, clustering, relevance ranking |

---

## Architecture

Detailed system structure and component design:

→ [`docs/architecture/`](./architecture/)

- [01-overview.md](./architecture/01-overview.md) — System overview
- [02-components.md](./architecture/02-components.md) — Component breakdown
- [03-data-flow.md](./architecture/03-data-flow.md) — Data flow
- [04-deployment.md](./architecture/04-deployment.md) — Deployment
- [05-context-engine.md](./architecture/05-context-engine.md) — Context Engine design

---

## Implementation

Phased implementation prompts, GNOMES migration, and execution specs:

→ [`docs/implementation/`](./implementation/)

- PHASE1–PHASE5 implementation prompts
- DEVIATIONS_FROM_BUNDLE.md — Bundle vs implementation alignment
- GNOMES_PHASES_1-5_FINAL_LOG.md — Implementation log

---

## Operations

Runbooks, deployment, environment, and monitoring:

→ [`docs/operations/`](./operations/)

- [QUICKSTART.md](./operations/QUICKSTART.md)
- [var.README.md](./operations/var.README.md) — ENV vars (SSOT)
- [runbook.md](./operations/runbook.md)
- [monitoring.md](./operations/monitoring.md)
- [debugging.md](./operations/debugging.md)

---

## Testing

Testing guides, LLM fingerprinting, harness usage:

→ [`docs/testing/`](./testing/)

- [LLM_TESTING_HOWTO.md](./testing/LLM_TESTING_HOWTO.md) — Terminal LLM testing
- [llm_behavior_fingerprinting.md](./testing/llm_behavior_fingerprinting.md) — Drift detection

See also: `llm-terminal-test-bundle/`, `llm_test_database_bundle/`, `scripts/scenarios/README.md`, `tests/gorkypf/fixtures/README.md`.

---

## Workflows

Runtime workflows:

→ [`docs/workflows/`](./workflows/)

- [README.md](./workflows/README.md)
- [Mention handling](./workflows/mention-handling.md)
- [Image generation (Replicate)](./workflows/image-generation.md)
- [Autonomous posting](./workflows/autonomous-posting.md)

---

## Lore & Persona

Persona, lore canon, voice, and style guides:

→ [`docs/lore/`](./lore/)

- [PERSONA.md](./lore/PERSONA.md)
- [LORE.md](./lore/LORE.md)
- [VOICE_GUIDE.md](./lore/VOICE_GUIDE.md)
- [GORKY_IMAGE_STYLE_GUIDE.md](./lore/GORKY_IMAGE_STYLE_GUIDE.md)
- [GORKY_HUMOR_PATTERNS.md](./lore/GORKY_HUMOR_PATTERNS.md)

---

## Audits

Codebase audits, production readiness, hardening reports:

→ [`docs/audits/`](./audits/)

- [README.md](./audits/README.md)
- [docs-canonicalization-report.md](./audits/docs-canonicalization-report.md)

---

## Reference

Blueprint, bundles, external specs, and background material:

→ [`docs/reference/`](./reference/)

- Command DSL, Whitepaper
- `gnomes_master_spec_bundle.zip` (root) — GNOMES master spec (indexed here)
- `onchain-blueprint/` (root) — Solana truth layer
- Prompt evolution and task prompts

---

## Archive

Historical and deprecated documentation:

→ [`docs/archive/`](./archive/)

---

## Decisions (ADRs)

Architectural Decision Records:

→ [`docs/decisions/`](./decisions/)

- [README.md](./decisions/README.md)

---

## Changelog

Version history:

→ [`docs/changelog/`](./changelog/)

- [README.md](./changelog/README.md)
- [CHANGELOG.md](./changelog/CHANGELOG.md)

---

## Governance Rules

| What | Where |
|------|-------|
| Environment variables | **Only** `docs/operations/var.README.md` |
| Setup instructions | **Only** `docs/operations/QUICKSTART.md` |
| Workflows | `docs/workflows/` |
| Architecture | `docs/architecture/` |

---

## Directory Structure

```
docs/
├── README.md
├── architecture/       # System design
├── implementation/     # Phase prompts, migration
├── operations/         # Runbook, env, deployment
├── testing/            # Testing guides
├── lore/               # Persona, lore, voice
├── audits/             # Audits, reviews
├── reference/          # Blueprint, bundles, prompts
├── archive/            # Historical docs
├── workflows/          # Runtime workflows
├── decisions/          # ADRs
└── changelog/          # Version history
```
