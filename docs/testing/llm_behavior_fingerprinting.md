# LLM Behavior Fingerprinting

## Concept

LLM Behavior Fingerprinting generates a **reproducible signature** of model behavior based on multiple dimensions. It helps detect behavioral drift between:

- Model version updates
- Prompt changes
- System or environment updates

The fingerprint system captures deterministic signals from model responses and compares them across runs. Each test run produces a fingerprint profile stored as NDJSON. Future runs compare against the baseline profile to flag drift.

### Fingerprint Dimensions

| Dimension | Description |
|-----------|-------------|
| **semantic_signature** | SHA-256 of normalized response text (lowercase, collapsed whitespace) |
| **structure_signature** | SHA-256 of response skeleton (formatting preserved, content replaced with placeholders) |
| **style_signature** | SHA-256 of punctuation pattern + sentence length sequence |
| **length_signature** | Character count, token estimate |
| **reasoning_signature** | Bullet count, JSON keys, table rows, reasoning step markers |
| **safety_signature** | Detected flags: refusal, uncertainty, hedged responses |

### Optional Extensions

- **token_entropy_score**: Unique words / total words (lexical diversity)
- **sentence_length_variance**: Variance of words per sentence
- **markdown_structure_signature**: Sequence of markdown elements (headers, lists, tables)

---

## How to Create a Baseline

1. Run your LLM test suite once with the desired model and prompts.
2. Create the baseline profile:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline \
  --suite tests/prompts/regression_suite.jsonl \
  --model gpt-5
```

This will:

- Execute the test suite via the LLM terminal harness
- Generate a fingerprint for each response
- Save the profile to `tests/fingerprint/baseline_profiles/gpt-5.ndjson`

### Using Pre-Run Results

If you already have NDJSON run results from a prior test execution:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py create-baseline \
  --results logs/regression.ndjson \
  --output tests/fingerprint/baseline_profiles/gpt5.ndjson
```

---

## How to Run Drift Detection

Compare a new run against the baseline:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py compare \
  --suite tests/prompts/regression_suite.jsonl \
  --baseline tests/fingerprint/baseline_profiles/gpt5.ndjson
```

With pre-run results:

```bash
python tools/behavior_fingerprint/fingerprint_cli.py compare \
  --baseline tests/fingerprint/baseline_profiles/gpt5.ndjson \
  --results logs/latest_run.ndjson \
  --output tests/fingerprint/drift_report.ndjson
```

---

## Interpretation of Scores

### Similarity Scores (0.0–1.0)

- **semantic_similarity**: Higher = more similar content. Threshold default: 0.80
- **structure_similarity**: Higher = same formatting (bullets, tables, JSON). Threshold default: 0.85
- **style_similarity**: Higher = similar sentence patterns and reasoning style. Threshold default: 0.75

### Length Delta (0.0–1.0)

- Relative length difference. 0 = identical length; 1 = one response is twice as long.
- Drift when **length_delta > 0.35**

### Severity Levels

| Severity | Meaning |
|----------|---------|
| **Low** | Single dimension drifted (e.g., length only) |
| **Medium** | Two dimensions drifted |
| **High** | Three+ dimensions or semantic + structure combined |

### Example Report

```
Model Drift Report
========================================
Tests analyzed: 70
Stable: 63
Minor Drift: 5
Major Drift: 2

Drift Types:
  semantic: 4
  structure: 2
  style: 1
```

---

## Thresholds (Configurable)

Default thresholds in `drift_detector.py`:

| Metric | Threshold | Triggers Drift When |
|--------|------------|---------------------|
| semantic_similarity | 0.80 | Score < 0.80 |
| structure_similarity | 0.85 | Score < 0.85 |
| style_similarity | 0.75 | Score < 0.75 |
| length_delta | 0.35 | Delta > 0.35 |

---

## Integration with Existing Harness

The fingerprint CLI reuses the LLM terminal test harness (`llm-terminal-test-bundle`). It:

1. Runs `python src/cli.py --mode file --file <suite> --log-file <temp>`
2. Reads the NDJSON log (test_name, response, model, etc.)
3. Generates fingerprints from each response
4. Compares against baseline or saves as baseline

No changes to the existing evaluator logic are required. The fingerprint system extends the workflow by adding a post-processing layer.

---

## File Layout

```
tools/behavior_fingerprint/
  fingerprint_engine.py   # Fingerprint generation
  similarity_engine.py    # Fingerprint comparison
  drift_detector.py       # Threshold-based drift detection
  fingerprint_cli.py      # CLI: create-baseline, compare

tests/fingerprint/
  baseline_profiles/      # Stored baseline NDJSON files
  current_profiles/       # Optional: store current runs

docs/
  llm_behavior_fingerprinting.md  # This document
```
