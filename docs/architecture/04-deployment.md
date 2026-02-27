# Deployment

## Runtime Model

Worker process with scheduler loop - polls at configurable intervals.

## Docker

```bash
docker build -t xai-bot .
docker run -e X_API_KEY=... -e XAI_API_KEY=... xai-bot
```

## Environment Variables

- `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`
- `XAI_API_KEY`
- `DRY_RUN` - Set to `true` for safe testing
- `DEBUG` - Enable debug logging
- `STATE_DB_PATH` - Path to SQLite database

## Health Checks

Run `python scripts/health_check.py` to verify:
- Database connectivity
- X API client initialization
- xAI client initialization
