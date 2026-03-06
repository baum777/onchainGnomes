from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from statistics import mean
from typing import Any

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from evaluator import evaluate_response
from llm_client import ask_llm_canonical
from logger import write_ndjson

console = Console()

# Project root (xAi_Bot-App) for running the TypeScript prompt bridge
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def run_canonical_prompt_bridge(user_input: str) -> dict[str, Any]:
    """Run the TypeScript CLI prompt bridge to get canonical prompt layers."""
    cmd = ["pnpm", "exec", "tsx", "scripts/cliPromptBridge.ts", user_input]
    try:
        result = subprocess.run(
            cmd,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return {"skip": True, "reason": "bridge_error"}
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        return {"skip": True, "reason": "bridge_error"}


def run_interactive(
    system_prompt: str | None,
    debug_prompt: bool,
) -> None:
    console.print("[bold cyan]Interactive LLM Test Mode (Canonical Pipeline)[/bold cyan]")
    console.print("Type [bold]exit[/bold] or [bold]quit[/bold] to stop.\n")

    while True:
        user_input = input("Prompt > ").strip()
        if user_input.lower() in {"exit", "quit"}:
            break
        if not user_input:
            continue

        prompt_data = run_canonical_prompt_bridge(user_input)

        if prompt_data.get("skip"):
            console.print(
                f"[yellow]Skipped:[/yellow] {prompt_data.get('reason', 'unknown')} "
                "(pipeline would not reply)"
            )
            console.print()
            continue

        if debug_prompt:
            console.print("\n[bold]SYSTEM PROMPT[/bold]")
            console.print(Panel(prompt_data.get("system", ""), expand=True))
            console.print("\n[bold]DEVELOPER PROMPT[/bold]")
            console.print(Panel(prompt_data.get("developer", ""), expand=True))
            console.print("\n[bold]USER PROMPT[/bold]")
            console.print(Panel(prompt_data.get("user", ""), expand=True))
            console.print()

        result = ask_llm_canonical(
            system=prompt_data["system"],
            developer=prompt_data["developer"],
            user=prompt_data["user"],
        )
        title = f"LLM Response · {result.raw_model or 'unknown-model'} · {result.latency_ms} ms"
        console.print(Panel(result.text or "<empty response>", title=title, expand=True))
        if result.usage:
            console.print(f"[dim]Usage:[/dim] {result.usage}")
        console.print()


def run_file_tests(
    path: str,
    system_prompt: str | None,
    strict: bool,
    log_file: str | None,
    debug_prompt: bool,
) -> int:
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

            prompt_data = run_canonical_prompt_bridge(prompt)
            if prompt_data.get("skip"):
                console.print(
                    f"[yellow]SKIP[/yellow] {name} — pipeline would skip: "
                    f"{prompt_data.get('reason', 'unknown')}"
                )
                if log_file:
                    write_ndjson(
                        log_file,
                        {
                            "test_name": name,
                            "input": prompt,
                            "passed": False,
                            "errors": [f"Pipeline skip: {prompt_data.get('reason')}"],
                            "response": None,
                            "latency_ms": 0,
                            "usage": None,
                            "model": None,
                        },
                    )
                if strict:
                    passed = passed  # don't count as passed
                continue

            if debug_prompt:
                console.print(f"\n[bold]{name}[/bold]")
                console.print("[dim]SYSTEM[/dim]", prompt_data.get("system", "")[:200] + "...")
                console.print()

            llm_result = ask_llm_canonical(
                system=prompt_data["system"],
                developer=prompt_data["developer"],
                user=prompt_data["user"],
            )
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
    parser = argparse.ArgumentParser(description="Terminal LLM response tester (canonical pipeline)")
    parser.add_argument("--mode", choices=["interactive", "file"], default="interactive")
    parser.add_argument("--file", help="Path to JSONL test file")
    parser.add_argument("--system", help="Legacy: ignored when using canonical pipeline", default=None)
    parser.add_argument("--strict", action="store_true", help="Return exit code 1 on any failed test")
    parser.add_argument("--log-file", help="Optional NDJSON log file path", default=None)
    parser.add_argument(
        "--debug-prompt",
        action="store_true",
        help="Print generated SYSTEM/DEVELOPER/USER prompt layers before LLM call",
    )
    return parser


def main() -> None:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args()

    if args.mode == "interactive":
        run_interactive(system_prompt=args.system, debug_prompt=args.debug_prompt)
        raise SystemExit(0)

    if args.mode == "file":
        if not args.file:
            raise SystemExit("--file is required in file mode")
        exit_code = run_file_tests(
            args.file, args.system, args.strict, args.log_file, args.debug_prompt
        )
        raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
