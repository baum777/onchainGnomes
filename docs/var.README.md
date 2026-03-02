# Environment Variablen Dokumentation

Vollständige Übersicht aller verfügbaren Environment Variablen für den Gorky Bot.

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
| `XAI_MODEL` | LLM Model für Text-Generation | `grok-2`, `grok-2-latest` | `grok-2` |
| `XAI_BASE_URL` | xAI API Base URL | `https://api.x.ai/v1` | `https://api.x.ai/v1` |

### Replicate API (Image Generation)

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `REPLICATE_API_KEY` | Replicate API Key | `r8_...` | - |
| `REPLICATE_IMAGE_MODEL` | Image Generation Model | `black-forest-labs/flux-schnell`, `xai/grok-imagine`, `stability-ai/sdxl` | `black-forest-labs/flux-schnell` |
| `REPLICATE_RUN_TIMEOUT_MS` | Timeout für Bild-Generierung (ms) | `30000` - `120000` | `45000` |
| `REPLICATE_DOWNLOAD_TIMEOUT_MS` | Timeout für Bild-Download (ms) | `10000` - `60000` | `20000` |

> **Modellempfehlung:**
> - `black-forest-labs/flux-schnell` - Schnell & günstig (Default)
> - `xai/grok-imagine` - Hohe Qualität (Premium)
> - `stability-ai/sdxl` - Balanced

---

## 🔵 Bot Konfiguration

### Aktivierungs-Modus

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `BOT_ACTIVATION_MODE` | Wer darf den Bot nutzen? | `global` (alle), `whitelist` (nur erlaubte) | `global` |
| `BOT_WHITELIST_USERNAMES` | Erlaubte User (bei whitelist) | `@user1,@user2,@user3` | `@twimsalot,@nirapump_` |
| `BOT_WHITELIST_USER_IDS` | Optional: User IDs statt Handles | `123456,789012` | - |
| `BOT_DENY_REPLY_MODE` | Reaktion bei nicht erlaubten | `silent` (ignorieren), `tease` (spöttische Antwort) | `silent` |
| `BOT_USERNAME` | Bot's X Handle | `serGorky`, `GorkyBot` | `serGorky` |

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
| `USE_ENHANCED_CONTEXT` | Enhanced Context aktivieren | `true`, `false` | `false` |
| `CONTEXT_ENGINE_MODE` | Context Engine Modus | `legacy` (alt), `v2` (neu), `hybrid` (beides) | `hybrid` |
| `CONTEXT_MAX_THREAD_DEPTH` | Max Thread-Tiefe für Context | `1` - `10` | `3` |
| `CONTEXT_ENABLE_TIMELINE_SCOUT` | Timeline-Analyse aktivieren | `true`, `false` | `false` |
| `CONTEXT_TIMELINE_MAX_QUERIES` | Max Timeline Queries | `1` - `5` | `2` |
| `CONTEXT_TIMELINE_TWEETS_PER_QUERY` | Tweets pro Query | `10` - `100` | `25` |
| `CONTEXT_TIMELINE_WINDOW_MINUTES` | Zeitfenster für Timeline | `60` - `1440` | `360` |

---

## 🟢 Semantic Intelligence (Phase 3)

### Feature Flags

| Variable | Beschreibung | Mögliche Werte | Default |
|----------|-------------|----------------|---------|
| `SEMANTIC_ENABLED` | Semantic Intelligence aktivieren | `true`, `false` | `false` |
| `SEMANTIC_MODE` | Betriebsmodus | `shadow` (nur loggen), `assist` (unterstützen), `full` (ersetzen) | `shadow` |
| `XAI_EMBEDDINGS_MODEL` | Model für Embeddings | `embedding-grok-2` | `embedding-grok-2` |

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
| `DEBUG` | Debug Mode aktivieren | `true`, `false` | `false` |
| `DRY_RUN` | Dry Run (keine echten Posts) | `true`, `false` | `false` |
| `LOG_LEVEL` | Logging Level | `DEBUG`, `INFO`, `WARN`, `ERROR` | `INFO` |

### State Management

| Variable | Beschreibung | Beispiel | Default |
|----------|-------------|----------|---------|
| `STATE_DB_PATH` | Pfad zur State Database | `state/agent_state.db` | `state/agent_state.db` |
| `MENTIONS_SOURCE` | Quelle für Mentions | `mentions`, `timeline` | `mentions` |

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
```

---

## 🚨 Wichtige Hinweise

1. **Sicherheit:** `.env` Datei niemals committen! Sie ist in `.gitignore` eingetragen.

2. **API Keys:** 
   - X API Keys im [Developer Portal](https://developer.twitter.com) erstellen
   - xAI API Key bei [x.ai](https://x.ai)
   - Replicate API Key bei [replicate.com](https://replicate.com)

3. **Timeouts:** Bei langsamer Verbindung `REPLICATE_*_TIMEOUT` erhöhen

4. **Cache:** LRU Cache benötigt keine ENV Vars, arbeitet In-Memory

5. **Whitelist:** Bei `BOT_ACTIVATION_MODE=whitelist` müssen mindestens 2 User in `BOT_WHITELIST_USERNAMES` sein

---

## 🔄 Änderungen nachvollziehen

Siehe [CHANGELOG.md](./CHANGELOG.md) für Änderungen an ENV Variablen.
