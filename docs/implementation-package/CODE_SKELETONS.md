# Gorky Code Skeletons

Pseudocode → implementation mapping. Pipeline and worker are the runtime.

---

## 1. Main Loop

**Pseudocode:** `LOOP: mentions = pollMentions(); FOR each: dedupe, normalize, handleEvent, launchGate, publish`

**Implementation:** `src/worker/pollMentions.ts` → `runWorkerLoop()`, `processCanonicalMention()`

---

## 2. Pipeline Orchestration

**Pseudocode:** `safety → classify → score → eligibility → thesis → narrative → pattern → format → LLM → validate → repair? → audit`

**Implementation:** `src/canonical/pipeline.ts` → `handleEvent()`

---

## 3. Pre-Publish Checks

**Pseudocode:** `IF dedupe(mention.id) THEN skip; IF rateLimitExceeded() THEN skip`

**Implementation:** `src/canonical/pipeline.ts` lines 88–97: `dedupeCheckAndMark`, `enforceLaunchRateLimits`

**Alternative:** `src/gorky/publishDecision.ts` → `prePublishChecks()` — same logic, consolidated.

---

## 4. Post-Publish Check (Launch Gate)

**Pseudocode:** `IF launchGate.shouldPost() === false THEN skip`

**Implementation:** `src/worker/pollMentions.ts` line 223: `shouldPost(mention.authorUsername)`

**Alternative:** `src/gorky/publishDecision.ts` → `postPublishCheck()` — wraps `shouldPost`.

---

## 5. PublishDecision Skeleton

**File:** `src/gorky/publishDecision.ts`

| Function | Purpose |
|----------|---------|
| `prePublishChecks({ eventId, authorHandle })` | dedupe + rate limit |
| `postPublishCheck(authorHandle)` | launch gate |
| `PublishDecision` type | `{ allow: true } \| { allow: false; reason }` |

**Called by:** Optional. Pipeline/worker already call dedupeGuard, rateLimiter, launchGate directly.

---

## 6. Safety Filter

**Pseudocode:** `IF identity_targeted OR harassment_bait OR financial_advice_request ... THEN block`

**Implementation:** `src/safety/safetyFilter.ts` → `safetyFilter(event)`

---

## 7. Pattern Selection

**Pseudocode:** `candidates = filter(patterns); weight = roastability * narrative_conf * (1 - recent_penalty); return maxBy(weight) OR fallback`

**Implementation:** `src/roast/patternEngine.ts` → `selectPattern()`

---

## 8. Format Decision

**Pseudocode:** `IF relevance < threshold THEN skip; IF "explain" in text THEN expanded; DEFAULT short_reply`

**Implementation:** `src/roast/formatDecision.ts` → `formatDecision()`
