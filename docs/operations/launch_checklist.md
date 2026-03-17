# Launch Checklist — Go/No-Go

## Pre-Launch (All Must Pass)

- [ ] **Tests green** — `pnpm run ci` passes
- [ ] **Secrets set** — X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
- [ ] **LLM key** — XAI_API_KEY or LLM_API_KEY (when LAUNCH_MODE ≠ off)
- [ ] **Allowlist (staging)** — ALLOWLIST_HANDLES for staging mode
- [ ] **Dry-run verified** — `LAUNCH_MODE=dry_run pnpm poll` runs, no posts
- [ ] **Smoke tests** — `pnpm run test:smoke` passes
- [ ] **E2E publish gate** — `pnpm run test:e2e` passes

## Launch Procedure

### 1. Local Rehearsal
```bash
pnpm install
pnpm run ci
LAUNCH_MODE=dry_run LOG_LEVEL=debug LLM_PROVIDER=xai LLM_API_KEY=xxx pnpm run test
```

### 2. Staging
- Set `LAUNCH_MODE=staging`
- Set `ALLOWLIST_HANDLES=@yourAccount,@testAccount`
- Deploy and run poller
- Smoke: 5 mentions from allowlisted accounts, verify logs

### 3. Production
- Set `LAUNCH_MODE=prod` (or omit with DRY_RUN=false)
- Allowlist empty or disabled
- Kill-switch ready: `LAUNCH_MODE=dry_run` or `off` for immediate rollback
