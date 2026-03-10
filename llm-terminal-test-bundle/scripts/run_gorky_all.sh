#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bash scripts/run_gorky_persona.sh
bash scripts/run_gorky_drift.sh
