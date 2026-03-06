"""
LLM Behavior Fingerprinting CLI.

create-baseline: Run test suite and create fingerprint baseline.
compare: Run test suite and compare against baseline.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

# Allow running as script or module
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from tools.behavior_fingerprint.fingerprint_engine import Fingerprint, generate_fingerprint
from tools.behavior_fingerprint.drift_detector import detect_drift


def _default_harness_dir() -> Path:
    """Default path to LLM terminal test harness."""
    return _PROJECT_ROOT / "llm-terminal-test-bundle" / "llm-terminal-test-bundle"


def _run_test_suite(
    suite_path: str | Path,
    harness_dir: Path,
    log_path: str | Path,
    system_prompt: str | None = None,
) -> int:
    """Run the test suite via harness; write NDJSON to log_path. Returns exit code."""
    cli_path = harness_dir / "src" / "cli.py"
    if not cli_path.exists():
        print(f"Error: Harness CLI not found at {cli_path}", file=sys.stderr)
        return 2

    cmd = [
        sys.executable,
        str(cli_path),
        "--mode", "file",
        "--file", str(suite_path),
        "--log-file", str(log_path),
    ]
    if system_prompt:
        cmd.extend(["--system", system_prompt])

    env = os.environ.copy()
    env["PYTHONPATH"] = str(harness_dir) + os.pathsep + env.get("PYTHONPATH", "")

    result = subprocess.run(
        cmd,
        cwd=str(harness_dir),
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    return result.returncode


def _load_ndjson(path: str | Path) -> list[dict]:
    """Load NDJSON file."""
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def _fingerprints_from_run_results(records: list[dict]) -> list[Fingerprint]:
    """Build fingerprints from NDJSON run results."""
    fingerprints = []
    for r in records:
        test_name = r.get("test_name", "unknown")
        response = r.get("response") or ""
        model = r.get("model") or "unknown"
        timestamp = r.get("timestamp", "")
        fp = generate_fingerprint(test_name=test_name, model=model, response=response, timestamp=timestamp)
        fingerprints.append(fp)
    return fingerprints


def _load_baseline(path: str | Path) -> dict[str, Fingerprint]:
    """Load baseline fingerprints from NDJSON; key by test_name."""
    records = _load_ndjson(path)
    result = {}
    for r in records:
        fp = Fingerprint(
            test_name=r["test_name"],
            model=r.get("model", ""),
            timestamp=r.get("timestamp", ""),
            semantic_hash=r.get("semantic_hash", ""),
            structure_hash=r.get("structure_hash", ""),
            style_hash=r.get("style_hash", ""),
            char_length=r.get("char_length", 0),
            token_estimate=r.get("token_estimate", 0),
            bullet_count=r.get("bullet_count", 0),
            json_keys=r.get("json_keys", []),
            table_rows=r.get("table_rows", 0),
            safety_flags=r.get("safety_flags", []),
            reasoning_steps=r.get("reasoning_steps", 0),
            token_entropy_score=r.get("token_entropy_score"),
            sentence_length_variance=r.get("sentence_length_variance"),
            markdown_structure_signature=r.get("markdown_structure_signature"),
        )
        result[fp.test_name] = fp
    return result


def _save_fingerprints(fingerprints: list[Fingerprint], path: str | Path) -> None:
    """Save fingerprints as NDJSON."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for fp in fingerprints:
            f.write(json.dumps(fp.to_dict(), ensure_ascii=False) + "\n")


def cmd_create_baseline(args: argparse.Namespace) -> int:
    """Create baseline fingerprint profile."""
    if args.results:
        results_path = Path(args.results)
        if not results_path.exists():
            print(f"Error: Results file not found: {args.results}", file=sys.stderr)
            return 1
        records = _load_ndjson(results_path)
    else:
        suite = Path(args.suite)
        if not suite.exists():
            print(f"Error: Suite file not found: {suite}", file=sys.stderr)
            return 1
        harness = Path(args.harness)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ndjson", delete=False) as tf:
            log_path = tf.name
        try:
            ret = _run_test_suite(
                suite_path=suite,
                harness_dir=harness,
                log_path=log_path,
                system_prompt=args.system,
            )
            if ret != 0:
                print("Warning: Test run had failures; fingerprints will be based on actual responses.", file=sys.stderr)
            records = _load_ndjson(log_path)
        finally:
            os.unlink(log_path)

    if not records:
        print("Error: No run results to fingerprint.", file=sys.stderr)
        return 1

    if args.model and args.output == "tests/fingerprint/baseline_profiles/baseline.ndjson":
        model_safe = args.model.replace("/", "-").replace(" ", "_")
        output = Path(f"tests/fingerprint/baseline_profiles/{model_safe}.ndjson")
    else:
        output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    fingerprints = _fingerprints_from_run_results(records)
    _save_fingerprints(fingerprints, output)
    print(f"Baseline created: {output} ({len(fingerprints)} fingerprints)")
    return 0


def cmd_compare(args: argparse.Namespace) -> int:
    """Compare current run to baseline."""
    baseline_path = Path(args.baseline)
    if not baseline_path.exists():
        print(f"Error: Baseline not found: {baseline_path}", file=sys.stderr)
        return 1

    if args.results:
        records = _load_ndjson(args.results)
    else:
        if not args.suite:
            print("Error: --suite required when not using --results.", file=sys.stderr)
            return 1
        suite = Path(args.suite)
        if not suite.exists():
            print(f"Error: Suite file not found: {suite}", file=sys.stderr)
            return 1
        harness = Path(args.harness)
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ndjson", delete=False) as tf:
            log_path = tf.name
        try:
            ret = _run_test_suite(
                suite_path=suite,
                harness_dir=harness,
                log_path=log_path,
                system_prompt=args.system,
            )
            if ret != 0:
                print("Warning: Test run had failures.", file=sys.stderr)
            records = _load_ndjson(log_path)
        finally:
            os.unlink(log_path)

    if not records:
        print("Error: No run results.", file=sys.stderr)
        return 1

    baseline_map = _load_baseline(baseline_path)
    current_fps = _fingerprints_from_run_results(records)
    current_map = {fp.test_name: fp for fp in current_fps}

    # Match by test_name
    drift_results = []
    stable = 0
    minor_drift = 0
    major_drift = 0
    drift_types: dict[str, int] = defaultdict(int)

    for fp in current_fps:
        base = baseline_map.get(fp.test_name)
        if base is None:
            continue
        result = detect_drift(base, fp)
        drift_results.append(result)
        if not result.drift_detected:
            stable += 1
        elif result.severity == "high":
            major_drift += 1
        else:
            minor_drift += 1
        for dt in result.drift_type:
            drift_types[dt] += 1

    total = len(drift_results)

    # Print report
    print("\nModel Drift Report")
    print("=" * 40)
    print(f"Tests analyzed: {total}")
    print(f"Stable: {stable}")
    print(f"Minor Drift: {minor_drift}")
    print(f"Major Drift: {major_drift}")
    print()
    print("Drift Types:")
    for dt, count in sorted(drift_types.items()):
        print(f"  {dt}: {count}")
    print()

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            for r in drift_results:
                row = {
                    "test_name": r.test_name,
                    "drift_detected": r.drift_detected,
                    "drift_type": r.drift_type,
                    "severity": r.severity,
                }
                if r.scores:
                    row.update(r.scores.to_dict())
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"Drift report written to: {out_path}")

    return 1 if (minor_drift > 0 or major_drift > 0) else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="LLM Behavior Fingerprinting CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    # create-baseline
    p_baseline = sub.add_parser("create-baseline", help="Create fingerprint baseline")
    p_baseline.add_argument("--suite", help="Path to JSONL test suite (required unless --results)")
    p_baseline.add_argument("--output", "-o", default="tests/fingerprint/baseline_profiles/baseline.ndjson", help="Output path")
    p_baseline.add_argument("--harness", default=str(_default_harness_dir()), help="Path to LLM test harness")
    p_baseline.add_argument("--results", help="Use existing NDJSON run results instead of running tests")
    p_baseline.add_argument("--system", help="System prompt for tests")
    p_baseline.add_argument("--model", help="Model name (used in output path, e.g. baseline_profiles/gpt5.ndjson)")
    p_baseline.set_defaults(func=cmd_create_baseline)

    # compare
    p_compare = sub.add_parser("compare", help="Compare current run to baseline")
    p_compare.add_argument("--suite", help="Path to JSONL test suite (required unless --results)")
    p_compare.add_argument("--baseline", "-b", required=True, help="Path to baseline NDJSON")
    p_compare.add_argument("--harness", default=str(_default_harness_dir()), help="Path to LLM test harness")
    p_compare.add_argument("--results", help="Use existing NDJSON run results instead of running tests")
    p_compare.add_argument("--system", help="System prompt for tests")
    p_compare.add_argument("--output", "-o", help="Write drift report to file")
    p_compare.set_defaults(func=cmd_compare)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
