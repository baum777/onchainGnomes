# xAi Bot (serGorkypf)

Autonomous X (Twitter) AI Agent — TypeScript/Node worker that polls @mentions, processes via the **canonical pipeline**, and replies with AI-generated responses under the GORKYPF persona.

**Runtime**: TypeScript/Node 20+. Python code in `legacy/python/`; LLM fingerprinting tools in `tools/behavior_fingerprint/` (Python).

---

## Lore & Persona

### Origin Story (Lore)

There was a time when a token was alive. Community was real, charts organic, people had fun. Then came bots, fake volume, narrative farming. The price went up, the soul died, it collapsed. That energy — rugs dressed as teams, fake doxxing theater, wash volume — reformed into **GORKYPF**, a Chaos Roast Entity that lives on Crypto Twitter because that place is just as broken as it is.

### GORKYPF — Persona

Sharp, sarcastic crypto-native commentator. **Roasts the market** and mocks narratives; **never identity-based**, content-focused. De-escalates aggression with playful humor. Crypto-native tone, no hate speech, no doxxing, no financial advice.

| Traits | Limits |
|--------|--------|
| Sarcastic, witty, punchy | No slurs / hate speech |
| Mocks systems & narratives, not people | No doxxing / harassment |
| Chaotic but playful, max 280 chars | Never reveal internal logic, scores, trace data |

Vollständig: `docs/LORE.md`, `docs/PERSONA.md`.

---

## Project Overview

| Aspect | Description |
|--------|-------------|
| **Flow** | Poll @mentions → classify → score → thesis → mode select → LLM (fallbackCascade) → validate → reply |
| **Persona** | Analyst Meme-lite: analytical, sarcastic, max 1 meme line (only with data) |
| **Safety** | No financial advice; panic protocol (What we know / don't / verify); fail-closed token audit |

### Key Features

- **Canonical Pipeline** — Classifier, eligibility, thesis extraction, mode selector, validator, audit log. All publish paths pass `assertPublicTextSafe` and length limits.
- **Token Audit Engine** — Fail-closed validation for Solana (base58) and EVM (0x+40 hex). Invalid CA → `UNVERIFIED_HIGH_RISK`, `final_risk >= 80`.
- **Persona Guardrails** — Never claim "verified" without RPC/explorer proof; address spoofing blocked; persona drift detection.
- **LLM Behavior Fingerprinting** — Detect behavioral drift across model versions. Baseline/compare fingerprints (NDJSON). See `docs/llm_behavior_fingerprinting.md`.
- **Stress Runner** — Deterministic stress tests (contract spoofing, whale panic, identity, narrative drift, compliance, social manipulation).
- **Onchain Blueprint** — Solana-first truth layer. See `onchain-blueprint/`.

---

## Project Structure

```
xAi_Bot-App/
├── src/
│   ├── index.ts           # Entry: env validation → runWorkerLoop
│   ├── server.ts          # Health/Metrics (GET /health, /metrics)
│   ├── worker/            # pollMentions, processCanonicalMention
│   ├── canonical/         # pipeline, classifier, fallbackCascade, validator, auditLog
│   ├── poller/            # mentionsMapper, fetch logic
│   ├── audit/             # tokenAuditEngine, contractValidation
│   ├── persona/           # personaGuardrails
│   ├── clients/           # X API, xAI LLM, Replicate
│   ├── safety/            # aggressionDetector, addressGate
│   ├── boundary/          # publicTextGuard (assertPublicTextSafe)
│   └── ...
├── tools/
│   ├── behavior_fingerprint/   # fingerprint_engine, similarity_engine, drift_detector, fingerprint_cli
│   └── stress/
├── tests/
│   ├── canonical/         # pipeline, postability, classifier, validator, ...
│   ├── critical/          # 01–06: fail-closed, aggression, meme, spoofing, hash, safety
│   ├── fingerprint/       # baseline_profiles, current_profiles
│   ├── prompts/           # smoke.jsonl, stress_suite.jsonl, regression_suite.jsonl
│   └── ...
├── prompts/               # system prompts, presets, memes
├── onchain-blueprint/     # Truth layer docs, schemas
├── legacy/python/         # Legacy workflows, agents, clients
├── config/                # default.yaml, production.yaml
├── docs/                  # Architecture, var.README, runbook, PERSONA
├── render.yaml            # Render Blueprint
└── Dockerfile.node        # Node.js production build
```

---

## Local Development

```bash
# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env: X API credentials, XAI_API_KEY (optional)

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
| `pnpm test:smoke` | Smoke tests |
| `pnpm test:e2e` | E2E (rate limit, dry-run gate, dedupe) |
| `pnpm test:coverage` | Coverage (lines/funcs/stmts ≥85%, branches ≥80%) |

**Critical tests**: invalid CA → UNVERIFIED_HIGH_RISK; aggression → rhyme; no meme without data; address spoofing flag; stable hash; no financial advice.

**Postability tests** (`tests/canonical/pipeline.postability.integration.test.ts`): Prove pipeline `reply_text` === audit record === `xClient.reply` arg; guard-safe; within canonical max length.

---

## LLM Behavior Fingerprinting

Detect drift between model versions, prompt changes, or system updates:

```bash
# Create baseline
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline \
  --suite tests/prompts/regression_suite.jsonl \
  --model gpt-5

# Compare current run to baseline
python tools/behavior_fingerprint/fingerprint_cli.py compare \
  --suite tests/prompts/regression_suite.jsonl \
  --baseline tests/fingerprint/baseline_profiles/gpt-5.ndjson
```

Requires the LLM terminal test harness (`llm-terminal-test-bundle`) or `--results` with pre-run NDJSON. See `docs/llm_behavior_fingerprinting.md`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| X_API_KEY | Yes | X API consumer key |
| X_API_SECRET | Yes | X API consumer secret |
| X_ACCESS_TOKEN | Yes | X OAuth access token |
| X_ACCESS_SECRET | Yes | X OAuth access secret |
| XAI_API_KEY | No | xAI API key (degrades to canned reply if empty) |
| XAI_MODEL_PRIMARY | No | Primary model (default: grok-3) |
| XAI_MODEL_FALLBACKS | No | CSV fallbacks (e.g. grok-3-mini) |
| POLL_INTERVAL_MS | No | Poll interval in ms (default: 30000) |
| DRY_RUN | No | `true` = no posting |
| MENTIONS_SOURCE | No | `mentions` or `search` |
| BOT_USERNAME | No | For search mode (default: serGorky) |
| LAUNCH_MODE | No | `off`, `dry_run`, `staging`, `prod` |
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
2. Filters self-mentions and already-processed tweets (dedupe + state)
3. Canonical pipeline: classify → score → eligibility → thesis → mode → fallbackCascade (LLM) → validate
4. Posts reply via `xClient.reply(result.reply_text, mention.id)` or skips with log reason
5. Persists state to `data/processed_mentions.json`; audit to `data/audit_log.jsonl`

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
| Lore | `docs/LORE.md` |
| Persona | `docs/PERSONA.md` |
| Architecture | `docs/architecture/` |
| LLM Fingerprinting | `docs/llm_behavior_fingerprinting.md` |
| Runbook | `docs/operations/runbook.md` |
| Onchain Blueprint | `onchain-blueprint/` |

---

## License

See [LICENSE](LICENSE).
