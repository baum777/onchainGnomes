# Gorky Integration Notes

Minimal integration points into existing pipeline and worker. **Do not replace or rewrite** `pipeline.ts` or `pollMentions.ts`.

---

## 1. src/canonical/pipeline.ts

### What enters from existing code

- `CanonicalEvent` (from worker via `mentionToCanonicalEvent`)
- `PipelineDeps` (llm, botUserId)
- `CanonicalConfig` (default or override)

### What the pipeline already does (unchanged)

1. `dedupeCheckAndMark(event_id)` — before processing
2. `enforceLaunchRateLimits({ authorHandle, globalId })` — before processing
3. `safetyFilter(event)` → skip if !passed
4. `classify(event)` → `ClassifierOutput`
5. `scoreEvent(event, cls)` → `ScoreBundle`
6. `checkEligibility(scores, cls, config)` → skip if !eligible
7. `extractThesis(...)` → skip if null
8. `selectMode(...)` → skip if ignore
9. `mapNarrative(event, cls)` → `NarrativeResult`
10. `selectPattern(thesis, narrative, scores, author_id)` → `PatternSelectionResult`
11. `formatDecision(...)` → skip if format=skip
12. `fallbackCascade(...)` → LLM + validate + repair
13. `buildAuditRecord` + `persistAuditRecord`

### Gorky package consumption

- **Safety:** `safetyFilter` from `src/safety/safetyFilter.ts` (already wired)
- **Narrative:** `mapNarrative` from `src/narrative/narrativeMapper.ts` (already wired)
- **Pattern:** `selectPattern` from `src/roast/patternEngine.ts` (already wired)
- **Format:** `formatDecision` from `src/roast/formatDecision.ts` (already wired)

### Outputs returned

- `PipelineResult`: `{ action: "publish" | "skip", ... }`
- Audit record persisted to `data/audit_log.jsonl`

### Minimal touch points

**None required.** Pipeline already integrates Gorky modules. Optional: pass `config/gorky.yaml` overrides via `configOverride` in tests.

---

## 2. src/worker/pollMentions.ts

### What enters

- Raw mentions from X API
- `Mention` type from `poller/mentionsMapper`

### Flow (unchanged)

1. `fetchMentions()` → `Mention[]`
2. For each: `isProcessed(state, mention.id)` → skip if true
3. `mentionToCanonicalEvent(mention)` → `CanonicalEvent`
4. `handleEvent(event, deps, config)` → `PipelineResult`
5. If `result.action === "skip"` → mark processed, return
6. **Launch gate:** `shouldPost(mention.authorUsername)` → if action !== "post" → mark processed, return (no publish)
7. If `dryRun` → log `[DRY_RUN] Would reply`
8. Else → `xClient.reply(result.reply_text, mention.id)`
9. `markProcessed`, `saveState`

### Launch gate branching

- **Location:** After `handleEvent`, before `xClient.reply`
- **Function:** `shouldPost(authorHandle)` from `src/ops/launchGate.js`
- **Behavior:**
  - `LAUNCH_MODE=off` → `action: "refuse"`
  - `LAUNCH_MODE=dry_run` → `action: "log_only"`
  - `LAUNCH_MODE=staging` → `action: "post"` only if handle in `ALLOWLIST_HANDLES`
  - `LAUNCH_MODE=prod` → `action: "post"`

### Optional: use publishDecision

To consolidate publish logic, `processCanonicalMention` could call:

```ts
import { postPublishCheck } from "../gorky/publishDecision.js";

const decision = postPublishCheck(mention.authorUsername ?? undefined);
if (!decision.allow) {
  // skip, log decision.reason
  return;
}
```

**Current:** Direct `shouldPost()` call. Both equivalent. No change required.

### What should remain unchanged

- Poll loop structure
- `mentionToCanonicalEvent` mapping
- `handleEvent` invocation
- File-based `processed_mentions.json` state
- `dryRun` from `isPostingDisabled()` or `DRY_RUN` env

---

## 3. Data Flow Summary

```
X API → Mention[] → mentionToCanonicalEvent → CanonicalEvent
  → handleEvent (pipeline)
    → dedupeGuard, rateLimiter (pre)
    → safetyFilter, classify, score, eligibility, thesis, narrative, pattern, format
    → fallbackCascade (LLM, validate, repair)
    → auditLog
  → PipelineResult
  → shouldPost (launchGate) — branch: post | refuse | log_only
  → xClient.reply (if post and !dryRun)
```

---

## 4. Config Loading

- `config/default.yaml` — app defaults, rollout stages
- `config/gorky.yaml` — Gorky overrides (relevance, thresholds, features)
- Env: `LAUNCH_MODE`, `ALLOWLIST_HANDLES`, `XAI_API_KEY`, etc.

Pipeline uses `DEFAULT_CANONICAL_CONFIG` from `types.ts`. Gorky config can be merged at load time if a config loader exists; otherwise thresholds are in `DEFAULT_CANONICAL_CONFIG`.
