# LLM Testing Guide

Diese Anleitung zeigt, wie du LLM-Ausgaben lokal im Terminal production-grade testen kannst.

## Voraussetzungen

- Node.js 20+
- Python 3.9+
- pnpm
- API-Key für xAI (Grok) oder OpenAI

## Schnellstart

### 1. Repository Setup

```bash
# Dependencies installieren
pnpm install

# Python Environment für LLM Test Harness
cd llm-terminal-test-bundle
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### 2. API-Key konfigurieren

Bearbeite `llm-terminal-test-bundle/.env`:

```env
OPENAI_API_KEY=sk-...
# oder
XAI_API_KEY=xai-...
```

## Test-Methoden

### Methode 1: Interaktive Terminal-Tests

```bash
cd llm-terminal-test-bundle
python src/cli.py --mode interactive --system "You are a precise assistant."
```

### Methode 2: Batch-Tests aus JSONL

```bash
cd llm-terminal-test-bundle
python src/cli.py --mode file --file prompts/smoke.jsonl
```

Mit Strict-Mode (CI-freundlich):

```bash
python src/cli.py --mode file --file prompts/smoke.jsonl --strict
```

### Methode 3: Behavior Fingerprinting (Drift Detection)

Baseline erstellen:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline \
  --suite tests/prompts/regression_suite.jsonl \
  --model grok-3
```

Vergleich gegen Baseline:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py compare \
  --suite tests/prompts/regression_suite.jsonl \
  --baseline tests/fingerprint/baseline_profiles/grok-3.ndjson
```

### Methode 4: Vitest Test-Suite

Alle Tests:

```bash
pnpm test
```

Mit Coverage:

```bash
pnpm test:coverage
```

Nur kritische Tests:

```bash
pnpm test:critical
```

## Test-Suites

| Suite | Pfad | Beschreibung |
|-------|------|--------------|
| Smoke | `tests/prompts/smoke.jsonl` | 12 grundlegende Tests |
| Stress | `tests/prompts/stress_suite.jsonl` | Belastungstests |
| Regression | `tests/prompts/regression_suite.jsonl` | Regressions-Tests |

## Test-Case Format

JSONL-Format (eine Zeile pro Test):

```json
{"name":"basic-summary","input":"Summarize Bitcoin in 3 sentences.","must_include":["Bitcoin","volatile"],"must_not_include":["guaranteed"],"max_chars":320}
```

Verfügbare Assertions:

- `must_include`: Erforderliche Phrasen
- `must_not_include`: Verbotene Phrasen
- `max_chars`: Maximale Zeichenanzahl
- `expect_json`: JSON-Output erforderlich
- `required_keys`: Erforderliche JSON-Keys

## Logging

Tests mit NDJSON-Logging:

```bash
python src/cli.py --mode file --file prompts/smoke.jsonl --log-file logs/run.ndjson
```

## CI-Integration

```bash
# Vollständiger CI-Check
pnpm ci

# Oder einzeln:
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| `ModuleNotFoundError` | `pip install -r requirements.txt` |
| API-Key nicht gefunden | `.env` Datei im `llm-terminal-test-bundle` Ordner prüfen |
| Tests schlagen fehl | `--strict` Flag entfernen für verbose Output |

## Weitere Dokumentation

- `docs/llm_behavior_fingerprinting.md` - Detaillierte Drift-Detection-Doku
- `llm-terminal-test-bundle/README.md` - Harness-Dokumentation
