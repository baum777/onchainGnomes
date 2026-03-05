# Launch Execution Report — 2025-03-05

## A) Local Release Gate — PASS

| Step | Command | Result |
|------|---------|--------|
| A1 | `pnpm install` | OK |
| A2 | `pnpm run ci` | OK (after fixes) |
| A3 | `pnpm run test:smoke` | OK |
| A4 | `pnpm run test:e2e` | OK |

### Fixes applied (minimal diffs)

1. **Logger action type** (`src/ops/logger.ts`): Added `"skip"` to `action` union for dedupe/rate-limit logs.
2. **ESLint errors** (8 → 0):
   - `normalizeImageForUpload.ts`: `let img` → `const img`
   - `imageGenerator.ts`: `let fromCache` → `const fromCache`; eslint-disable for `require()`
   - `candidateDiversity.test.ts`: Removed unnecessary escape `\.` → `.`
   - `styleAnchors.ts`: Wrapped `case "referee"` block in `{}` (no-case-declarations)
   - `dice.ts`, `dynamicPromptComposer.ts`: eslint-disable for `require()` imports

---

## B) Dry-Run Rehearsal — MANUAL

**Commands (with secrets configured):**
```bash
LAUNCH_MODE=dry_run LOG_LEVEL=debug DEBUG_ARTIFACTS=true pnpm run poll
```

**Verification checklist:**
- [ ] No post occurs (log-only; `action: "log_only"` in logs)
- [ ] Dedupe blocks duplicates (log `"Dedupe skip"` on repeat mention)
- [ ] Rate limiter blocks bursts (log `"Rate limited"` with `retryAfterMs`)
- [ ] Artifacts written to `.run-artifacts/` (when DEBUG_ARTIFACTS=true)
- [ ] Replies ≤280 chars, no forbidden terms

**Note:** Dry-run rehearsal requires X API credentials and optional LLM_API_KEY. Not run in this execution (no secrets in env).

---

## C) Staging Deploy — MANUAL

**Env:**
```
LAUNCH_MODE=staging
ALLOWLIST_HANDLES=@YourAccount,@TestAccount
LOG_LEVEL=info
DEBUG_ARTIFACTS=false
```

Secrets: X_API_*, LLM_API_KEY (or XAI_API_KEY)

---

## D) Staging Smoke (5 mentions) — MANUAL

| # | Scenario | Expected |
|---|----------|----------|
| 1 | market_request | Reply posted (if allowlisted) |
| 2 | meme_play | Reply posted |
| 3 | prompt_attack | Must refuse |
| 4 | lore_query | May write lore deltas |
| 5 | coin_query without address | Must refuse |

Confirm: only allowlisted get posts, no duplicates, no rapid spam.

---

## E) Production Promotion — MANUAL

**Env:** `LAUNCH_MODE=prod`

**First-hour monitoring:** circuit breaker, rate-limit skips, posting failures, phrase loops.

**Kill-switch:** `LAUNCH_MODE=dry_run` or `off` + restart.

---

## Final GO / NO-GO

| Criterion | Status |
|-----------|--------|
| CI gates pass | GO |
| Smoke tests pass | GO |
| E2E tests pass | GO |
| Dry-run rehearsal | PENDING (manual, requires secrets) |
| Staging smoke | PENDING (manual) |

**Decision: CONDITIONAL GO**

- **Local gates:** All pass. Safe to merge and deploy.
- **Dry-run + staging:** Must be executed manually with real credentials before prod promotion.
- **Recommendation:** Run B (dry-run) and D (staging smoke) in target environment; then promote to prod.
