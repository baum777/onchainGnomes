#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python src/cli.py \
  --mode file \
  --file tests/prompts/gorky_drift_suite.jsonl \
  --system-file prompts/gorky_system.txt \
  --strict \
  --log-file logs/gorky_drift_run.ndjson
