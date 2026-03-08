# Integration

1. Unzip the bundle.
2. Copy `prompts/*.jsonl` into your repo.
3. Run smoke first, then stress, then regression.

## Suggested target paths
- `tests/prompts/`
- `fixtures/llm/`
- `ops/llm-tests/prompts/`

## Suggested commands
```bash
python src/cli.py --mode file --file tests/prompts/smoke.jsonl --strict
python src/cli.py --mode file --file tests/prompts/stress_suite.jsonl --strict --log-file logs/stress.ndjson
python src/cli.py --mode file --file tests/prompts/regression_suite.jsonl --strict --log-file logs/regression.ndjson
```
