# xAi Bot (GORKY_ON_SOL)

Autonomous X (Twitter) AI Agent — TypeScript/Node worker that polls @mentions, processes via the **canonical pipeline**, and replies with AI-generated responses under the GORKY_ON_SOL persona.

**Runtime**: TypeScript/Node 20+. Python code in `legacy/python/`; LLM fingerprinting tools in `tools/behavior_fingerprint/` (Python).

---

## Lore & Persona

### Origin Story (Lore)

There was a time when a token was alive. Community was real, charts organic, people had fun. Then came bots, fake volume, narrative farming. The price went up, the soul died, it collapsed. That energy — rugs dressed as teams, fake doxxing theater, wash volume — reformed into **GORKY**, a Chaos Roast Entity that lives on Crypto Twitter because that place is just as broken as it is.

### GORKY — Persona

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
- **GNOMES (Multi-Persona)** — Optional multi-gnome ensemble architecture. When `GNOMES_ENABLED=true`, the system supports multiple personas (GORKY, MOSS, SPARK, …), gnome selection per interaction, and gnome-composed prompts. GORKY remains the default fallback. See `.env.example` for `GNOMES_ENABLED`, `DEFAULT_SAFE_GNOME`, `GNOME_MEMORY_ENABLED`.

---

## Project Structure

```
xAi_Bot-App/
├── src/
│   ├── index.ts           # Entry: env validation → runWorkerLoop
│   ├── server.ts          # Health/Metrics (GET /health, /metrics)
│   ├── worker/            # pollMentions, processCanonicalMention
│   ├── canonical/         # pipeline, classifier, fallbackCascade, validator, auditLog
│   ├── gnomes/            # types, registry, loadGnomes (multi-persona)
│   ├── routing/           # gnomeSelector, selectorFeatures, continuityResolver
│   ├── prompts/           # composeGnomePrompt, promptFragments
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

## Architecture

### State Management (Single Source of Truth)

All runtime state (cursor, processed mentions, event lifecycle, publish idempotency) lives in **StateStore** (Redis or FileSystem). No parallel JSON files or in-memory shadows.

| Concept | Storage |
|---------|---------|
| Cursor (since_id) | `store.getCursor()` / `store.setCursor()` |
| Processed / Idempotency | `eventStateStore` (event_state + published) |
| Publish locks | StateStore `acquirePublishLock` / `releasePublishLock` |
| Worker heartbeat | `worker:last_poll_success` in StateStore (cross-process Health) |

### Deployment Modes (Betriebsregel)

| Mode | Store | Multi-Worker | Verwendung |
|------|-------|--------------|------------|
| **Redis** | `USE_REDIS=true` + `KV_URL` | **Ja** | Production mit 2+ Instanzen. Distributed Poll-Lock und Leader Election erfordern Redis. |
| **FileSystem** | Default (ohne Redis) | **Nein** | Lokale Entwicklung, Single-Instance nur. Poll-Lock ist nicht distributed — mehrere Worker würden parallel pollen. |

**Betriebsregel:** Multi-Worker Production Deployment ist **nur mit Redis** freigegeben. FileSystem = single-instance only.

### Cursor-Advance-Policy

Der Cursor (`since_id`) steuert, ab welchem Tweet die nächste Poll-Anfrage startet.

| Regel | Bedeutung |
|-------|-----------|
| **Fortschreibung** | Cursor wird nur nach **erfolgreichem** Poll (fetch + Verarbeitung) fortgeschrieben |
| **Grundlage** | `maxId` aus der API-Antwort — höchste Tweet-ID der aktuellen Batch |
| **Wann** | Erst nachdem alle Mentions im Batch verarbeitet wurden (oder übersprungen); dann `store.setCursor({ since_id: maxId, ... })` |
| **Partial Failures** | Einzelne Mention-Fehler brechen den Zyklus nicht ab; der Cursor wird trotzdem auf `maxId` gesetzt. Bereits gesehene Mentions sind in `event_state`/`published`; kein Re-Fetch nötig |
| **Crash vor Advance** | Cursor bleibt unverändert. Nach Restart wird derselbe Bereich erneut gefetcht. Dedupe via `isProcessed`/`isPublished` verhindert Doppelposts |
| **Safety** | Keine Events verloren (Cursor springt nie blind nach vorn); kein Doppeln (Idempotenz-State vor Advance) |

**Migration**: Legacy `processed_mentions.json` is auto-migrated on first run; the file is renamed to `.migrated`.

### Health / Ready Semantics

| Endpoint | Meaning |
|----------|---------|
| `GET /health` | Full check: store reachable, recent poll success (worker heartbeat), audit buffer, cursor, failure streak |
| `GET /ready` | Lightweight: store `ping()` only |
| `GET /metrics` | Uptime gauge |

Worker writes `worker:last_poll_success` to StateStore on each successful poll. The Health service (separate process) reads it — so Health reflects real worker activity when both use the same Redis.

**Security:** Never commit real secrets. Rotate keys if they ever appeared in the repo.

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
LAUNCH_MODE=dry_run pnpm start
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

### Konversations-Simulation (Multi-Turn & Reply)

Simuliert realistische Q&A-Abläufe mit Thread-Kontext (`parent_text`, `conversation_context`). Erforderlich für Regressionstests von konversationellem Verhalten.

| Script | Description |
|--------|-------------|
| `pnpm simulate` | Durchspielen der Szenarien (JSONL oder Built-in) |
| `pnpm simulate:ci` | Wie `simulate`, aber `exit 1` bei Fehlschlag (CI-tauglich) |

```bash
# Standard (lädt scripts/scenarios/conversation_scenarios.jsonl)
pnpm simulate

# Eigene Szenarien
pnpm simulate --file path/to/scenarios.jsonl

# CI-Modus: schlägt fehl bei fehlenden Keywords oder Pipeline-Skip
pnpm simulate:ci
```

**Szenarien-Format**: JSONL, eine Zeile = ein Szenario. Siehe `scripts/scenarios/README.md`.

### Persona Memory Snippets (tägliche Extraktion)

Täglicher Cron-Job extrahiert Roast-Muster aus erfolgreichen Mentions und speichert sie in Redis. Wird bei Standalone-Mentions in den Prompt eingebunden.

```bash
# Manueller Run (lokal, mit KV_URL und XAI_API_KEY)
KV_URL=redis://... XAI_API_KEY=... pnpm snippets:extract

# Prüfen in Redis
redis-cli GET GORKY_ON_SOL:persona:memory:snippets
```

Render Cron: `gorky-daily-snippets` (täglich 3 Uhr UTC).

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
| **USE_REDIS** | No | `true` to use Redis for state storage (default: `false`) |
| **KV_URL** | When USE_REDIS=true | Redis connection URL: `redis://default:PASS@HOST.upstash.io:6379` |
| **REDIS_KEY_PREFIX** | No | Prefix for Redis keys (default: `GORKY_ON_SOL:`) |
| POLL_INTERVAL_MS | No | Poll interval in ms (default: 30000) |
| DRY_RUN | No | `true` = no posting |
| MENTIONS_SOURCE | No | `mentions` or `search` |
| BOT_USERNAME | No | For search mode (default: GORKY_ON_SOL_on_sol) |
| LAUNCH_MODE | No | `off`, `dry_run`, `staging`, `prod` |
| REPLICATE_API_KEY | No | For image generation |

**Note:** When `USE_REDIS=true`, you must provide a valid `KV_URL` with the `redis://` protocol. Get this from your Upstash Console: Connect > Node.js > ioredis. The legacy `UPSTASH_REDIS_REST_URL` (HTTPS) is not compatible with the ioredis library.

Full list: `docs/var.README.md`.

---

## Architecture

### State Management (Single Source of Truth)

State ist zentralisiert über den `StateStore` (Redis oder FileSystem):

| Konzept | Quelle | Beschreibung |
|--------|--------|--------------|
| Cursor (since_id) | `store.getCursor()` / `store.setCursor()` | Pagination für Mention-Fetch |
| Processed / Publish | `eventStateStore` (Event-State + Published) | Idempotenz, keine Doppelreplies |
| Worker Heartbeat | `worker:last_poll_success` in StateStore | Health-Service liest Worker-Status cross-process |

**Redis vs FileSystem:** Mit `USE_REDIS=true` und `KV_URL` nutzt der Bot Redis; andernfalls den lokalen FileSystem-Store. Redis ist für Produktion empfohlen (shared state, Restart-sicher). Der Worker-Heartbeat funktioniert cross-process nur mit Redis.

### Health / Ready Semantik

| Endpoint | Bedeutung |
|----------|-----------|
| `GET /health` | Vollständiger Report: state_store_reachable, recent_poll_success (Worker-Heartbeat), audit_logger, cursor, backlog_stuck |
| `GET /ready` | Leichtgewichtig: `store.ping()` |
| `GET /metrics` | Prometheus-artig: bot_uptime_seconds |

Der Worker schreibt bei jedem erfolgreichen Poll `worker:last_poll_success` in den StateStore. Der Health-Service (separater Prozess) liest diesen Key — mit Redis sieht er den echten Worker-Status.

---

## Render Deployment

1. Connect repo to [Render](https://render.com)
2. Use Blueprint (`render.yaml`) for one-click deploy
3. Add secrets in Render Dashboard:
   - `XAI_API_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`
   - `REPLICATE_API_KEY` (optional)
   - `KV_URL` (required when `USE_REDIS=true`): Get from Upstash Console → Connect → Node.js → ioredis

**Important:** The `KV_URL` must use the `redis://` protocol, not `https://`. Upstash provides both REST and TCP connections; this bot requires the TCP (ioredis) connection. The legacy `UPSTASH_REDIS_REST_URL` (HTTPS) is not compatible.

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
5. Persists state via **StateStore** (Redis or FileSystem); audit to `data/audit_log.jsonl`

### State Management (Single Source of Truth)

- **StateStore** (Redis or FileSystem) is the single source for: cursor (since_id), processed mentions (event_state), publish idempotency
- No local JSON files for state; migration from legacy `processed_mentions.json` runs once on startup
- Worker heartbeat (`worker:last_poll_success`) written to StateStore for cross-process Health checks

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
