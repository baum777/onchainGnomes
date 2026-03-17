# Runbook (Operations)

This runbook covers the **production TypeScript/Node runtime**.

If you are looking at legacy Python material, see `legacy/` (reference only).

## Start (local)

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm start
```

## Start (development / dry-run)

```bash
pnpm install
cp .env.example .env

# Dry-run: processes mentions but must not publish
LAUNCH_MODE=dry_run pnpm poll
```

## Health / Readiness

- `GET /health` — full health (store reachable + recent poll success + signals)
- `GET /ready` — store ping only
- `GET /metrics` — basic metrics

## Stop

Graceful shutdown via SIGTERM; the worker stops after finishing the current tick.

## Common Tasks

### Run CI checks

```bash
pnpm run ci
```

### Conversation simulation

```bash
pnpm simulate
pnpm simulate:ci
```

## Canonical References

- Setup: `docs/operations/QUICKSTART.md`
- Env vars (SSOT): `docs/operations/var.README.md`
- Launch controls: `docs/operations/launch_runbook.md`
