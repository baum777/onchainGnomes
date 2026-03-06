from __future__ import annotations

import argparse
import json
from statistics import mean
from typing import Any

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from evaluator import evaluate_response
from llm_client import ask_llm
from logger import write_ndjson

console = Console()


def run_interactive(system_prompt: str | None) -> None:
    console.print("[bold cyan]Interactive LLM Test Mode[/bold cyan]")
    console.print("Type [bold]exit[/bold] or [bold]quit[/bold] to stop.\n")

    while True:
        user_input = input("Prompt > ").strip()
        if user_input.lower() in {"exit", "quit"}:
            break
        if not user_input:
            continue

        result = ask_llm(user_input, system_prompt=system_prompt)
        title = f"LLM Response · {result.raw_model or 'unknown-model'} · {result.latency_ms} ms"
        console.print(Panel(result.text or "<empty response>", title=title, expand=True))
        if result.usage:
            console.print(f"[dim]Usage:[/dim] {result.usage}")
        console.print()


def run_file_tests(path: str, system_prompt: str | None, strict: bool, log_file: str | None) -> int:
    total = 0
    passed = 0
    latencies: list[int] = []

    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            total += 1
            testcase: dict[str, Any] = json.loads(line)
            name = testcase.get("name", f"test-{total}")
            prompt = testcase["input"]

            llm_result = ask_llm(prompt, system_prompt=system_prompt)
            latencies.append(llm_result.latency_ms)
            result = evaluate_response(testcase, llm_result.text)

            if result["passed"]:
                passed += 1
                console.print(f"[green]PASS[/green] {name} [dim]({llm_result.latency_ms} ms)[/dim]")
            else:
                console.print(f"[red]FAIL[/red] {name} [dim]({llm_result.latency_ms} ms)[/dim]")
                for err in result["errors"]:
                    console.print(f"  - {err}")
                console.print(Panel(result["response"] or "<empty response>", title=f"Response · {name}", expand=True))

            if log_file:
                write_ndjson(
                    log_file,
                    {
                        "test_name": name,
                        "input": prompt,
                        "system_prompt": system_prompt,
                        "passed": result["passed"],
                        "errors": result["errors"],
                        "response": result["response"],
                        "latency_ms": llm_result.latency_ms,
                        "usage": llm_result.usage,
                        "model": llm_result.raw_model,
                    },
                )

    summary = Table(title="Run Summary")
    summary.add_column("Metric")
    summary.add_column("Value")
    summary.add_row("Passed", f"{passed}/{total}")
    summary.add_row("Failed", str(total - passed))
    summary.add_row("Avg latency", f"{int(mean(latencies)) if latencies else 0} ms")
    summary.add_row("Strict mode", str(strict))
    console.print()
    console.print(summary)

    if strict and passed != total:
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Terminal LLM response tester")
    parser.add_argument("--mode", choices=["interactive", "file"], default="interactive")
    parser.add_argument("--file", help="Path to JSONL test file")
    parser.add_argument("--system", help="Optional system prompt", default=None)
    parser.add_argument("--strict", action="store_true", help="Return exit code 1 on any failed test")
    parser.add_argument("--log-file", help="Optional NDJSON log file path", default=None)
    return parser


def main() -> None:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args()

    if args.mode == "interactive":
        run_interactive(args.system)
        raise SystemExit(0)

    if args.mode == "file":
        if not args.file:
            raise SystemExit("--file is required in file mode")
        exit_code = run_file_tests(args.file, args.system, args.strict, args.log_file)
        raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
