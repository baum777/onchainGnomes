# Deployment

## Runtime Model

Worker process with scheduler loop - polls at configurable intervals.

## Docker

```bash
docker build -t xai-bot .
docker run -e X_API_KEY=... -e XAI_API_KEY=... xai-bot
```

## Environment Variables

Environment variables are documented in one place:

- `docs/operations/var.README.md` (SSOT)

Operationally important variables include:
- X credentials: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`
- LLM: `XAI_API_KEY`, `XAI_MODEL_PRIMARY`, `XAI_MODEL_FALLBACKS`
- Launch control: `LAUNCH_MODE` (`off|dry_run|staging|prod`)
- State store: `USE_REDIS`, `KV_URL`, `REDIS_KEY_PREFIX` (Redis is required for multi-worker)

## Health Checks

Use the runtime HTTP endpoints:

- `GET /health`
- `GET /ready`
- `GET /metrics`
