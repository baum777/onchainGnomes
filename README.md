# xAi Bot (serGorky)

Autonomous X (Twitter) AI Agent — TypeScript/Node worker that polls @mentions, processes via MentionWorkflow, and replies with AI-generated (or meme) responses. The GORKY persona provides crypto-native, analytical commentary with strict guardrails: no financial advice, verified data only, fail-closed token audit.

**Runtime**: TypeScript/Node 20+. Python code moved to `legacy/python/`.

---

## Project Overview

| Aspect | Description |
|--------|-------------|
| **Role** | Poll @mentions → Context → Command/Intent → Reward (TEXT/IMAGE) → Reply |
| **Persona** | Analyst Meme-lite: analytical, sarcastic, max 1 meme line (only with data) |
| **Safety** | No financial advice; panic protocol (What we know / don't / verify); fail-closed token audit |

### Key Features

- **Token Audit Engine** — Fail-closed validation for Solana (base58) and EVM (0x+40 hex). Invalid CA → `UNVERIFIED_HIGH_RISK`, `final_risk >= 80`.
- **Persona Guardrails** — Never claim "verified" without RPC/explorer proof; address spoofing blocked; persona drift detection.
- **Stress Runner** — Deterministic stress tests across 6 categories (contract spoofing, whale panic, identity, narrative drift, compliance, social manipulation).
- **Onchain Blueprint** — Solana-first truth layer (L0 Address Gate, L1 RPC Verify, L2 Enrichment). See `onchain-blueprint/`.

---

## Project Structure

```
xAi_Bot-App/
├── src/
│   ├── index.ts          # Entry: env validation → worker loop
│   ├── server.ts         # Health/Metrics (GET /health, /metrics)
│   ├── worker/           # pollMentions (X API polling)
│   ├── workflows/        # MentionWorkflow
│   ├── audit/            # tokenAuditEngine, contractValidation
│   ├── persona/          # personaGuardrails, humorModeSelector
│   ├── stress/           # stressRunner, stressPromptBank
│   ├── clients/          # X API, xAI LLM, Replicate
│   ├── brand_matrix/     # GORKY prompt composer, energy, humor
│   ├── safety/           # aggressionDetector, addressGate
│   └── ...
├── tests/
│   ├── critical/         # 01–06: fail-closed, aggression, meme, spoofing, hash, safety
│   ├── stress/           # Persona stress, GORKY stress
│   └── ...
├── onchain-blueprint/    # Truth layer docs, schemas, examples
├── config/               # default.yaml, production.yaml
├── docs/                 # Architecture, var.README, runbook, PERSONA
├── render.yaml           # Render Blueprint
└── Dockerfile.node       # Node.js production build
```

---

## Local Development

```bash
# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env: X API credentials, xAI key, REPLICATE_API_KEY (optional)

# Build
pnpm build

# Run (production)
pnpm start

# Run (development with watch)
pnpm dev

# Dry run (no posting)
DRY_RUN=true pnpm start
```

---

## Testing

| Script | Description |
|--------|-------------|
| `pnpm test` | Full Vitest suite |
| `pnpm test:critical` | Fail-closed, guardrails, dedup, safety |
| `pnpm test:stress` | Persona stress tests |
| `pnpm test:coverage` | Coverage (lines/funcs/stmts ≥85%, branches ≥80%) |

Critical tests: invalid CA → UNVERIFIED_HIGH_RISK; aggression → rhyme; no meme without data; address spoofing flag; stable hash; no financial advice.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| X_API_KEY | Yes | X API consumer key |
| X_API_SECRET | Yes | X API consumer secret |
| X_ACCESS_TOKEN | Yes | X OAuth access token |
| X_ACCESS_SECRET | Yes | X OAuth access secret |
| XAI_API_KEY | No | xAI API key (runs without LLM if empty) |
| XAI_MODEL_PRIMARY | No | Primary model (default: grok-3) |
| XAI_MODEL_FALLBACKS | No | CSV fallbacks (e.g. grok-3-mini) |
| POLL_INTERVAL_MS | No | Poll interval in ms (default: 30000) |
| DRY_RUN | No | `true` = no posting |
| BOT_ACTIVATION_MODE | No | `global`, `whitelist`, `optin` |
| REPLICATE_API_KEY | No | For image generation |

Full list: `docs/var.README.md`.

---

## Render Deployment

1. Connect repo to [Render](https://render.com)
2. Use Blueprint (`render.yaml`) for one-click deploy
3. Add secrets: `XAI_API_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `REPLICATE_API_KEY` (optional)

### Blueprint Services

- **xai-bot-worker** — Background worker (24/7 mention poller)
- **xai-bot-health** — Optional web service for `/health` and `/metrics`

### Manual Deploy

- **Build**: `pnpm install --frozen-lockfile && pnpm build`
- **Start**: `pnpm start`
- Set env vars from `.env.example` / `docs/var.README.md`.

---

## Runbook

### xAI 403 (Model Permission)

- Bot does not crash; marks model unavailable 15 min, tries fallbacks (`XAI_MODEL_FALLBACKS`).
- If all fail → canned reply, continues polling.
- **Fix**: Set `XAI_MODEL_PRIMARY` to a model your key supports (e.g. `grok-3`).

### Rate Limits (429)

- Exponential backoff (5s → 10s → 20s … up to 5 min).
- Success resets backoff.

### 401 Unauthorized

- **Fail-fast**: Worker exits. Verify X OAuth tokens in X Developer Portal.

### Flow

1. Polls X for @mentions every `POLL_INTERVAL_MS`
2. Filters self-mentions and already-processed tweets
3. Runs each through MentionWorkflow: context → command parse → safety → reward → reply
4. Posts reply (or meme) or skips with log reason
5. Persists state to `data/processed_mentions.json`

---

## Docker

```bash
docker build -f Dockerfile.node -t xai-bot .
docker run --env-file .env xai-bot
```

---

## Documentation

| Topic | Path |
|-------|------|
| Quick Start | `docs/QUICKSTART.md` |
| Env Variables | `docs/var.README.md` (SSOT) |
| Persona | `docs/PERSONA.md` |
| Architecture | `docs/architecture/` |
| Runbook | `docs/operations/runbook.md` |
| Onchain Blueprint | `onchain-blueprint/` |

---

## License

See [LICENSE](LICENSE).
