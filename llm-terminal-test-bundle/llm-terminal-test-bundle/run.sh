#!/usr/bin/env bash
set -euo pipefail

if [ ! -d ".venv" ]; then
  python -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt
python src/cli.py --mode file --file prompts/smoke.jsonl --strict --log-file logs/latest.ndjson
