# Gorky Interface Contracts

Source of truth: `src/canonical/types.ts`, `src/safety/safetyFilter.ts`, `src/narrative/narrativeMapper.ts`, `src/roast/patternEngine.ts`.

---

## MentionSignal (Raw X Input)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | ✓ | Tweet ID |
| text | string | ✓ | Tweet text |
| author_id | string | ✓ | X user ID |
| authorUsername | string \| null | ✓ | Resolved from includes |
| conversation_id | string \| null | | |
| created_at | string \| null | | ISO8601 |
| referenced_tweets | Array<{type, id}> \| null | | |
| in_reply_to_user_id | string \| null | | |

**Producer:** `poller/mentionsMapper`  
**Consumer:** `pollMentions` → `mentionToCanonicalEvent`

---

## CanonicalEvent (Normalized)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| event_id | string | ✓ | Same as Mention.id |
| platform | "twitter" | ✓ | |
| trigger_type | "mention" \| "reply" \| "quote" \| "manual" | ✓ | |
| author_handle | string | ✓ | @username |
| author_id | string | ✓ | |
| text | string | ✓ | |
| parent_text | string \| null | ✓ | |
| quoted_text | string \| null | ✓ | |
| conversation_context | string[] | ✓ | |
| cashtags | string[] | ✓ | |
| hashtags | string[] | ✓ | |
| urls | string[] | ✓ | |
| timestamp | string | ✓ | ISO8601 |

**Producer:** `mentionToCanonicalEvent`  
**Consumer:** Pipeline stages

---

## SafetyResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| passed | boolean | ✓ | |
| block_reason | string | | When !passed |
| policy_flags | string[] | ✓ | |

**Producer:** `safetyFilter`  
**Consumer:** pipeline (skip if !passed)

---

## RelevanceResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| score | number | ✓ | 0–1 |
| components | object | ✓ | mention_signal, narrative_relevance, roastability, etc. |
| eligible | boolean | | |

**Producer:** `relevanceScorer` (or eligibility)  
**Consumer:** pipeline

---

## NarrativeResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| label | NarrativeLabel | ✓ | |
| confidence | number | ✓ | 0–1 |
| sentiment | "positive" \| "negative" \| "neutral" | ✓ | |

**Producer:** `mapNarrative`  
**Consumer:** patternEngine, formatDecision

---

## PatternSelectionResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| pattern_id | string | ✓ | |
| framing | string | ✓ | |
| fallback_used | boolean | ✓ | |

**Producer:** `selectPattern`  
**Consumer:** promptBuilder

---

## FormatDecision

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| format | "skip" \| "short_reply" \| "expanded_reply" \| "short_thread" | ✓ | |
| reason | string | ✓ | |

**Producer:** `formatDecision`  
**Consumer:** pipeline (skip if format=skip)

---

## ValidationResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| ok | boolean | ✓ | |
| reason | string | ✓ | |
| checks | ValidationCheck | ✓ | |
| repair_suggested | "shorten" \| "neutralize" \| "swap_closer" \| "regenerate" | | |

**Producer:** `validateResponse`  
**Consumer:** fallbackCascade, repairLayer

---

## PublishResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| outcome | "posted" \| "skipped" \| "blocked" \| "validation_failed" | ✓ | |
| success | boolean | | true iff posted |
| tweet_id | string | | When posted |
| skip_reason | string | | When skipped/blocked |

**Producer:** Worker / xClient  
**Consumer:** Analytics, audit

---

## PublishDecision (Gorky)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| allow | boolean | ✓ | |
| reason | "rate_limit" \| "duplicate" \| "launch_gate" | | When !allow |

**Producer:** `prePublishChecks`, `postPublishCheck`  
**Consumer:** Optional in pollMentions
