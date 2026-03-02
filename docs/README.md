# Documentation Index

Central entry point for the Gorky Bot project documentation.

> **Single Source of Truth**: Environment variables are documented **only** in `docs/var.README.md`.  
> Do not duplicate variable documentation anywhere else.

---

## 🚀 Getting Started

| Topic | File | Purpose |
|-------|------|---------|
| **Quick Start** | [`docs/QUICKSTART.md`](./QUICKSTART.md) | Install, configure, run locally |
| **Environment Variables** | [`docs/var.README.md`](./var.README.md) | **Single source of truth** for all ENV vars |

---

## 🧠 Core System

| Topic | File | Description |
|-------|------|-------------|
| **Persona** | [`docs/PERSONA.md`](./PERSONA.md) | GORKY character definition, tone rules, hard limits |
| **Adaptive Intelligence** | [`docs/PHASE2_ADAPTIVE_INTELLIGENCE.md`](./PHASE2_ADAPTIVE_INTELLIGENCE.md) | Signals, roast levels, de-escalation |
| **Semantic Intelligence** | [`docs/PHASE3_SEMANTIC_INTELLIGENCE.md`](./PHASE3_SEMANTIC_INTELLIGENCE.md) | Embeddings, clustering, relevance ranking |

---

## 🏗 Architecture

Detailed system structure and component design:

→ [`docs/architecture/`](./architecture/)

Includes:
- System overview
- Data flow
- Component breakdown
- Deployment

---

## 🔄 Workflows

All runtime workflows:

→ [`docs/workflows/`](./workflows/)

Includes:
- [Mention handling](./workflows/mention-handling.md)
- [Image generation (Replicate)](./workflows/image-generation.md)

---

## 📜 Decisions (ADRs)

Architectural Decision Records:

→ [`docs/decisions/`](./decisions/)

---

## 📎 Appendix

Supporting documents for persona development:

| Topic | File |
|-------|------|
| **Lore** | [`docs/LORE.md`](./LORE.md) |
| **Voice Guide** | [`docs/VOICE_GUIDE.md`](./VOICE_GUIDE.md) |
| **Style Guide** | [`docs/appendix/GORKY_IMAGE_STYLE_GUIDE.md`](./appendix/GORKY_IMAGE_STYLE_GUIDE.md) |
| **Humor Patterns** | [`docs/appendix/GORKY_HUMOR_PATTERNS.md`](./appendix/GORKY_HUMOR_PATTERNS.md) |

---

## ⚠️ Governance Rules

To prevent documentation drift:

| What | Where |
|------|-------|
| Environment variables | **Only** `docs/var.README.md` |
| Setup instructions | **Only** `docs/QUICKSTART.md` |
| Workflows | `docs/workflows/` |
| Architecture | `docs/architecture/` |

**Deprecated:** `docs/RUN.md` → Use [`QUICKSTART.md`](./QUICKSTART.md) instead.

---

## 🗂 Directory Structure

```
docs/
├── README.md                      # This file
├── QUICKSTART.md                  # Start here
├── var.README.md                  # ENV vars (SSOT)
├── PERSONA.md                     # Character definition
├── PHASE2_ADAPTIVE_INTELLIGENCE.md
├── PHASE3_SEMANTIC_INTELLIGENCE.md
├── RUN.md                         # Deprecated (redirect only)
├── architecture/                 # System design
│   ├── 01-overview.md
│   ├── 02-components.md
│   ├── 03-data-flow.md
│   └── 04-deployment.md
├── workflows/                     # Runtime workflows
│   ├── mention-handling.md
│   └── image-generation.md
├── decisions/                     # ADRs
│   ├── 001-sqlite-for-mvp.md
│   ├── 002-prompt-yaml-format.md
│   └── 003-workflow-engine.md
├── appendix/                      # Supporting docs
│   ├── GORKY_IMAGE_STYLE_GUIDE.md
│   ├── GORKY_HUMOR_PATTERNS.md
│   └── ...
└── changelog/                     # Version history
    └── CHANGELOG.md
```

---

## 🔄 Recent Changes

See [`docs/changelog/CHANGELOG.md`](./changelog/CHANGELOG.md) for version history.
