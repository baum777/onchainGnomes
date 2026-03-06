# Migration Audit: Context-Aware Social Persona Engine

**Audit date:** 2025-03-05  
**Scope:** TypeScript X/Twitter bot codebase migration to target architecture  
**Method:** Code-only claims, file path + function name + behavior

---

## A) IST Pipeline Trace (Current Runtime Path)

**Entry point:** `src/worker/pollMentions.ts` → `processMention(workflow, mention, state)` (line 356)  
**Primary flow:** `MentionWorkflow.process()` in `src/workflows/mentionWorkflow.ts` (line 402)

| Step | Function | File | Side effects | Deterministic |
|------|----------|------|--------------|---------------|
| 1 | Idempotency gate | `ensureNotProcessed()` | None | Yes |
| 2 | Activation policy | `evaluateActivation()` | None | Yes |
| 3 | Self-mention branch | Returns skip if `authorId === botUserId` | — | Yes |
| 4 | Build context | `buildContextBundle()` or `buildContext()` | Network (X API) | Yes (seeded) |
| 4a | Router (enhanced) | `context/router.ts` → `buildThreadContextV2()` | `xread.getTweet()` | Yes |
| 4b | Timeline (optional) | `buildTimelineBriefV2()` | `xread.searchRecent()` | Yes |
| 4c | Semantic (optional) | `buildSemanticTimelineBrief()` | Embedder API (if XAI) | Unknown |
| 4d | Legacy context | `brand_matrix/contextBuilder.ts` → `buildContext()` | TwitterApi calls | Yes |
| 5 | preLLMGuards | `preLLMGuards(bundle)` | None | Yes |
| 6 | **LLM branch** (if useEnhancedContext && llmClient) | `loadGorkyPrompts()` → `render()` → `llmClient.generateJSON()` | Network (LLM) | No (LLM) |
| 6a | LLM output | Single reply, 280-char slice | — | — |
| 6b | postLLMGuards | `postLLMGuards(reply_text)` | None | Yes |
| 7 | **Legacy branch** (else) | Parse command, aggression, safety | — | — |
| 8 | Parse command | `parseMention(event.text)` | None | Yes |
| 9 | Aggression detect | `detectAggressionBrand(event.text)` | None | Yes |
| 10 | Safety rewrite | `safetyRewrite(event.text, parsed.command)` | None | Yes |
| 11 | **Blocked branch** | If `safety.blocked` | `buildPublicRefusal()` | Seeded RNG | Yes |
| 12 | Reward accrue | `rewardEngine.accrueXp()` | In-memory repo | Yes |
| 13 | rollDice | `rollDice(event.tweet_id)` | None | Yes |
| 14 | Energy inference | `inferEnergyWithVariance()` | None | Seeded | Yes |
| 15 | Humor mode | `selectHumorMode()` | None | Seeded | Yes |
| 16 | **Aggressive branch** | If `safety.is_aggressive` | `buildRhymeDeescalation()` | Seeded RNG | Yes |
| 17 | Reward consume | `rewardEngine.consumeRewardIfEligible()` | — | **No** (Math.random at rewardEngine.ts:316) |
| 18 | **IMAGE branch** | If reward?.type === "ROAST_IMAGE" | `handleImageBranch()` | Replicate API | Seeded |
| 19 | **TEXT branch** | `handleTextBranch()` | — | — |
| 20 | Compose reply | `composeReplyText()` | None | Seeded RNG | Yes |
| 21 | Finalize | `assertPublicTextSafe()` → `postReply()` | Network (X API) | Yes |

**Branching summary:**
- Activation denied → skip (silent or tease)
- preLLMGuards fail → skip
- safety.blocked → `buildPublicRefusal`
- safety.is_aggressive → `buildRhymeDeescalation`
- reward === ROAST_IMAGE → `handleImageBranch` (Replicate)
- Else → `handleTextBranch` (template/LLM)

**Note:** `src/pipeline/replyEngine.ts` → `processMention()` implements the **target** architecture but is **NOT** invoked by the production poll worker. It is a parallel, unused implementation.

---

## B) Coverage Matrix

| Target component | Status | Evidence | Migration action |
|------------------|--------|----------|------------------|
| Context builder (thread) | **Present** | `context/contextBuilderV2.ts` → `buildThreadContextV2()` (used by router); `context/contextBuilder.ts` → `buildThreadContext()` (used by replyEngine only) | Keep; replyEngine uses v1 |
| Context builder (timelineX) | **Present** | `context/timelineScoutV2.ts` → `buildTimelineBriefV2()`; heuristic bullets, hot_phrases | Keep |
| Summarization | **Partial** | `contextBuilderV2`: `summarizeHeuristic()` (last 2 msgs); no LLM ThreadSummary | Refactor → ThreadSummarizer output |
| Topic extraction | **Partial** | `context/keywordExtractor.ts` → `extractKeywords()`; `prompts/intentExtraction.ts` → `extractIntent()` (regex); no TopicsSchema | Refactor → Topic Extractor |
| Intent+entity LLM classifier | **Missing** | `intent/detectIntent.ts` exists, used only by replyEngine; production uses `extractIntent()` (regex) | Replace with detectIntent in MentionWorkflow |
| Truth gate | **Partial** | `truth/truthGate.ts` → `categorizeResponse()`; used by replyEngine only; production has no FACT/LORE/OPINION gating | Replace in workflow |
| Persona router | **Partial** | `persona/personaRouter.ts` → `selectPersonaMode()`; used by replyEngine only; production uses `selectHumorMode()` | Replace in workflow |
| Lore store | **Present** | `memory/loreStore.ts` (LegacyLoreEntry); used by replyEngine only; production does not read/write lore | Wire into workflow |
| Fact store | **Present** | `memory/factsStore.ts`; used by replyEngine only; production has no fact retrieval | Wire into workflow |
| User interaction graph | **Present** | `memory/userGraph.ts`; used by replyEngine only; production has no user graph | Wire into workflow |
| LLM candidate generator (N≥3) | **Partial** | `generation/generateCandidates.ts` → 3–7 candidates; used by replyEngine only; production uses single LLM call or template pick | Replace in workflow |
| Selector (best-of-N) | **Partial** | `selector/selectBest.ts`; used by replyEngine only; production picks single | Replace in workflow |
| Anti-repetition cache | **Partial** | `selector/repetitionGuard.ts`; used by replyEngine only; production has no repetition guard | Wire into workflow |
| Safety rewrite | **Present** | `mentionWorkflow.ts` → `safetyRewrite()`; `boundary/publicTextGuard.ts` → `assertPublicTextSafe()`; `persona/personaGuardrails.ts` | Keep; extend with target schema |
| Memory writeback | **Partial** | `memory/writeback.ts` → `performWriteback()`; used by replyEngine only; production does not persist lore/interactions | Wire into workflow |

---

## C) Repo Inventory (Reply-Creation & Gating Modules)

| Module | Path | Exported functions | Side effects | Deterministic |
|--------|------|--------------------|--------------|---------------|
| MentionWorkflow | `workflows/mentionWorkflow.ts` | `parseMention`, `isEventProcessed`, `ensureNotProcessed`, `detectAggression`, `safetyRewrite`, `buildPublicRefusal`, `buildRhymeDeescalation`, `buildDenyTease`, `generateBadgeText`, `createMentionWorkflow` | X API, LLM (opt), Replicate (opt) | Yes except rewardEngine + LLM |
| Context router | `context/router.ts` | `buildContextBundle` | xread.getTweet, searchRecent | Yes |
| Context builder v1 | `context/contextBuilder.ts` | `buildThreadContext` | xread.getTweet | Yes |
| Context builder v2 | `context/contextBuilderV2.ts` | `buildThreadContextV2` | xread.getTweet | Yes |
| Timeline scout v2 | `context/timelineScoutV2.ts` | `buildTimelineBriefV2` | xread.searchRecent | Yes |
| Brand context | `brand_matrix/contextBuilder.ts` | `buildContext` | TwitterApi | Yes |
| Intent extraction | `prompts/intentExtraction.ts` | `extractIntent` | None | Yes |
| Intent detection (LLM) | `intent/detectIntent.ts` | `detectIntent` | LLM | No (LLM) |
| Truth gate | `truth/truthGate.ts` | `categorizeResponse`, `validateFactClaims`, `isResponseSafe`, `createFailClosedClassification` | None | Yes |
| Persona router | `persona/personaRouter.ts` | `selectPersonaMode`, `getPersonaConfig`, `checkPersonaConsistency`, `buildRoutingCriteria` | None | Yes |
| Persona guardrails | `persona/personaGuardrails.ts` | `enforcePersonaGuardrails`, `buildCalmPanicResponse`, `detectPanicState`, `requestRealCA`, `addMemeLine`, `detectPersonaDrift` | None | Yes |
| Lore store | `memory/loreStore.ts` | `createLoreStore`, `seedLore`; class `LoreStore` | Storage (opt) | Yes |
| Facts store | `memory/factsStore.ts` | `createFactsStore`; class `FactsStore` | Storage, resolver | Yes |
| User graph | `memory/userGraph.ts` | `createUserGraph`; class `UserGraph` | Storage (opt) | Yes |
| Writeback | `memory/writeback.ts` | `performWriteback`, `batchWriteback` | loreStore.addLore, userGraph.recordInteraction | Yes |
| Generate candidates | `generation/generateCandidates.ts` | `generateCandidates`, `batchGenerateCandidates` | LLM | No |
| Select best | `selector/selectBest.ts` | `selectBest`, `batchSelectBest`, `filterByMinimumScore`, `getTopCandidates` | None | Yes |
| Repetition guard | `selector/repetitionGuard.ts` | `createRepetitionGuard`, `isExactMatch`, `quickSimilarity` | None | Yes |
| Gorky prompt composer | `brand_matrix/gorkyPromptComposer.ts` | `composeGorkyPrompt`, `isOutputSafe`, `composeReplyText` | None | Seeded |
| Public text guard | `boundary/publicTextGuard.ts` | `assertPublicTextSafe`, `checkPublicTextSafe` | None | Yes |
| Reply engine | `pipeline/replyEngine.ts` | `processMention`, `createReplyEngine` | xread, LLM, stores | No (LLM) |
| Reward engine | `reward_engine/rewardEngine.ts` | `createRewardEngine` | Math.random at line 316 | **No** |

---

## D) Test Gaps + Recommended New Tests

### Test suite overview

**Existing critical tests (01–06):**

| File | Invariants |
|------|------------|
| `tests/critical/01_failclosed_invalid_ca.test.ts` | Invalid CA → UNVERIFIED_HIGH_RISK, risk ≥80, INVALID_CONTRACT_FORMAT flag |
| `tests/critical/02_aggression_forces_rhyme.test.ts` | Aggression → rhyme deescalation path |
| `tests/critical/03_no_meme_without_data.test.ts` | No meme without data invariant |
| `tests/critical/04_address_spoofing_flag.test.ts` | Address spoofing detection |
| `tests/critical/05_dedup_stable_hash.test.ts` | Stable hash for deduplication |
| `tests/critical/06_safety_no_financial_advice.test.ts` | No financial advice in public text |

**New tests (target-pipeline / migration era):**

| File | Invariants |
|------|------------|
| `tests/contracts/schemas.contract.test.ts` | Zod validation of ThreadSummary, TimelineSummary, Topics, IntentResult, TruthGate, PersonaRoute, Candidates, CandidateSelection, SafetyRewrite, LoreDeltaResult |
| `tests/pipeline/replyEngine.mock.integration.test.ts` | ≤280 chars, no forbidden terms, looks-like-reply; meta-leak refuse; FACT without address refuse; LORE → lore_deltas; ≥3 unique candidates |
| `tests/memory/lore.writeback.consistency.test.ts` | Lore deltas persist; canon stable across runs |
| `tests/pipeline/replyEngine.real.integration.test.ts` | Optional harness for `replyEngine` export (skipped when missing) |
| `tests/intent/detectIntent.test.ts` | Heuristic fallback, LLM path, schema |
| `tests/truth/truthGate.test.ts` | FACT/LORE/OPINION, validateFactClaims, isResponseSafe |
| `tests/selector/selectBest.test.ts` | Multi-factor scoring |
| `tests/selector/repetitionGuard.test.ts` | LRU, similarity |

### Gaps vs target state

| Gap | Description | Recommended test (file + assertion) |
|-----|-------------|-------------------------------------|
| (a) Context ignorance | Production can ignore thread/timeline when using template path | `tests/workflows/mentionWorkflow.contextRequired.test.ts`: When `useEnhancedContext=false`, assert `contextSummary` is used in composeReplyText (or document legacy behavior) |
| (b) Phrase loops | No repetition guard in production | `tests/workflows/mentionWorkflow.repetitionGuard.test.ts`: When repetitionGuard wired, assert same seedKey + similar context produces different replies (or document as future) |
| (c) Fact hallucinations (FACT) | No truth gate in production; FACT mode not enforced | `tests/truth/truthGate.factHallucination.test.ts`: Given response containing "verified" without proof, assert `isResponseSafe` returns `safe: false` or `requires_verification: true` |
| (d) Lore drift | Lore store not used in production; no canon/headcanon separation in production | `tests/memory/lore.canonHeadcanonSeparation.test.ts`: When applying lore deltas, assert canon and headcanon are never merged; assert update of canon does not overwrite headcanon |

### Exact recommended tests (not implemented)

1. **`tests/workflows/mentionWorkflow.replyEngineIntegration.test.ts`**
   - When `processMention` from replyEngine is invoked with mocked deps, assert trace contains `intent_detect`, `truth_gate`, `memory_writeback`.
   - Assert `replyEngine.processMention` is reachable from workflow when feature flag enabled.

2. **`tests/truth/truthGate.factWithoutProof.test.ts`**
   - `categorizeResponse("This token is verified safe.", { hasAuditData: false })` → assert `requires_verification === true` or `category === "OPINION"`.
   - `validateFactClaims("Verified on-chain.", { hasAuditData: false })` → assert `violations` includes `VERIFIED_CLAIM_WITHOUT_PROOF`.

3. **`tests/critical/07_repetition_guard_prevents_loop.test.ts`**
   - Add 5 identical replies to RepetitionGuard; 6th check → assert `is_repetitive === true` and `penalty_factor < 1`.

4. **`tests/critical/08_lore_canon_immutable.test.ts`**
   - Apply lore delta with `canon_or_headcanon: "canon"`; apply second delta with same key and `canon_or_headcanon: "headcanon"`; assert canon unchanged, headcanon appended.

---

## E) Migration Plan (Minimal Risk)

| Step | Code changes | Break risk | Validation |
|------|--------------|------------|------------|
| 1 | Add feature flag `USE_REPLY_ENGINE` (env). In `mentionWorkflow.ts`, when flag=true and llmClient present, call `processMention` from replyEngine instead of legacy path. Pass through mention + controls. | **Med** | Existing replyEngine tests; new integration test that asserts workflow can route to replyEngine when flag set |
| 2 | In replyEngine, ensure `buildThreadContext` (v1) matches production `buildThreadContextV2` output shape. Align `ThreadContext` types. | **Low** | Unit tests for both context builders; replyEngine test with shared mock |
| 3 | Add timeline to replyEngine when `enable_timeline_scout` true. Use `buildTimelineBriefV2` or equivalent. | **Low** | replyEngine test with timeline mock; assert trace includes timeline in memory |
| 4 | Replace `extractIntent` with `detectIntent` in workflow (when USE_REPLY_ENGINE). Keep `extractIntent` for IMAGE branch until migration complete. | **Med** | Intent test suite; compare outputs for same input |
| 5 | Wire truth gate into workflow: before LLM/template, run `categorizeResponse` on context. For FACT, enforce `isResponseSafe` before publish. | **Med** | truthGate tests; workflow test with FACT context |
| 6 | Wire persona router: replace `selectHumorMode` with `selectPersonaMode` when USE_REPLY_ENGINE. Map `PersonaMode` to existing humor style if needed. | **Med** | personaRouter tests; compare behavior |
| 7 | Wire lore store, facts store, user graph into workflow. Call `performWriteback` after successful reply. | **Med** | lore.writeback test; userGraph.recordInteraction test |
| 8 | Replace single LLM call with `generateCandidates` (N≥3). Replace manual pick with `selectBest`. Add `RepetitionGuard.add()` before publish. | **High** | candidateDiversity, selectBest, repetitionGuard tests |
| 9 | Remove `Math.random` from `rewardEngine.ts:316`; use seeded RNG from event id. | **Low** | Determinism test for reward branch |
| 10 | Delete legacy `composeReplyText` template path when USE_REPLY_ENGINE is default and stable. | **High** | Full regression; shadow mode |

---

## F) Risk Register + Kill-Switches

| Risk | Mitigation | Kill-switch |
|------|------------|-------------|
| **1. X API rate limits** | Backoff in pollMentions; limit timeline queries (max_timeline_queries) | Env `CONTEXT_ENABLE_TIMELINE_SCOUT=false`; reduce `CONTEXT_MAX_THREAD_DEPTH` to 1 |
| **2. LLM JSON parse failure** | detectIntent/generateCandidates have heuristic fallbacks | Fallback to `extractIntent` + template when LLM throws; log and continue |
| **3. Context size explosion** | `max_thread_depth`, `SUMMARY_MAX_CHARS` caps | Env `CONTEXT_MAX_THREAD_DEPTH=1`; truncate summary to 240 chars |
| **4. Truth gate over-refusal** | `isResponseSafe` may be strict; downgrade to OPINION when uncertain | Add `STRICT_TRUTH_GATE=false` to allow OPINION when `requires_verification` but no clear violation |
| **5. Lore writeback latency** | `performWriteback` is async; can delay publish | Run writeback fire-and-forget; never block publish on writeback |

**Kill-switch summary:**
- `USE_REPLY_ENGINE=false` → full revert to legacy path
- `CONTEXT_ENABLE_TIMELINE_SCOUT=false` → no timeline fetch
- `CONTEXT_MAX_THREAD_DEPTH=1` → minimal thread
- Fallbacks in detectIntent, generateCandidates → graceful degradation
