# Gorky Module Responsibilities

Boundaries for all Gorky-related modules. Pipeline and worker remain the orchestrators.

---

## Pipeline Flow

```
Mention → Normalize → Safety → Classify → Score → Eligibility → Thesis
  → Narrative → Pattern → Format → Prompt → LLM → Validate → Repair? → Publish
```

---

## 1. Mention Ingest Worker

| Path | `src/worker/pollMentions.ts` |
|------|------------------------------|
| Responsibility | Poll X API, map to CanonicalEvent, invoke pipeline |
| Input | since_id, X credentials |
| Output | Mention[] → CanonicalEvent → PipelineResult |
| Key Logic | fetchMentions, mentionToCanonicalEvent, handleEvent |
| Failure | 429 → backoff; 401 → exit |

---

## 2. Canonical Pipeline

| Path | `src/canonical/pipeline.ts` |
|------|-----------------------------|
| Responsibility | Orchestrate all stages, return publish or skip |
| Input | CanonicalEvent, PipelineDeps, CanonicalConfig |
| Output | PipelineResult |
| Key Logic | handleEvent — sequential stages |
| Failure | Each stage can return skip |

---

## 3. Safety Filter

| Path | `src/safety/safetyFilter.ts` |
|------|-----------------------------|
| Responsibility | Block unsafe content before LLM |
| Input | CanonicalEvent |
| Output | SafetyResult (passed, block_reason, policy_flags) |
| Key Logic | Identity, hate, harassment bait, financial advice, token promotion, spam |
| Failure | Block → skip_safety_filter |

---

## 4. Narrative Mapper

| Path | `src/narrative/narrativeMapper.ts` |
|------|-----------------------------------|
| Responsibility | Map to narrative label + confidence + sentiment |
| Input | CanonicalEvent, ClassifierOutput |
| Output | NarrativeResult |
| Key Logic | Rules/keywords |
| Failure | Fallback to "unclassified" |

---

## 5. Pattern Engine

| Path | `src/roast/patternEngine.ts` |
|------|------------------------------|
| Responsibility | Select roast pattern from library |
| Input | ThesisBundle, NarrativeResult, ScoreBundle, authorId |
| Output | PatternSelectionResult |
| Key Logic | triggerConditionsMatch, weight, anti-repetition |
| Failure | Fallback to narrative_vs_reality |

---

## 6. Format Decision

| Path | `src/roast/formatDecision.ts` |
|------|------------------------------|
| Responsibility | skip | short_reply | expanded_reply | short_thread |
| Input | Event, cls, narrative, relevance, threshold |
| Output | FormatDecision |
| Key Logic | Deterministic rules |
| Failure | format=skip → skip_format_decision |

---

## 7. Publish Decision (Gorky Package)

| Path | `src/gorky/publishDecision.ts` |
|------|-------------------------------|
| Responsibility | Consolidate pre/post publish checks |
| Input | eventId, authorHandle (pre); authorHandle (post) |
| Output | PublishDecision (allow, reason) |
| Key Logic | dedupeGuard, rateLimiter, launchGate |
| Consumer | Optional: pollMentions; currently launchGate used directly |

---

## 8. Launch Gate

| Path | `src/ops/launchGate.ts` |
|------|-------------------------|
| Responsibility | Fail-closed posting control |
| Input | authorHandle |
| Output | PostDecision (post | refuse | log_only) |
| Key Logic | LAUNCH_MODE: off, dry_run, staging, prod |
| Consumer | pollMentions.ts |

---

## 9. Dedupe Guard

| Path | `src/ops/dedupeGuard.ts` |
|------|--------------------------|
| Responsibility | Prevent double-process of same event_id |
| Input | eventId |
| Output | DedupeDecision (ok, reason) |
| Consumer | pipeline.ts (before handleEvent) |

---

## 10. Rate Limiter

| Path | `src/ops/rateLimiter.ts` |
|------|--------------------------|
| Responsibility | Global + per-user limits |
| Input | authorHandle, globalId |
| Output | RateLimitDecision |
| Consumer | pipeline.ts (before handleEvent) |
