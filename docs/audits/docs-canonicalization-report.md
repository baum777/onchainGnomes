# Documentation Canonicalization Report

**Date:** 2026-03-17  
**Scope:** Repository-wide documentation restructure  
**Context:** GNOMES multi-character migration; path-based canonicalization

---

## Executive Summary

The documentation was fully canonicalized per the path-based structure. Root docs were moved into domain folders; implementation-package was archived; lore, testing, operations, audits, and reference domains were established. All links were updated. The repository now has a clear single-source-of-truth per domain.

---

## Canonical Docs by Domain

| Domain | Canonical Docs | Location |
|--------|----------------|----------|
| **Repository overview** | README.md | Root |
| **Docs index** | README.md | docs/ |
| **Architecture** | 01-overview, 02-components, 03-data-flow, 04-deployment, 05-context-engine | docs/architecture/ |
| **Implementation** | PHASE1–5 prompts, DEVIATIONS_FROM_BUNDLE, GNOMES_PHASES_1-5_FINAL_LOG | docs/implementation/ |
| **Operations** | QUICKSTART, var.README (SSOT for ENV), runbook, monitoring, debugging | docs/operations/ |
| **Testing** | LLM_TESTING_HOWTO, llm_behavior_fingerprinting | docs/testing/ |
| **Lore & Persona** | PERSONA, LORE, VOICE_GUIDE, GORKY_IMAGE_STYLE_GUIDE, GORKY_HUMOR_PATTERNS | docs/lore/ |
| **Audits** | codebase-audit, hardening-report, PRODUCTION_READINESS_REVIEW | docs/audits/ |
| **Reference** | command_dsl, WHITEPAPER, prompts/*, bundles index | docs/reference/ |

---

## Moved Files (Old → New)

### Root → docs/

| Old Path | New Path |
|----------|----------|
| HARDENING_REPORT.md | docs/audits/hardening-report.md |
| LLM_TESTING_HOWTO.md | docs/testing/LLM_TESTING_HOWTO.md (was already in docs/testing) |

### docs/ (loose) → domain folders

| Old Path | New Path |
|----------|----------|
| docs/QUICKSTART.md | docs/operations/QUICKSTART.md |
| docs/var.README.md | docs/operations/var.README.md |
| docs/LORE.md | docs/lore/LORE.md |
| docs/PERSONA.md | docs/lore/PERSONA.md |
| docs/VOICE_GUIDE.md | docs/lore/VOICE_GUIDE.md |
| docs/ARCHITECTURE_CONTEXT_ENGINE.md | docs/architecture/05-context-engine.md |
| docs/STATE_DATA_SEPARATION.md | docs/operations/STATE_DATA_SEPARATION.md |
| docs/command_dsl.md | docs/reference/command_dsl.md |
| docs/llm_behavior_fingerprinting.md | docs/testing/llm_behavior_fingerprinting.md |
| docs/WHITEPAPER_PRODUCTION_AGENT_PLATFORM.md | docs/reference/WHITEPAPER_PRODUCTION_AGENT_PLATFORM.md |
| docs/AUTPOST_STRATEGY.md | docs/implementation/AUTPOST_STRATEGY.md |
| docs/MIGRATION_AUDIT.md | docs/archive/audits/MIGRATION_AUDIT.md |
| docs/PRODUCTION_READINESS_REVIEW.md | docs/audits/PRODUCTION_READINESS_REVIEW.md |
| docs/PHASE1_LAUNCH_SAFETY.md | docs/implementation/PHASE1_LAUNCH_SAFETY.md |
| docs/PHASE2_ADAPTIVE_INTELLIGENCE.md | docs/implementation/PHASE2_ADAPTIVE_INTELLIGENCE.md |
| docs/PHASE3_SEMANTIC_INTELLIGENCE.md | docs/implementation/PHASE3_SEMANTIC_INTELLIGENCE.md |
| docs/appendix/GORKY_IMAGE_STYLE_GUIDE.md | docs/lore/GORKY_IMAGE_STYLE_GUIDE.md |
| docs/appendix/GORKY_HUMOR_PATTERNS.md | docs/lore/GORKY_HUMOR_PATTERNS.md |
| docs/prompts/*.md | docs/reference/prompts/*.md |

### docs/launch/ → operations & archive

| Old Path | New Path |
|----------|----------|
| docs/launch/checklist.md | docs/operations/launch_checklist.md |
| docs/launch/launch_runbook.md | docs/operations/launch_runbook.md |
| docs/launch/LAUNCH_EXECUTION_REPORT.md | docs/archive/operations/LAUNCH_EXECUTION_REPORT.md |

### docs/implementation-package/ → archive

All 14 files → docs/archive/implementation-package/

### docs/audit/ → docs/audits/

| Old Path | New Path |
|----------|----------|
| docs/audit/codebase-audit-2026-03-09.md | docs/audits/codebase-audit-2026-03-09.md |

---

## Renamed Files

| Old Path | New Path |
|---------|----------|
| docs/implementation/phase_4_implementation_prompt.md | docs/implementation/PHASE4_IMPLEMENTATION_PROMPT.md |
| docs/implementation/phase_5_final_implementation_prompt.md | docs/implementation/PHASE5_FINAL_IMPLEMENTATION_PROMPT.md |

---

## Deleted / Removed

- **docs/RUN.md** — Did not exist (already deleted previously)
- **docs/appendix/** — Emptied and removed after moving content to docs/lore/
- **docs/launch/** — Emptied and removed after moving content
- **docs/implementation-package/** — Emptied and removed after moving to archive
- **docs/audit/** — Replaced by docs/audits/
- **docs/prompts/** — Emptied and removed after moving to docs/reference/prompts/

---

## Archived Docs

| Location | Contents |
|----------|----------|
| docs/archive/implementation-package/ | GORKY Implementation Package (14 docs) |
| docs/archive/audits/ | MIGRATION_AUDIT.md |
| docs/archive/operations/ | LAUNCH_EXECUTION_REPORT.md |

---

## External / Indexed (not moved)

| Path | Role |
|------|------|
| onchain-blueprint/ | Root; indexed in docs/reference/ |
| gnomes_master_spec_bundle.zip | Root; indexed in docs/reference/ (present in repo) |
| llm-terminal-test-bundle/ | Testing harness; linked from docs/testing/ |
| llm_test_database_bundle/ | Prompt DB; linked from docs/testing/ |
| memes/docs/MEME_SYSTEM.md | Linked from docs/reference/ |
| scripts/scenarios/README.md | Linked from docs/testing/ |
| tests/gorkypf/fixtures/README.md | Linked from docs/testing/ |
| legacy/README.md | Linked from docs/reference/ |

---

## Link Updates Performed

- docs/README.md — Full restructure; removed RUN.md reference
- README.md (root) — Documentation table updated to new paths
- docs/workflows/image-generation.md — var.README path
- docs/testing/LLM_TESTING_HOWTO.md — llm_behavior_fingerprinting path
- docs/operations/QUICKSTART.md — var.README, PERSONA, PHASE2/3 paths
- docs/audits/hardening-report.md — var.README path
- docs/audits/codebase-audit-2026-03-09.md — Paths updated; Kanonisierungs-Hinweis ergänzt
- docs/archive/implementation-package/* — Internal paths updated to archive location

---

## Unresolved Ambiguities

None. All planned moves and renames were executed.

---

## Recommendations for Future Doc Maintenance

1. **Single source of truth per domain** — Do not create duplicate ENV or setup docs; use docs/operations/var.README.md and docs/operations/QUICKSTART.md.
2. **New docs placement** — Follow path-based rules: architecture/, implementation/, operations/, testing/, lore/, audits/, reference/.
3. **Deprecation** — Move superseded docs to docs/archive/ with subfolder (implementation/, audits/, operations/).
4. **Bundle** — gnomes_master_spec_bundle.zip is present; when updating GNOMES implementation, reconcile extracted contents with docs/implementation/DEVIATIONS_FROM_BUNDLE.md.
5. **Index updates** — When adding new docs, update the relevant README (docs/README.md or subdirectory README).
