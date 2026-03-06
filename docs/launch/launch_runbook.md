# Launch Runbook — serGorky Bot

## Staging Deploy Steps

1. **Set environment variables**
   ```bash
   LAUNCH_MODE=staging
   LOG_LEVEL=info
   LLM_PROVIDER=xai
   LLM_API_KEY=<your-xai-key>
   XAI_API_KEY=<same-if-using-xai>
   ALLOWLIST_HANDLES=@yourAccount,@testAccount
   # X API keys (required)
   X_API_KEY=...
   X_API_SECRET=...
   X_ACCESS_TOKEN=...
   X_ACCESS_SECRET=...
   ```

2. **Run CI locally**
   ```bash
   pnpm install
   pnpm run ci
   ```

3. **Dry-run rehearsal**
   ```bash
   LAUNCH_MODE=dry_run LOG_LEVEL=debug pnpm run poll
   ```
   - Verify logs show "Would reply" (no actual posts)
   - Check structured logs for run_id, tweet_id

4. **Staging deploy**
   - Deploy with `LAUNCH_MODE=staging` and `ALLOWLIST_HANDLES` set
   - Start poller: `pnpm run poll` or `node dist/index.js`
   - Only mentions from allowlisted handles will get published replies

5. **Smoke test (5 mentions)**
   - Trigger 5 mentions from allowlisted accounts
   - Verify replies in logs (no leak, relevance OK)
   - Check `.run-artifacts/` if `DEBUG_ARTIFACTS=true`

## Production Deploy Steps

1. **Pre-flight**
   - Run `pnpm run ci` → all green
   - Secrets set (X API, LLM)
   - `LAUNCH_MODE=prod` (or omit for backward compat with DRY_RUN=false)

2. **Deploy**
   - Set `LAUNCH_MODE=prod` (or leave unset with `DRY_RUN=false`)
   - Allowlist empty or disabled for prod

3. **Kill-switch (immediate rollback)**
   - Set `LAUNCH_MODE=dry_run` or `LAUNCH_MODE=off`
   - Restart process
   - `dry_run`: continues processing, logs what would be posted
   - `off`: skips LLM, returns refusal

## Rollback Steps

| Severity  | Action                              | Recovery |
|-----------|-------------------------------------|----------|
| Soft      | `LAUNCH_MODE=dry_run` + restart     | Fix issue, set prod, restart |
| Hard      | `LAUNCH_MODE=off` + restart         | Same as above |
| Critical  | Stop process, revert deploy         | Deploy previous version, restore env |

## Dedupe & Rate Limiting

- **DedupeGuard**: TTL-based (7 days). Prevents double-reply on duplicate poll, race, restart.
- **RateLimiter**: Token bucket — global 5/min, per-user 2/min. Skips safely when exceeded.
- Both run before workflow; skips are logged (Dedupe skip / Rate limited).

## Incident Checklist

- [ ] Set `LAUNCH_MODE=dry_run` or `off` immediately if bad replies
- [ ] Check `LOG_LEVEL=debug` logs for context_bundle, intent, truth
- [ ] Inspect circuit breaker: `[LLM] Circuit breaker opened` in logs
- [ ] Verify no internal terms in public replies (trace_id, score, xp, etc.)
- [ ] If rate limited (429): system uses backoff; reduce poll frequency if needed
- [ ] If LLM JSON fails 3x: circuit opens, canned refusal for 1 min

## Env Reference

| Var                  | Required      | Default    | Description                    |
|----------------------|---------------|------------|--------------------------------|
| LAUNCH_MODE          | No (inferred) | prod/dry_run | off, dry_run, staging, prod |
| LOG_LEVEL            | No            | info       | debug, info, warn, error       |
| LLM_PROVIDER        | No            | xai        | xai, openai, anthropic         |
| LLM_API_KEY         | When != off   | —          | API key for LLM                |
| ALLOWLIST_HANDLES   | Staging       | —          | @handle1,@handle2 for staging   |
| DEBUG_ARTIFACTS     | No            | false      | Write run artifacts to .run-artifacts |
| LLM_TIMEOUT_MS      | No            | 30000      | Hard timeout per LLM call      |
