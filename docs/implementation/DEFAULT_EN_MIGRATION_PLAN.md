# Repo-Wide Default Language Migration Plan (`en`)

## 1. Migration Goal
- Migrate active canonical repo content to English default (`en`).
- Include: canonical docs, GNOMES canon/runtime text fields, prompt fragments, lore units, language-sensitive regression assets.
- Exclude: archival historical bundles unless promoted to active canon, external contract-bound payload formats.
- Target state: one active canonical language for SSOT and prompt-driving assets: English.

## 2. Repo-Wide Language Assessment
- Mixed-language state exists across prompt fragments, lore units, and regression fixtures.
- Highest risk zones:
  - Prompt safety/canon fragments (`prompts/fragments/*`) that directly alter generation behavior.
  - Lore retrieval units (`memory/lore/*.jsonl`) that inject runtime context.
  - Regression expectations in `tests/prompts/*.jsonl` that encode voice constraints.
- Canonical migration is mandatory for GNOMES SSOT docs and active prompt-affecting artifacts.

## 3. Language Migration Policy
- Translate when semantic intent is stable and direct.
- Re-author (not literal translation) for safety rails, anti-advice constraints, and voice definitions.
- Archive-only German text may remain if explicitly labeled non-canonical.
- SSOT rule: each canonical file has one authoritative English version.
- Prompt rule: preserve guardrail semantics first, style second.
- Test rule: update language-sensitive assertions to English while preserving behavioral intent.
- Runtime-sensitive rule: avoid changing field keys/contracts; migrate values conservatively.

## 4. Workstreams
### WS1 — Canon & Docs migration
- Goal: English-only active GNOMES canon.
- Scope: `docs/lore/GNOMES_*`, ADR, lore README links.
- Risks: semantic drift in governance wording.
- Dependencies: none.

### WS2 — Prompt & Persona migration
- Goal: English prompt-facing role voices and shared canon constraints.
- Scope: `prompts/fragments/sharedCanon.md`, `prompts/fragments/gnomes/*.md`.
- Risks: accidental safety weakening.
- Dependencies: WS1.

### WS3 — Runtime-sensitive text migration
- Goal: English defaults in runtime profile textual fields.
- Scope: `data/gnomes/*.yaml` text fields only.
- Risks: key/schema drift if structure changes.
- Dependencies: WS1.

### WS4 — Test/fixture migration
- Goal: align language-sensitive regression assets with English canon.
- Scope: `tests/prompts/gnomes_matrix_regression.jsonl`.
- Risks: false negatives from changed wording only.
- Dependencies: WS2, WS3.

### WS5 — Archive/redirect cleanup
- Goal: avoid dual active language authority.
- Scope: add deprecation notes when German canon remains in active paths.
- Risks: hidden duplicate SSOT.
- Dependencies: WS1.

### WS6 — Governance update
- Goal: codify English-as-default repo policy.
- Scope: governance/canon docs.
- Risks: incomplete policy enforcement in future PRs.
- Dependencies: WS1.

## 5. Ordered Task Plan
| task_id | title | goal | actions | files_to_create | files_to_modify | files_to_archive_or_deprecate | dependencies | acceptance_criteria |
|---|---|---|---|---|---|---|---|---|
| L00 | Inventory language surface | classify language state | scan active docs/prompts/lore/tests | none | none | none | none | inventory complete |
| L01 | Convert GNOMES SSOT docs | English canon | rewrite GNOMES matrix/governance/lore unit docs in English | none | `docs/lore/GNOMES_*.md`, ADR | none | L00 | no German in active GNOMES SSOT |
| L02 | Convert shared canon constraints | safe English guardrails | re-author `sharedCanon.md` constraints in English | none | `prompts/fragments/sharedCanon.md` | none | L01 | constraints preserved, English default |
| L03 | Convert runtime profile text | runtime English defaults | migrate `primary` and keywords/text values to English | none | `data/gnomes/*.yaml` | none | L01 | schema-compatible English values |
| L04 | Convert lore units | retrieval English defaults | rewrite approved unit `content` text in English | none | `memory/lore/lore_units.approved.jsonl` | none | L01,L02 | active lore units English + operational |
| L05 | Convert regression fixtures | language-sensitive validation | rewrite test prompts/expectations in English, keep mode/role coverage | none | `tests/prompts/gnomes_matrix_regression.jsonl` | none | L02,L03,L04 | fixtures validate English behavior intent |
| L06 | Publish migration plan | long-range repo migration blueprint | add canonical repo-wide migration plan doc | `docs/implementation/DEFAULT_EN_MIGRATION_PLAN.md` | none | none | L00 | plan available for phased execution |

## 6. File-Level Migration Notes
- `docs/lore/GNOMES_MATRIX.md`: rewrite role table labels/definitions in precise technical English; keep role IDs unchanged.
- `prompts/fragments/sharedCanon.md`: re-author forbidden patterns as English guardrails; preserve anti-advice intent.
- `data/gnomes/*.yaml`: do not rename keys; only migrate textual values and language defaults.
- `memory/lore/*.jsonl`: keep metadata stable (`id`, `status`, `tags`), update `content` language only.
- `tests/prompts/*.jsonl`: preserve scenario semantics (mode confusion, budget caps); update lexical expectations.

## 7. Prompt-Specific Migration Notes
- Keep `globalSafety.md` as upper bound authority.
- Migrate `sharedCanon.md` to concise enforcement language in English.
- Preserve role sharpness by maintaining each role’s distinct cadence/signature behavior.
- Translate finance/meme language into natural CT English, not generic influencer copy.
- Convert German prohibition patterns into explicit English do-not-use constraints.

## 8. Runtime and Schema Safety Notes
- Behavior-sensitive fields: `safety_boundaries`, prompt fragments, lore unit `content`, regression `expect_*` strings.
- Keep schema/type contracts untouched unless strictly necessary.
- No automatic migration for IDs/archetypes/mode enums.

## 9. Validation Plan
- Canon review: verify active GNOMES SSOT files are English-only.
- Prompt review: ensure anti-hype/no-advice constraints preserved.
- Runtime review: YAML parse/required fields remain valid.
- Test review: role confusion and budget cases remain represented.
- Consistency check: no active prompt-effective German strings in migrated files.

## 10. Rollout Sequence
1. Convert canonical docs (inert).
2. Convert prompt fragments/shared canon.
3. Convert runtime profile textual values.
4. Convert lore units.
5. Convert regression fixtures.
6. Run type/build/parse checks.
7. Merge with post-merge language consistency review.

## 11. Risks and Guardrails
- Residual mixed language in active prompt paths → enforce English review checklist.
- Terminology drift (treasury/discipline/safety) → use canonical terminology table.
- Prompt safety dilution during rewriting → require side-by-side semantic review.
- Test flakiness from lexical changes → keep behavioral assertions multi-signal.
- Legacy German loss → preserve via explicit archive/deprecation markers.

## 12. Minimal Deliverable Set
Wave 1 (mandatory):
1. English GNOMES SSOT docs.
2. English `sharedCanon.md`.
3. English textual values in `data/gnomes/*.yaml`.
4. English active lore unit content.
5. English GNOMES regression fixture with role/confusion/budget coverage.

Wave 2 (deferred):
- Full repo historical doc archive rationalization.
- Broader non-GNOMES prompt corpus rewrite.
- Optional linting/CI language-consistency gate.

## 13. Codex Handoff Notes
- Prefer small patch slices; avoid wide refactors.
- Modify only active canonical assets first.
- Keep IDs/enums/contracts stable while migrating text.
- If German text is ambiguous, rewrite to operational English intent (not literal translation).
- If uncertainty affects behavior, keep inert and annotate for review.

## Canonical terminology table
| Term | Canonical English |
|---|---|
| Bodenkontakt | earth-bound grounding |
| Disziplin | discipline |
| Treasury-Disziplin | treasury discipline |
| Nebelspieler-Dominanz | Nebelspieler dominance cap |
| Verbotsliste | forbidden patterns |

## Deprecation strategy (active German SSOT)
- Replace active German SSOT content with English canonical versions in-place.
- If preservation is required, move prior German text to archive paths with non-canonical labels.
- Add README pointers where archival relocation occurs.

## Language consistency checklist (PR review)
- [ ] Active SSOT files are English-only.
- [ ] Prompt-effective fragments use English constraints.
- [ ] Runtime YAML keys unchanged; textual values in English.
- [ ] Active lore units in English and status-gated.
- [ ] Regression fixtures reflect English expectations and preserve role/mode intent.
