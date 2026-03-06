# LLM Terminal Test Bundle

A complete terminal-first test harness for LLM responses.

## Features

- Interactive prompt testing in the terminal
- Batch test execution from JSONL files
- Assertion engine for response quality checks
- Optional JSON parsing and JSON Schema validation
- Latency measurement
- Token usage reporting when available
- NDJSON run logs for later review
- CI-friendly exit codes
- Colorized terminal output via `rich`

## Project Structure

```text
llm-terminal-test-bundle/
├─ prompts/
│  ├─ smoke.jsonl
│  └─ json_contract.json
├─ src/
│  ├─ cli.py
│  ├─ evaluator.py
│  ├─ llm_client.py
│  ├─ logger.py
│  └─ utils.py
├─ logs/
├─ .env.example
├─ requirements.txt
├─ README.md
└─ run.sh
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in your API key in `.env`.

## Interactive Mode

```bash
python src/cli.py --mode interactive --system "You are a precise assistant. Answer clearly and briefly."
```

## File Test Mode

```bash
python src/cli.py --mode file --file prompts/smoke.jsonl --system "Answer factually and concisely."
```

## Strict CI Mode

This exits with code `1` when at least one test fails.

```bash
python src/cli.py --mode file --file prompts/smoke.jsonl --strict
```

## Test Case Format

Each line in a `.jsonl` file is one test object.

### Example

```json
{"name":"basic-summary","input":"Summarize this in one sentence: Bitcoin is volatile.","must_include":["volatile"],"must_not_include":["guaranteed"],"max_chars":300}
{"name":"json-output","input":"Return a JSON object with keys title and score.","expect_json":true,"required_keys":["title","score"],"json_schema_path":"prompts/json_contract.json"}
```

## Supported Assertions

- `must_include`: list of required phrases
- `must_not_include`: list of forbidden phrases
- `max_chars`: maximum response length
- `expect_json`: require valid JSON output
- `required_keys`: required top-level JSON keys
- `json_schema_path`: validate JSON against schema file
- `contains_any`: response must contain at least one of these values
- `regex_must_match`: list of regex patterns that must match
- `regex_must_not_match`: list of regex patterns that must not match

## Run Logs

Each batch run can write structured logs to `logs/`.

Example:

```bash
python src/cli.py --mode file --file prompts/smoke.jsonl --log-file logs/run.ndjson
```

## Shell Runner

A convenience shell script is included:

```bash
chmod +x run.sh
./run.sh
```

## Notes

- Token usage depends on API response availability.
- JSON Schema validation is only applied if `expect_json` succeeds.
- This bundle is optimized for terminal validation, smoke tests, prompt regression checks, and lightweight CI.
