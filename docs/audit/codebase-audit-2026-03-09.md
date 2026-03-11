# Codebase Audit Summary

- **Theme:** Full Repository Consolidation Audit
- **Scope:** Root structure, documentation, environment variables, build/deploy paths
- **Status:** active
- **Consolidated On:** 2026-03-09
- **Auditor:** Repo Consolidation Swarm

---

## 1. Executive Summary

Das Repository `xAi_Bot-App` ist ein **TypeScript/Node.js-basierter X (Twitter) Bot** mit dem Namen `GORKY_ON_SOL-bot`. Die Architektur ist ein Single-App Monolith mit klarer Schichtentrennung. Die Codebasis ist überwiegend sauber, jedoch gibt es **signifikante Inkonsistenzen zwischen Dokumentation und Code**, veraltete Root-Dateien und eine nicht vollständig synchronisierte `.env.example`.

**Kritische Funde:**
1. `docs/var.README.md` ist veraltet (referenziert `XAI_MODEL=grok-2`, Code nutzt `XAI_MODEL_PRIMARY=grok-3`)
2. Root-Level Dokumente `LLM_TESTING_HOWTO.md` und `docs/RUN.md` (deprecated) sind redundant
3. `.env.example` enthält nicht alle tatsächlich genutzten Variablen (z.B. `SOLANA_RPC_*` fehlt)
4. Mehrere `.legacy` und `.incoming` Dateien im Root sind tote Artefakte
5. `README.md` hat inkonsistente Default-Werte (BOT_USERNAME: `serGorky` vs `GORKY_ON_SOL_on_sol`)

---

## 2. Current Repo State

### 2.1 Architektur-Überblick

| Aspekt | Status |
|--------|--------|
| **Runtime** | Node.js 20+, TypeScript ES Modules |
| **Build** | `tsc` → `dist/`, zwei Entry Points (`index.js`, `server.js`) |
| **Test** | Vitest (primary), Pytest (legacy Python) |
| **Deploy** | Render.com (Blueprint: `render.yaml`) |
| **State** | Redis (Upstash) oder Filesystem (`./data`) |
| **Package Manager** | pnpm |

### 2.2 Entry Points

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker-Loop Start (polling) |
| `src/server.ts` | Health/Metrics HTTP Server |
| `dist/index.js` | Production Worker |
| `dist/server.js` | Production Health Server |

### 2.3 Aktive Module

- **Canonical Pipeline:** `src/canonical/` – Herzstück mit Classifier, ModeSelector, Validator
- **Router:** `src/router/` – Agent Tool Router mit Permissions
- **Clients:** `src/clients/` – X API, xAI LLM, Replicate
- **Adapters:** `src/adapters/` – Market (DexScreener, Gecko), Onchain (Solana RPC)
- **State:** `src/state/` – Redis/Filesystem Store, Cursor Persistence
- **Safety:** `src/safety/` – Budget Gate, Aggression Detector, Address Gate
- **Context:** `src/context/` – Enhanced Context, Semantic Intelligence

### 2.4 Tote/Fragliche Bereiche

| Pfad | Status | Begründung |
|------|--------|------------|
| `legacy/python/` | **Explizit Legacy** | Komplette alte Python-Implementierung, nicht aktiv |
| `src/agents/`, `src/commands/`, `src/models/` | **Tote Python-Artefakte** | Nur `__pycache__`, kein TS-Code |
| `Dockerfile.legacy` | **Veraltet** | Nicht mehr verwendet |
| `docker-compose.yml.legacy` | **Veraltet** | Nicht mehr verwendet |
| `pyproject.toml.legacy` | **Veraltet** | Nicht mehr verwendet |
| `requirements.txt.legacy` | **Veraltet** | Nicht mehr verwendet |
| `package.json.incoming` | **Merge-Artefakt** | Horny-bot-persona-bundle, stale |
| `package.json.merge-note.md` | **Dokumentations-Artefakt** | Historisch, nicht aktiv |
| `scripts/dry_run.py` | **Fraglich** | Python-Skript ohne aktive Python-Runtime |
| `scripts/health_check.py` | **Fraglich** | Python-Skript ohne aktive Python-Runtime |
| `scripts/migrate.py` | **Fraglich** | Python-Skript ohne aktive Python-Runtime |
| `state/` (root-level) | **Unklar** | Vermutlich Duplikat zu `data/` |
| `test_minimal.ndjson` (root) | **Falscher Ort** | Sollte in `tests/` liegen |

---

## 3. What is Clearly Working

### 3.1 Build & Deploy

- [x] `pnpm build` → sauberer TypeScript-Build
- [x] `pnpm test` → Vitest-Suite läuft
- [x] `pnpm ci` → typecheck → lint → test → build
- [x] GitHub Actions CI vorhanden (`.github/workflows/ci.yml`)
- [x] Render.com Blueprint funktionsfähig (`render.yaml`)
- [x] Dockerfile.node aktuell und verwendbar

### 3.2 Kern-Funktionalität

- [x] Canonical Pipeline implementiert und getestet
- [x] Token Audit Engine (fail-closed) aktiv
- [x] X API Integration (Read/Write)
- [x] xAI LLM Integration mit Fallback-Cascade
- [x] State Management (Redis + Filesystem)
- [x] Safety & Guardrails (Aggression, Budget, Address)
- [x] Critical Tests vorhanden (01-07)

### 3.3 Dokumentation (Struktur)

- [x] `docs/architecture/` – Übersicht, Components, Data Flow, Deployment
- [x] `docs/workflows/` – Mention Handling, Autonomous Posting, Image Generation
- [x] `docs/operations/` – Runbook, Monitoring, Debugging
- [x] `docs/decisions/` – ADRs (SQLite, Prompt YAML, Workflow Engine)

---

## 4. What is Partial / Inconsistent

### 4.1 Environment Variables (Kritisch)

**Diskrepanz zwischen Code und `.env.example`:**

| Variable | In Code | In `.env.example` | In `docs/var.README.md` |
|----------|---------|-------------------|------------------------|
| `XAI_MODEL_PRIMARY` | ✅ | ✅ | ❌ (nur `XAI_MODEL`) |
| `XAI_MODEL_FALLBACKS` | ✅ | ✅ | ❌ |
| `LAUNCH_MODE` | ✅ | ✅ | ❌ |
| `ALLOWLIST_HANDLES` | ✅ | ✅ | ❌ |
| `SOLANA_RPC_PRIMARY_URL` | ✅ | ❌ | ❌ |
| `SOLANA_RPC_FALLBACK_URL` | ✅ | ❌ | ❌ |
| `DEBUG_ARTIFACTS` | ✅ | ✅ | ❌ |
| `LLM_PROVIDER` | ✅ | ✅ | ❌ |
| `LLM_API_KEY` | ✅ | ✅ | ❌ |
| `SKIP_ENV_VALIDATION` | ✅ | ✅ | ❌ |
| `PUBLISH_RETRY_DELAYS_MS` | ✅ | ✅ | ❌ |
| `MAX_PUBLISH_RETRIES` | ✅ | ✅ | ❌ |
| `RATE_LIMIT_COOLDOWN_MS` | ✅ | ✅ | ❌ |
| `MIN_POLL_INTERVAL_MS` | ✅ | ✅ | ❌ |
| `MAX_POLL_INTERVAL_MS` | ✅ | ✅ | ❌ |
| `EVENT_STATE_TTL_DAYS` | ✅ | ✅ | ❌ |
| `PUBLISHED_TTL_DAYS` | ✅ | ✅ | ❌ |
| `PUBLISH_LOCK_TTL_MS` | ✅ | ✅ | ❌ |
| `CURSOR_SYNC_INTERVAL_MS` | ✅ | ✅ | ❌ |

**Veraltete Variablen in `docs/var.README.md`:**
- `XAI_MODEL` (ersetzt durch `XAI_MODEL_PRIMARY`)
- `DEBUG` (nicht mehr verwendet)
- `STATE_DB_PATH` (nicht mehr verwendet)
- `CONTEXT_ENABLE_TIMELINE_SCOUT` (nicht gefunden)
- `CONTEXT_TIMELINE_*` (nicht gefunden)
- `XAI_EMBEDDINGS_MODEL` (nicht gefunden)

### 4.2 README Inkonsistenzen

| Aspekt | README.md | Realität im Code |
|--------|-----------|------------------|
| `BOT_USERNAME` Default | `serGorky` | `GORKY_ON_SOL_on_sol` |
| `MENTIONS_SOURCE` Default | `mentions` | `search` (in `render.yaml`) |
| `USE_REDIS` Default | nicht erwähnt | `false` (lokal), `true` (Render) |

### 4.3 Dokumentations-Drift

| Dokument | Problem |
|----------|---------|
| `docs/var.README.md` | Veraltete Variablennamen, fehlende neue Variablen |
| `docs/QUICKSTART.md` | Verweist auf `npm`, Repo nutzt `pnpm` |
| `docs/RUN.md` | Markiert als deprecated, aber noch vorhanden |
| `LLM_TESTING_HOWTO.md` (Root) | Redundant zu `docs/llm_behavior_fingerprinting.md` |

---
## 5. What Looks Obsolete

### 5.1 Root-Level Dateien (Löschkandidaten)

| Datei | Aktion | Begründung |
|-------|--------|------------|
| `package.json.incoming` | **Löschen** | Stale Merge-Artefakt |
| `package.json.merge-note.md` | **Löschen** | Historisch, nicht mehr relevant |
| `Dockerfile.legacy` | **Löschen** | Nicht mehr verwendet |
| `docker-compose.yml.legacy` | **Löschen** | Nicht mehr verwendet |
| `pyproject.toml.legacy` | **Löschen** | Nicht mehr verwendet |
| `requirements.txt.legacy` | **Löschen** | Nicht mehr verwendet |
| `test_minimal.ndjson` | **Verschieben** nach `tests/` | Falscher Ort |

### 5.2 Dokumente (Archivierung)

| Datei | Aktion | Begründung |
|-------|--------|------------|
| `docs/RUN.md` | **Löschen** | Bereits als deprecated markiert, Inhalt redundant zu QUICKSTART |
| `LLM_TESTING_HOWTO.md` (Root) | **Verschieben** nach `docs/` oder **Löschen** | Redundant zu `docs/llm_behavior_fingerprinting.md` |

### 5.3 Python-Skripte (Prüfung nötig)

| Skript | Status |
|--------|--------|
| `scripts/dry_run.py` | Nicht ausführbar ohne Python-Runtime |
| `scripts/health_check.py` | Nicht ausführbar ohne Python-Runtime |
| `scripts/migrate.py` | Nicht ausführbar ohne Python-Runtime |

**Empfehlung:** Diese Skripte entweder nach TypeScript portieren oder in `legacy/` verschieben.

---

## 6. Root Cleanup Recommendations

### 6.1 Nach Cleanup verbleibende Root-Dateien

```
xAi_Bot-App/
├── README.md                    # Aktualisiert
├── .env.example                 # Vollständig synchronisiert
├── .gitignore                   # Keep
├── package.json                 # Keep
├── pnpm-lock.yaml              # Keep
├── tsconfig.json               # Keep
├── vitest.config.ts            # Keep
├── eslint.config.js            # Keep
├── render.yaml                 # Keep
├── Dockerfile.node             # Keep
├── .dockerignore               # Keep
├── LICENSE                     # Keep
├── LLM_TESTING_HOWTO.md        # VERSCHIEBEN nach docs/testing/
├── config/                     # Keep
├── docs/                       # Keep (bereinigt)
├── legacy/                     # Keep (explizit Legacy)
├── prompts/                    # Keep
├── schemas/                    # Keep
├── scripts/                    # Keep (TS-Skripte, Python prüfen)
├── src/                        # Keep
├── tests/                      # Keep
├── tools/                      # Keep
├── data/                       # Keep (Runtime-State)
├── memes/                      # Keep (Assets)
├── assets/                     # Keep
├── autopost/                   # Keep (Content)
├── onchain-blueprint/          # Keep
└── state/                      # PRÜFEN: Duplikat zu data/?
```

### 6.2 Zu löschende Root-Dateien

- `package.json.incoming`
- `package.json.merge-note.md`
- `Dockerfile.legacy`
- `docker-compose.yml.legacy`
- `pyproject.toml.legacy`
- `requirements.txt.legacy`

---

## 7. Docs Merge Plan

### 7.1 Kontext-Gruppen

| Gruppe | Zieldatei | Source-Files |
|--------|-----------|--------------|
| **Setup & Env** | `docs/SETUP_AND_ENV.md` (neu) | `QUICKSTART.md` + `var.README.md` (aktualisiert) |
| **Testing** | `docs/testing/LLM_TESTING.md` | `LLM_TESTING_HOWTO.md` (Root) + `llm_behavior_fingerprinting.md` |

### 7.2 Zu aktualisierende Dokumente

| Dokument | Änderung |
|----------|----------|
| `docs/var.README.md` | **Aktualisieren** – Alle Variablen auf IST-Stand bringen |
| `docs/QUICKSTART.md` | **Aktualisieren** – `npm` → `pnpm`, aktuelle Pfade |
| `docs/RUN.md` | **Löschen** – Bereits deprecated |

---

## 8. Env Coverage Findings

### 8.1 Tatsächlich verwendete Variablen (aus Code-Scan)

**Kritisch (Required):**
- `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`

**LLM:**
- `XAI_API_KEY`, `XAI_BASE_URL`, `XAI_MODEL_PRIMARY`, `XAI_MODEL_FALLBACKS`
- `LLM_API_KEY`, `LLM_PROVIDER` (Fallback)
- `LLM_TIMEOUT_MS`

**Image Generation:**
- `REPLICATE_API_KEY`, `REPLICATE_IMAGE_MODEL`
- `REPLICATE_RUN_TIMEOUT_MS`, `REPLICATE_DOWNLOAD_TIMEOUT_MS`

**Bot Config:**
- `BOT_USERNAME`, `BOT_ACTIVATION_MODE`, `BOT_WHITELIST_USERNAMES`
- `BOT_WHITELIST_USER_IDS`, `BOT_DENY_REPLY_MODE`

**Launch & Safety:**
- `LAUNCH_MODE`, `DRY_RUN`, `ALLOWLIST_HANDLES`
- `SKIP_ENV_VALIDATION`, `DEBUG_ARTIFACTS`

**Context & Semantic:**
- `USE_ENHANCED_CONTEXT`, `CONTEXT_ENGINE_MODE`, `CONTEXT_MAX_THREAD_DEPTH`
- `SEMANTIC_ENABLED`, `SEMANTIC_MODE`, `SEMANTIC_TOPK`, `SEMANTIC_CLUSTER_SIM`
- `SEMANTIC_QUERY_MAX_RESULTS`, `SEMANTIC_MEMORY_TTL_DAYS`
- `SEMANTIC_INDEX_TTL_DAYS`, `SEMANTIC_INDEX_MAX_DOCS`

**Polling:**
- `POLL_INTERVAL_MS`, `ADAPTIVE_POLLING_ENABLED`, `MENTIONS_SOURCE`

**Upload:**
- `X_UPLOAD_TIMEOUT_MS`, `X_UPLOAD_MAX_DIM`

**Rate Limiting:**
- `MAX_LLM_CALLS_PER_MINUTE`, `COST_WEIGHT_THREAD`, `COST_WEIGHT_REPLY`

**Fetch & Retry:**
- `FETCH_TIMEOUT_MS`, `FETCH_BACKOFF_BASE_MS`, `FETCH_BACKOFF_MAX_MS`
- `FETCH_RETRY_JITTER_MS`, `RATE_LIMIT_COOLDOWN_MS`
- `MIN_POLL_INTERVAL_MS`, `MAX_POLL_INTERVAL_MS`

**Publish Retry:**
- `PUBLISH_RETRY_DELAYS_MS`, `MAX_PUBLISH_RETRIES`

**State Storage:**
- `USE_REDIS`, `KV_URL`, `REDIS_KEY_PREFIX`, `DATA_DIR`
- `EVENT_STATE_TTL_DAYS`, `PUBLISHED_TTL_DAYS`, `PUBLISH_LOCK_TTL_MS`

**Cursor Persistence:**
- `CURSOR_PERSISTENCE_ENABLED`, `CURSOR_SYNC_INTERVAL_MS`

**On-Chain:**
- `BOT_TOKEN_MINT`, `BOT_TREASURY_WALLET`, `BOT_TICKER`, `BOT_PROGRAM_ID`
- `SOLANA_RPC_PRIMARY_URL`, `SOLANA_RPC_FALLBACK_URL`

**Server:**
- `PORT`, `NODE_ENV`

**Logging:**
- `LOG_LEVEL`

---

## 9. README Mismatch Findings

### 9.1 Aktuelle README-Probleme

| Zeile | Problem | Korrektur |
|-------|---------|-----------|
| 3 | `serGORKY_ON_SOL` → korrekt ist `GORKY_ON_SOL_on_sol` | Aktualisieren |
| 88-89 | `cp .env.example .env` → pnpm verwenden | `pnpm` erwähnen |
| 104 | `DRY_RUN=true pnpm start` → Veraltet | `LAUNCH_MODE=dry_run pnpm start` |
| 163 | `BOT_USERNAME` Default `serGorky` | `GORKY_ON_SOL_on_sol` |
| 167 | `UPSTASH_REDIS_REST_URL` erwähnt | Entfernen, nicht kompatibel |

---

## 10. Risk Notes

### 10.1 Hohes Risiko

- **Env-Variablen-Drift:** Neue Teammitglieder verwenden veraltete `docs/var.README.md` und konfigurieren falsche Variablen
- **Python-Skripte:** `scripts/*.py` sind nicht ausführbar ohne venv, führen zu Verwirrung

### 10.2 Mittleres Risiko

- **Duplizierter State:** `data/` vs `state/` – unklare Trennung
- **Legacy-Artefakte:** Viele `.legacy` Dateien im Root verursachen Verwirrung

### 10.3 Niedriges Risiko

- **README-Inkonsistenzen:** Kosmetisch, aber nicht kritisch
- **Merge-Artefakte:** `package.json.incoming` etc. sind harmlos aber unprofessional

---

## 11. Action Items (Priorisiert)

### P0 (Kritisch)
1. [ ] `docs/var.README.md` auf IST-Stand bringen
2. [ ] `.env.example` vervollständigen (SOLANA_RPC_* hinzufügen)
3. [ ] `README.md` korrigieren (BOT_USERNAME, LAUNCH_MODE)

### P1 (Wichtig)
4. [ ] Root-Dateien löschen: `package.json.incoming`, `package.json.merge-note.md`
5. [ ] Root-Dateien löschen: `Dockerfile.legacy`, `docker-compose.yml.legacy`
6. [ ] Root-Dateien löschen: `pyproject.toml.legacy`, `requirements.txt.legacy`
7. [ ] `docs/RUN.md` löschen (bereits deprecated)

### P2 (Optional)
8. [ ] `LLM_TESTING_HOWTO.md` nach `docs/testing/` verschieben
9. [ ] Python-Skripte in `scripts/` prüfen/verschieben
10. [ ] `test_minimal.ndjson` nach `tests/` verschieben
11. [ ] `state/` vs `data/` Klärung

---

*Ende der Audit-Summary*
