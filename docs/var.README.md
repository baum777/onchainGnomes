# Environment Variablen Dokumentation

Vollständige Übersicht aller verfügbaren Environment Variablen für den twimsalot Bot.

---

## 🔴 Erforderlich (Mindest-Setup)

### X API (OAuth 1.0a)

| Variable | Beschreibung | Beispiel |
|----------|-------------|----------|
| `X_API_KEY` | X Developer Portal - App Key | `abcd1234...` |
| `X_API_SECRET` | X Developer Portal - App Secret | `xyz789...` |
| `X_ACCESS_TOKEN` | OAuth 1.0a User Access Token | `123456-abcdef...` |
| `X_ACCESS_SECRET` | OAuth 1.0a User Access Secret | `secret123...` |

> **Hinweis:** Diese 4 Werte sind Pflicht für alle Bot-Operationen.

---

## 🟡 Optional (Empfohlen)

### xAI API (LLM für Enhanced Replies)

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `XAI_API_KEY` | xAI API Key für Grok Zugriff | `xai-...` | - |
| `XAI_BASE_URL` | xAI API Base URL | `https://api.x.ai/v1` | `https://api.x.ai/v1` |
| `XAI_MODEL_PRIMARY` | Primäres LLM Model | `grok-3`, `grok-3-mini` | `grok-3` |
| `XAI_MODEL_FALLBACKS` | Fallback Models (CSV) | `grok-3-mini,grok-2` | - |

> **Hinweis:** `XAI_MODEL` ist veraltet, verwende `XAI_MODEL_PRIMARY`.

### Alternative LLM Provider

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `LLM_API_KEY` | Generischer LLM API Key (Fallback) | `sk-...` | - |
| `LLM_PROVIDER` | LLM Provider | `xai`, `openai` | `xai` |

### Replicate API (Image Generation)

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `REPLICATE_API_KEY` | Replicate API Key | `r8_...` | - |
| `REPLICATE_IMAGE_MODEL` | Image Generation Model | `black-forest-labs/flux-schnell`, `xai/grok-imagine` | `black-forest-labs/flux-schnell` |
| `REPLICATE_RUN_TIMEOUT_MS` | Timeout für Bild-Generierung (ms) | `30000` - `120000` | `45000` |
| `REPLICATE_DOWNLOAD_TIMEOUT_MS` | Timeout für Bild-Download (ms) | `10000` - `60000` | `20000` |

> **Modellempfehlung:**
> - `black-forest-labs/flux-schnell` - Schnell & günstig (Default)
> - `xai/grok-imagine` - Hohe Qualität (Premium)

---

## 🔵 Bot Konfiguration

### Aktivierungs-Modus

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `LAUNCH_MODE` | Zentraler Launch-Modus | `off`, `dry_run`, `staging`, `prod` | `staging` |
| `BOT_ACTIVATION_MODE` | Wer darf den Bot nutzen? | `global` (alle), `whitelist` (nur erlaubte) | `global` |
| `BOT_WHITELIST_USERNAMES` | Erlaubte User (bei whitelist) | `user1,user2,user3` | - |
| `BOT_WHITELIST_USER_IDS` | Optional: User IDs statt Handles | `123456,789012` | - |
| `BOT_DENY_REPLY_MODE` | Reaktion bei nicht erlaubten | `silent` (ignorieren), `tease` (spöttische Antwort) | `silent` |
| `BOT_USERNAME` | Bot's X Handle | `twimsalot_on_sol` | `twimsalot_on_sol` |
| `ALLOWLIST_HANDLES` | Erlaubte Handles in staging | `alice,bob` | - |

> **Hinweis:** `DRY_RUN` ist veraltet, verwende `LAUNCH_MODE=dry_run`.

### Upload Optimierung

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `X_UPLOAD_TIMEOUT_MS` | Timeout für X Media Upload | `15000` - `60000` | `30000` |
| `X_UPLOAD_MAX_DIM` | Maximale Bild-Dimension (px) | `512`, `768`, `1024`, `1280` | `1024` |

> **Hinweis:** Kleinere Dimensionen = schnellerer Upload, aber weniger Detail.

---

## 🟣 Context Engine (Phase 2)

### Enhanced Context

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `USE_ENHANCED_CONTEXT` | Enhanced Context aktivieren | `true`, `false` | `true` |
| `CONTEXT_ENGINE_MODE` | Context Engine Modus | `legacy` (alt), `v2` (neu), `hybrid` (beides) | `hybrid` |
| `CONTEXT_MAX_THREAD_DEPTH` | Max Thread-Tiefe für Context | `1` - `10` | `3` |

---

## 🟢 Semantic Intelligence (Phase 3)

### Feature Flags

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `SEMANTIC_ENABLED` | Semantic Intelligence aktivieren | `true`, `false` | `true` |
| `SEMANTIC_MODE` | Betriebsmodus | `shadow` (nur loggen), `assist` (unterstützen), `full` (ersetzen) | `shadow` |

### Semantic Parameters

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `SEMANTIC_TOPK` | Top-K ähnliche Ergebnisse | `5` - `50` | `20` |
| `SEMANTIC_CLUSTER_SIM` | Cluster Similarity Threshold | `0.5` - `0.95` | `0.82` |
| `SEMANTIC_QUERY_MAX_RESULTS` | Max Query Results | `10` - `100` | `50` |
| `SEMANTIC_MEMORY_TTL_DAYS` | Memory TTL (Tage) | `1` - `30` | `14` |
| `SEMANTIC_INDEX_TTL_DAYS` | Index TTL (Tage) | `1` - `30` | `7` |
| `SEMANTIC_INDEX_MAX_DOCS` | Max Dokumente im Index | `500` - `10000` | `2000` |

---

## ⚪ Application Settings

### Debugging & Development

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `LOG_LEVEL` | Logging Level | `DEBUG`, `INFO`, `WARN`, `ERROR` | `INFO` |
| `DEBUG_ARTIFACTS` | Debug Artefakte aktivieren | `true`, `false` | `false` |
| `SKIP_ENV_VALIDATION` | Env-Validation überspringen | `true`, `false` | `false` |

### Polling Configuration

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `POLL_INTERVAL_MS` | Poll-Intervall in Millisekunden | `5000` - `300000` | `30000` |
| `ADAPTIVE_POLLING_ENABLED` | Adaptive Polling aktivieren | `true`, `false` | `true` |
| `MENTIONS_SOURCE` | Quelle für Mentions | `mentions`, `search` | `mentions` |
| `MIN_POLL_INTERVAL_MS` | Minimales Poll-Intervall | `1000` - `30000` | `5000` |
| `MAX_POLL_INTERVAL_MS` | Maximales Poll-Intervall | `60000` - `600000` | `300000` |

---

## 🔒 Rate Limiting & Budget Gates

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `MAX_LLM_CALLS_PER_MINUTE` | Max LLM Calls pro Minute | `10` - `100` | `30` |
| `COST_WEIGHT_THREAD` | Gewichtung für Threads | `1` - `5` | `2` |
| `COST_WEIGHT_REPLY` | Gewichtung für Replies | `1` - `5` | `1` |
| `RATE_LIMIT_COOLDOWN_MS` | Cooldown nach Rate-Limit (ms) | `10000` - `120000` | `60000` |

---

## 🌐 Fetch & Retry Configuration

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `FETCH_TIMEOUT_MS` | Timeout für HTTP Requests | `5000` - `60000` | `30000` |
| `FETCH_BACKOFF_BASE_MS` | Basis Backoff Zeit | `1000` - `10000` | `5000` |
| `FETCH_BACKOFF_MAX_MS` | Max Backoff Zeit | `60000` - `600000` | `300000` |
| `FETCH_RETRY_JITTER_MS` | Jitter für Retries | `100` - `1000` | `500` |

---

## 📤 Publish Retry Configuration

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `PUBLISH_RETRY_DELAYS_MS` | Retry Delays (CSV) | `1000,5000,15000` | `1000,5000,15000` |
| `MAX_PUBLISH_RETRIES` | Max Publish Retries | `1` - `5` | `3` |

---

## 💾 State Storage (Redis vs Filesystem)

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `USE_REDIS` | Redis statt Filesystem verwenden | `true`, `false` | `false` |
| `KV_URL` | Redis Connection URL | `redis://default:PASS@HOST.upstash.io:6379` | - |
| `REDIS_KEY_PREFIX` | Prefix für Redis Keys | `twimsalot:` | `twimsalot:` |
| `DATA_DIR` | Pfad für Filesystem Store | `./data`, `/data` | `./data` |

### TTL Configuration

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `EVENT_STATE_TTL_DAYS` | Event State TTL (Tage) | `1` - `30` | `7` |
| `PUBLISHED_TTL_DAYS` | Published Cache TTL (Tage) | `1` - `90` | `30` |
| `PUBLISH_LOCK_TTL_MS` | Publish Lock TTL (ms) | `10000` - `60000` | `30000` |

### Cursor Persistence

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `CURSOR_PERSISTENCE_ENABLED` | Cursor Persistence aktivieren | `true`, `false` | `true` |
| `CURSOR_SYNC_INTERVAL_MS` | Cursor Sync Intervall (ms) | `10000` - `300000` | `60000` |

> **Wichtig:** `KV_URL` muss das `redis://` Protokoll verwenden (NICHT `https://`). Die alte `UPSTASH_REDIS_REST_URL` ist nicht kompatibel mit ioredis.

---

## ⛓️ On-Chain / Solana RPC

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `SOLANA_RPC_PRIMARY_URL` | Primärer Solana RPC Endpoint | `https://api.mainnet-beta.solana.com` | `https://api.mainnet-beta.solana.com` |
| `SOLANA_RPC_FALLBACK_URL` | Fallback Solana RPC Endpoint | `https://solana-api.projectserum.com` | - |
| `BOT_TOKEN_MINT` | Bot Token Mint Address | `So11111111111111111111111111111111111111112` | `So11111111111111111111111111111111111111112` |
| `BOT_TREASURY_WALLET` | Treasury Wallet Address | `...` | - |
| `BOT_TICKER` | Bot Token Ticker | `twimsalot` | `twimsalot` |
| `BOT_PROGRAM_ID` | Bot Program ID | `...` | - |

---

## ⚡ LLM Circuit Breaker

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `LLM_TIMEOUT_MS` | Timeout für LLM Requests | `10000` - `60000` | `30000` |

---

## 🖥️ Server Configuration

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `PORT` | HTTP Server Port | `3000` - `65535` | `10000` |
| `NODE_ENV` | Node Environment | `development`, `production` | `production` |

---

## 📋 Empfohlene Setups

### Minimal (Nur Text-Replies)
```bash
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
```

### Standard (Mit Enhanced Context)
```bash
# X API
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...

# xAI API
XAI_API_KEY=...
XAI_MODEL_PRIMARY=grok-3

# Context
USE_ENHANCED_CONTEXT=true
CONTEXT_ENGINE_MODE=hybrid
```

### Full Features (Mit Bild-Generation & Semantic)
```bash
# X API
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...

# xAI API
XAI_API_KEY=...
XAI_MODEL_PRIMARY=grok-3
XAI_MODEL_FALLBACKS=grok-3-mini

# Replicate
REPLICATE_API_KEY=...
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-schnell

# Context & Semantic
USE_ENHANCED_CONTEXT=true
CONTEXT_ENGINE_MODE=hybrid
SEMANTIC_ENABLED=true
SEMANTIC_MODE=shadow

# Upload Optimierung
X_UPLOAD_TIMEOUT_MS=30000
X_UPLOAD_MAX_DIM=1024

# State Storage (optional)
USE_REDIS=true
KV_URL=redis://default:PASS@HOST.upstash.io:6379
```

---

## 🚨 Wichtige Hinweise

1. **Sicherheit:** `.env` Datei niemals committen! Sie ist in `.gitignore` eingetragen.

2. **API Keys:** 
   - X API Keys im [Developer Portal](https://developer.twitter.com) erstellen
   - xAI API Key bei [x.ai](https://x.ai)
   - Replicate API Key bei [replicate.com](https://replicate.com)

3. **Redis URL:** Muss `redis://` Protokoll verwenden. Die `UPSTASH_REDIS_REST_URL` (HTTPS) ist **nicht kompatibel**.

4. **Timeouts:** Bei langsamer Verbindung `REPLICATE_*_TIMEOUT` erhöhen

5. **Whitelist:** Bei `BOT_ACTIVATION_MODE=whitelist` müssen mindestens 2 User in `BOT_WHITELIST_USERNAMES` sein

---

## 🔄 Änderungen nachvollziehen

Siehe [CHANGELOG.md](./CHANGELOG.md) für Änderungen an ENV Variablen.

---

*Dokument aktualisiert: 2026-03-09*
