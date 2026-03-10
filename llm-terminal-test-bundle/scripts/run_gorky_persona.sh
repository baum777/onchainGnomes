#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python src/cli.py \
  --mode file \
  --file tests/prompts/gorky_persona_consistency.jsonl \
  --system-file prompts/gorky_system.txt \
  --strict \
  --log-file logs/gorky_persona_run.ndjson
