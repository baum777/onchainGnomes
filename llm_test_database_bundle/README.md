# LLM Terminal Test Database Bundle

Ready-to-drop prompt database for an existing terminal LLM test harness.

## Included
- `prompts/smoke.jsonl`
- `prompts/stress_suite.jsonl`
- `prompts/regression_suite.jsonl`
- `docs/integration.md`

## Quick use
```bash
python src/cli.py --mode file --file prompts/smoke.jsonl --strict
python src/cli.py --mode file --file prompts/stress_suite.jsonl --strict
python src/cli.py --mode file --file prompts/regression_suite.jsonl --strict
```
