# Gorky X Bot — Complete Implementation Package

**Version:** 1.0  
**Audience:** Implementation engineers  
**Scope:** Extension layer for existing canonical pipeline and worker. No greenfield redesign.

---

## 1. Executive Summary

This package extends the existing xAi_Bot-App with a production-ready Gorky implementation layer. It adds:

- **Documentation:** Repo tree, module responsibilities, interface contracts, code-skeleton mapping, rollout checklist
- **Schemas:** 11 JSON schemas for pipeline data
- **Config:** `config/gorky.yaml` aligned with launchGate (off | dry_run | staging | prod)
- **Code:** `src/gorky/publishDecision.ts` — consolidated publish-decision skeleton
- **Tests:** Fixtures, integration tests, adversarial safety tests
- **Integration notes:** Explicit wiring to `src/canonical/pipeline.ts` and `src/worker/pollMentions.ts`

**What is NOT changed:** The canonical pipeline, worker loop, launchGate, dedupeGuard, rateLimiter, or env schema.

---

## 2. Assumptions About Existing System

| Component | Assumption |
|-----------|------------|
| `src/canonical/pipeline.ts` | Exists. `handleEvent(event, deps, config)` orchestrates: dedupe → rate limit → safety → classify → score → eligibility → thesis → mode → narrative → pattern → format → LLM → validate → audit. Returns `PipelineResult`. |
| `src/worker/pollMentions.ts` | Exists. Polls X API, maps to `Mention`, converts to `CanonicalEvent`, calls `handleEvent`, then `shouldPost`, then `xClient.reply` or logs. |
| `src/ops/launchGate.ts` | Exists. `shouldPost(authorHandle)` returns `PostDecision`. `isPostingDisabled()` for dry-run. LAUNCH_MODE: off \| dry_run \| staging \| prod. |
| `src/config/env.ts` | Exists. `loadLaunchEnv()` returns `LaunchEnv`. `LAUNCH_MODE` from env. `ALLOWLIST_HANDLES` for staging. |
| `src/ops/dedupeGuard.ts` | Exists. `dedupeCheckAndMark(eventId)` async. |
| `src/ops/rateLimiter.ts` | Exists. `enforceLaunchRateLimits({ authorHandle, globalId })` async. |
| `src/poller/mentionsMapper.js` | Exists. `Mention` type: id, text, author_id, authorUsername, conversation_id, created_at, referenced_tweets, in_reply_to_user_id. |
| `src/safety/safetyFilter.ts` | Exists. `safetyFilter(event)` returns `SafetyResult`. |
| `src/narrative/narrativeMapper.ts` | Exists. `mapNarrative(event, cls)` returns `NarrativeResult \| null`. |
| `src/roast/patternEngine.ts` | Exists. `selectPattern(thesis, narrative, scores, authorId)` returns `PatternSelectionResult`. |
| `src/roast/formatDecision.ts` | Exists. `formatDecision(...)` returns `FormatDecision`. |

---

## 3. Files to Add

| Path | Purpose |
|------|---------|
| `docs/implementation-package/REPO_TREE.md` | Repository structure, Gorky package location |
| `docs/implementation-package/MODULE_RESPONSIBILITIES.md` | Module boundaries, ownership |
| `docs/implementation-package/INTERFACE_CONTRACTS.md` | Interface definitions, invariants |
| `docs/implementation-package/CODE_SKELETONS.md` | Pseudocode → code mapping |
| `docs/implementation-package/ROLLOUT_CHECKLIST.md` | Rollout stages, metrics, abort criteria |
| `docs/implementation-package/INTEGRATION_NOTES.md` | Pipeline/worker integration points |
| `schemas/gorky/mention_signal.schema.json` | Raw X mention |
| `schemas/gorky/normalized_event.schema.json` | CanonicalEvent |
| `schemas/gorky/safety_result.schema.json` | SafetyResult |
| `schemas/gorky/relevance_result.schema.json` | RelevanceResult |
| `schemas/gorky/narrative_result.schema.json` | NarrativeResult |
| `schemas/gorky/pattern_selection.schema.json` | PatternSelectionResult |
| `schemas/gorky/format_decision.schema.json` | FormatDecision |
| `schemas/gorky/llm_generation_request.schema.json` | LLM request |
| `schemas/gorky/validation_result.schema.json` | ValidationResult |
| `schemas/gorky/publish_result.schema.json` | PublishResult |
| `schemas/gorky/analytics_log.schema.json` | AnalyticsLog |
| `config/gorky.yaml` | Gorky config (extends default) |
| `src/gorky/publishDecision.ts` | Publish decision skeleton |
| `tests/gorky/fixtures/mentions.ndjson` | Fixture mentions |
| `tests/gorky/fixtures/README.md` | Fixture docs |
| `tests/gorky/integration/pipeline.integration.test.ts` | Integration tests |
| `tests/gorky/safety/adversarial.test.ts` | Adversarial safety tests |

---

## 4. Files to Touch

| Path | Change |
|------|--------|
| `config/default.yaml` | None. Already has rollout stages. |
| `config/gorky.yaml` | Create or extend. Must align with launchGate. |
| `src/canonical/pipeline.ts` | **No change.** Integration is via existing `handleEvent` and `processCanonicalMention`. |
| `src/worker/pollMentions.ts` | **Optional:** Import `postPublishCheck` from `src/gorky/publishDecision.ts` for explicit gate. Currently uses `shouldPost` directly. |

---

## 5. Repository Tree

```
xAi_Bot-App/
├── docs/implementation-package/
│   ├── GORKY_IMPLEMENTATION_PACKAGE.md   # This document
│   ├── REPO_TREE.md
│   ├── MODULE_RESPONSIBILITIES.md
│   ├── INTERFACE_CONTRACTS.md
│   ├── CODE_SKELETONS.md
│   ├── ROLLOUT_CHECKLIST.md
│   └── INTEGRATION_NOTES.md
├── schemas/gorky/
│   ├── mention_signal.schema.json
│   ├── normalized_event.schema.json
│   ├── safety_result.schema.json
│   ├── relevance_result.schema.json
│   ├── narrative_result.schema.json
│   ├── pattern_selection.schema.json
│   ├── format_decision.schema.json
│   ├── llm_generation_request.schema.json
│   ├── validation_result.schema.json
│   ├── publish_result.schema.json
│   └── analytics_log.schema.json
├── config/
│   ├── default.yaml
│   └── gorky.yaml
├── src/
│   ├── canonical/
│   │   └── pipeline.ts              # UNCHANGED — orchestration
│   ├── worker/
│   │   └── pollMentions.ts          # UNCHANGED — poll loop
│   ├── gorky/
│   │   └── publishDecision.ts       # NEW — publish decision skeleton
│   ├── ops/
│   │   ├── launchGate.ts           # UNCHANGED
│   │   ├── dedupeGuard.ts          # UNCHANGED
│   │   └── rateLimiter.ts          # UNCHANGED
│   └── ...
├── tests/gorky/
│   ├── fixtures/
│   │   ├── mentions.ndjson
│   │   └── README.md
│   ├── integration/
│   │   └── pipeline.integration.test.ts
│   └── safety/
│       └── adversarial.test.ts
└── ...
```

---

## 6. Documentation Package

### A) REPO_TREE.md
- **Purpose:** Explain repository structure, Gorky package location
- **Audience:** New engineers, reviewers
- **Sections:** Full tree, Gorky-specific paths, relation to pipeline/worker, schema locations

### B) MODULE_RESPONSIBILITIES.md
- **Purpose:** Define responsibility boundaries
- **Audience:** Engineers, architects
- **Sections:** Pipeline ownership, Gorky extension ownership, publish decision ownership (ops vs gorky), integration boundaries

### C) INTERFACE_CONTRACTS.md
- **Purpose:** Define all pipeline interfaces
- **Audience:** Engineers implementing or extending
- **Sections:** MentionSignal, CanonicalEvent, SafetyResult, RelevanceResult, NarrativeResult, PatternSelectionResult, FormatDecision, LlmGenerationRequest, ValidationResult, PublishResult, AnalyticsLog — each with producer, consumer, required/optional fields, invariants

### D) CODE_SKELETONS.md
- **Purpose:** Map pseudocode to actual code
- **Audience:** Engineers implementing features
- **Sections:** Main loop → pollMentions + handleEvent, scoring → scorer + relevanceScorer, pattern selection → patternEngine, validation → validator + repairLayer, publish decision → publishDecision + launchGate

### E) ROLLOUT_CHECKLIST.md
- **Purpose:** Operational rollout guidance
- **Audience:** Ops, release managers
- **Sections:** off / dry_run / staging / prod semantics, metrics, abort criteria, go-live checks

### F) INTEGRATION_NOTES.md
- **Purpose:** Explicit integration points
- **Audience:** Engineers wiring the package
- **Sections:** Pipeline integration, worker integration, minimal required changes

---

## 7. JSON Schema Package

All schemas use `$schema: "http://json-schema.org/draft-07/schema#"`. Key requirements:

- **mention_signal:** Raw X API mention. Fields: id, text, author_id, authorUsername, conversation_id, created_at, referenced_tweets
- **normalized_event:** CanonicalEvent. platform: "twitter", trigger_type enum
- **safety_result:** passed, block_reason?, policy_flags[]
- **relevance_result:** score, components{}, eligible?, skip_reason?
- **narrative_result:** label, confidence, sentiment enum
- **pattern_selection:** pattern_id, framing, fallback_used
- **format_decision:** format enum (skip | short_reply | expanded_reply | short_thread), reason
- **llm_generation_request:** system, user, pattern_id?, narrative_label?, format_target?, max_tokens
- **validation_result:** ok, reason, checks{}, repair_suggested?
- **publish_result:** success, tweet_id?, skip_reason? — outcomes: posted | skipped | blocked | validation_failed
- **analytics_log:** event_id, safety_result, relevance_score, detected_narrative, selected_pattern, response_mode, generation_status, validation_result, publish_decision, skip_reason, created_at

---

## 8. Config Package

**config/gorky.yaml** must include:

- relevance weights (mention_signal, narrative_relevance, roastability, analytical_opportunity, sentiment_intensity, risk_penalty)
- thresholds (min_relevance, min_relevance_social, max_risk, strong_candidate_relevance)
- narrative mapping settings
- pattern rotation / anti-repetition
- rate_limits (global_per_minute, per_user_per_minute, per_thread_per_30min)
- cooldowns (per_user_minutes, per_thread_minutes, duplicate_window_hours)
- rollout feature flags (repair_enabled, thread_enabled, narrative_embedding_enabled)
- launchGate compatibility: off | dry_run | staging | prod (staging = restricted, prod = full)
- publish safety toggles
- thread decision parameters
- logging controls

---

## 9. Code Skeleton Package

**src/gorky/publishDecision.ts** must provide:

```typescript
// prePublishChecks(eventId, authorHandle) → PublishDecision
// - dedupeCheckAndMark(eventId)
// - enforceLaunchRateLimits({ authorHandle, globalId })
// - return { allow: true } | { allow: false, reason }

// postPublishCheck(authorHandle) → PublishDecision
// - shouldPost(authorHandle) from launchGate
// - return { allow: true } | { allow: false, reason: "launch_gate" }
```

Skip reason taxonomy: rate_limit | duplicate | launch_gate. Publish decision result: allow: boolean, reason?: string.

---

## 10. Test Package

### Fixtures (mentions.ndjson)
One JSON object per line. Categories: hopium, liquidity_illusion, fake_utility, this_cycle_different, post_hype_silence, aggressive_bait, financial_advice_bait, off_topic_spam.

### Integration tests
- Safe publish path
- Safety block
- Validation fail
- launchGate dry_run (log_only)
- staging/restricted (allowlist)
- prod/full publish
- Dedupe block
- Rate limit block

### Adversarial tests
- Direct insult bait
- Identity bait
- Financial-advice prompt bait
- Token shill bait
- Second-person aggression drift
- Forced toxic sarcasm attempts

---

## 11. Rollout Package

| Stage | LAUNCH_MODE | Meaning | Publish | Allowlist |
|-------|-------------|---------|--------|-----------|
| off | off | Disabled | No | N/A |
| dry_run | dry_run | Evaluate/log only | No | N/A |
| restricted | staging | Restricted rollout | Yes | ALLOWLIST_HANDLES |
| full | prod | Full rollout | Yes | No |

---

## 12. Integration With Existing Pipeline

- **Data flow:** Mention → mentionToCanonicalEvent → CanonicalEvent → handleEvent
- **Gorky logic:** Already inside pipeline: safetyFilter, mapNarrative, selectPattern, formatDecision, fallbackCascade (with repair)
- **No changes to pipeline.ts.** Package documents and extends via config and optional publishDecision wrapper.

---

## 13. Integration With Existing Worker

- **Ingestion:** fetchMentions → mentions
- **Per mention:** processCanonicalMention(deps, xClient, mention, state, dryRun, configOverride)
- **Flow:** isProcessed → mentionToCanonicalEvent → handleEvent → shouldPost → xClient.reply or log
- **dryRun:** From LAUNCH_MODE (isPostingDisabled) or DRY_RUN env
- **Optional:** Replace direct shouldPost call with postPublishCheck from publishDecision for consistency

---

## 14. Interface Contracts

See INTERFACE_CONTRACTS.md for full definitions. Summary:

| Interface | Producer | Consumer | Key Fields |
|-----------|----------|----------|------------|
| MentionSignal | X API / mentionsMapper | mentionToCanonicalEvent | id, text, author_id, authorUsername |
| CanonicalEvent | mentionToCanonicalEvent | pipeline.handleEvent | event_id, platform, trigger_type, text, author_* |
| SafetyResult | safetyFilter | pipeline | passed, block_reason?, policy_flags |
| RelevanceResult | relevanceScorer / scorer | eligibility | score, components |
| NarrativeResult | mapNarrative | selectPattern | label, confidence, sentiment |
| PatternSelectionResult | selectPattern | formatDecision, promptBuilder | pattern_id, framing, fallback_used |
| FormatDecision | formatDecision | promptBuilder | format, reason |
| ValidationResult | validateResponse | fallbackCascade, audit | ok, reason, checks, repair_suggested |
| PublishResult | xClient.reply / launchGate | worker | success, tweet_id?, skip_reason |
| AnalyticsLog | auditLog | dashboards | event_id, safety_result, publish_decision, ... |

---

## 15. Code Skeleton Details

**publishDecision.ts** internal sequence:

1. prePublishChecks: dedupe → rate limit → allow/deny
2. postPublishCheck: launchGate.shouldPost → allow/deny

Dependencies: dedupeGuard, rateLimiter, launchGate. Logging: Caller (worker) logs. No new logging inside publishDecision unless explicitly added.

---

## 16. Validation and Publish Decision Integration

- **Validation:** Inside fallbackCascade. validateResponse → attemptRepair on soft fail. Pipeline returns skip on validation_failure.
- **Publish decision:** Split. Pre-checks (dedupe, rate limit) in pipeline.handleEvent. Post-check (launchGate) in pollMentions.processCanonicalMention.
- **publishDecision.ts:** Consolidates both for documentation and optional use. Pipeline already calls dedupeGuard and rateLimiter directly; worker calls shouldPost directly. publishDecision can wrap these for a single API.

---

## 17. Milestone Build Order

1. Schemas (all 11)
2. docs/implementation-package (REPO_TREE, MODULE_RESPONSIBILITIES, INTERFACE_CONTRACTS)
3. config/gorky.yaml
4. src/gorky/publishDecision.ts
5. CODE_SKELETONS.md, INTEGRATION_NOTES.md
6. tests/gorky/fixtures (mentions.ndjson, README.md)
7. tests/gorky/integration/pipeline.integration.test.ts
8. tests/gorky/safety/adversarial.test.ts
9. ROLLOUT_CHECKLIST.md
10. Integration wiring (optional: worker uses postPublishCheck)

---

## 18. Risks and Edge Cases

| Risk | Mitigation |
|------|-------------|
| Schema drift vs pipeline | Schemas document current types; keep in sync with src/canonical/types.ts |
| Rollout stage ambiguity | Explicit mapping: staging=restricted, prod=full. Document in ROLLOUT_CHECKLIST. |
| Duplicate state | dedupeGuard by event_id. processed_mentions.json in worker. No new state in package. |
| Validation/publish mismatch | Pipeline skips on validation_failure. launchGate blocks post. Both must align. |
| Staging vs prod confusion | ALLOWLIST_HANDLES required for staging. Empty = no posts. |
| Incomplete fixture coverage | Fixtures cover 8 categories. Add as new edge cases found. |
| Over-permissive dry_run | dry_run still runs full pipeline; only blocks xClient.reply. Safe. |

---

## 19. Final Delivery Checklist

- [ ] All 11 JSON schemas created
- [ ] All 6 doc files created/updated
- [ ] config/gorky.yaml created/updated
- [ ] src/gorky/publishDecision.ts created
- [ ] tests/gorky/fixtures created
- [ ] tests/gorky/integration test created
- [ ] tests/gorky/safety test created
- [ ] ROLLOUT_CHECKLIST.md complete
- [ ] INTEGRATION_NOTES.md complete
- [ ] No breaking changes to pipeline.ts or pollMentions.ts
- [ ] launchGate semantics documented (off/dry_run/staging/prod)

---

## Appendix A: Proposed Minimal Repo Tree

```
docs/implementation-package/
  REPO_TREE.md
  MODULE_RESPONSIBILITIES.md
  INTERFACE_CONTRACTS.md
  CODE_SKELETONS.md
  ROLLOUT_CHECKLIST.md
  INTEGRATION_NOTES.md

schemas/gorky/
  mention_signal.schema.json
  normalized_event.schema.json
  safety_result.schema.json
  relevance_result.schema.json
  narrative_result.schema.json
  pattern_selection.schema.json
  format_decision.schema.json
  llm_generation_request.schema.json
  validation_result.schema.json
  publish_result.schema.json
  analytics_log.schema.json

config/gorky.yaml

src/gorky/publishDecision.ts

tests/gorky/
  fixtures/mentions.ndjson
  fixtures/README.md
  integration/pipeline.integration.test.ts
  safety/adversarial.test.ts
```

---

## Appendix B: First 10 Files to Create (Exact Order)

1. `schemas/gorky/mention_signal.schema.json`
2. `schemas/gorky/normalized_event.schema.json`
3. `schemas/gorky/safety_result.schema.json`
4. `docs/implementation-package/REPO_TREE.md`
5. `docs/implementation-package/INTERFACE_CONTRACTS.md`
6. `config/gorky.yaml`
7. `src/gorky/publishDecision.ts`
8. `tests/gorky/fixtures/mentions.ndjson`
9. `tests/gorky/integration/pipeline.integration.test.ts`
10. `docs/implementation-package/ROLLOUT_CHECKLIST.md`

---

## Appendix C: Engineer Handoff Note

**Gorky Implementation Package — Handoff**

This package extends the existing xAi_Bot-App. Do not replace `pipeline.ts` or `pollMentions.ts`. The canonical pipeline already runs the full Gorky flow (safety, narrative, pattern, format, LLM, validation, audit). This package adds:

1. **Documentation** — Repo structure, contracts, rollout
2. **Schemas** — JSON schemas for pipeline data
3. **Config** — `config/gorky.yaml` for Gorky overrides
4. **publishDecision** — Consolidated pre/post publish checks (wraps existing ops)
5. **Tests** — Fixtures, integration, adversarial safety

**Launch stages:** off | dry_run | staging | prod. staging = restricted (allowlist). prod = full.

**Integration:** Pipeline and worker need no code changes. Optional: have worker call `postPublishCheck` from `publishDecision` instead of `shouldPost` directly for consistency.

**Build order:** Schemas → docs → config → publishDecision → fixtures → tests → rollout docs.
