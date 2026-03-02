# xAi Bot (serGorky)

Autonomous X (Twitter) AI Agent — TypeScript/Node worker that polls mentions, processes via MentionWorkflow, and replies with AI-generated (or meme) responses.

**Runtime**: TypeScript/Node 20+ only. Python code has been moved to `legacy/python/`.

## Local Development

```bash
# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env with X API credentials, xAI key, etc.

# Build
pnpm build

# Run (production mode)
pnpm start

# Run (development with watch)
pnpm dev

# Dry run (no posting)
DRY_RUN=true pnpm start
```

## Render Deployment

1. Fork or connect this repo to [Render](https://render.com)
2. Use the **Blueprint** (`render.yaml`) for one-click deploy
3. Add secrets in Render Dashboard:
   - `XAI_API_KEY`
   - `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`
   - `REPLICATE_API_KEY` (if using image generation)

### Blueprint Services

- **xai-bot-worker** — Background Worker (24/7 mention poller)
- **xai-bot-health** — Optional Web Service for `/health` and `/metrics`

### Manual Deploy (without Blueprint)

Create a **Background Worker** service:

- **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
- **Start Command**: `pnpm start`
- Set env vars from the table below.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| X_API_KEY | Yes | X API consumer key |
| X_API_SECRET | Yes | X API consumer secret |
| X_ACCESS_TOKEN | Yes | X OAuth access token |
| X_ACCESS_SECRET | Yes | X OAuth access secret |
| XAI_API_KEY | No | xAI API key (bot runs without LLM if empty) |
| XAI_MODEL_PRIMARY | No | Primary model (default: grok-3) |
| XAI_MODEL_FALLBACKS | No | CSV fallbacks, e.g. grok-3-mini |
| XAI_BASE_URL | No | xAI API base (default: https://api.x.ai/v1) |
| POLL_INTERVAL_MS | No | Poll interval in ms (default: 30000) |
| LOG_LEVEL | No | DEBUG, INFO, WARN, ERROR |
| DRY_RUN | No | true = no posting |
| BOT_USERNAME | No | Bot handle (default: serGorky) |
| BOT_ACTIVATION_MODE | No | global, whitelist, optin |
| REPLICATE_API_KEY | No | For image generation |
| USE_ENHANCED_CONTEXT | No | Enable context engine |

## Runbook

### xAI 403 (Model Permission)

When the primary model (e.g. grok-4) returns 403:

- The bot **does not crash**; it marks the model unavailable for 15 min and tries fallbacks (`XAI_MODEL_FALLBACKS`)
- If all models fail, it returns a canned reply and continues polling
- **Fix**: Set `XAI_MODEL_PRIMARY` to a model your key supports (e.g. `grok-3`)

### Rate Limits (429)

- The worker uses exponential backoff (5s → 10s → 20s … up to 5 min)
- Consecutive failures increase backoff; success resets it
- Check X API tier and xAI quota

### 401 Unauthorized

- **Fail-fast**: The worker exits on 401 (invalid or revoked credentials)
- Verify X OAuth tokens and app permissions in the X Developer Portal

### What the Bot Does

1. Polls X for @mentions every `POLL_INTERVAL_MS`
2. Filters self-mentions and already-processed tweets
3. Runs each through MentionWorkflow: context, command parse, safety, reward, reply
4. Posts reply (or meme) or skips with log reason
5. Persists state to `data/processed_mentions.json`

## Project Structure

```
src/            # TypeScript source (production)
  index.ts      # Entrypoint
  worker/       # Poll loop
  clients/      # X, xAI, Replicate
  workflows/    # MentionWorkflow
  config/       # Env validation
legacy/python/  # Former Python implementation (not used)
render.yaml     # Render Blueprint
Dockerfile.node # Node.js Docker build
```

## Docker

```bash
docker build -f Dockerfile.node -t xai-bot .
docker run --env-file .env xai-bot
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm start` | Run worker (node dist/index.js) |
| `pnpm dev` | Run with tsx watch |
| `pnpm build` | Compile TypeScript |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Run Vitest tests |

## Documentation

See `docs/` for architecture, Phase 2/3 context engine, and operations.
