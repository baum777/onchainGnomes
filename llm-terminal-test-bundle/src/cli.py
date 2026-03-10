from __future__ import annotations

import argparse
import json
import os
import shutil
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
from logger import write_ndjson
from llm_client import ask_llm

console = Console()

# Project root (xAi_Bot-App) for running the TypeScript prompt bridge
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_system_prompt(args: argparse.Namespace) -> str | None:
    path_or_content = args.system_file or args.system
    if not path_or_content:
        return None
    
    # Check if it's a file path
    if os.path.isfile(path_or_content):
        with open(path_or_content, "r", encoding="utf-8") as f:
            return f.read().strip()
    return path_or_content


def _resolve_bridge_command(
    user_input: str,
    *,
    debug_prompt: bool = False,
    debug_bridge: bool = False,
    debug_decision: bool = False,
) -> tuple[list[str] | None, dict[str, Any]]:
    """Resolve pnpm/tsx binary for the bridge. Prefers pnpm exec tsx, falls back to direct tsx.
    On Windows, accepts .cmd executables. Returns (cmd, debug_info)."""
    which_pnpm = shutil.which("pnpm")
    which_pnpm_cmd = shutil.which("pnpm.cmd")
    which_tsx = shutil.which("tsx")
    which_tsx_cmd = shutil.which("tsx.cmd")

    debug_info: dict[str, Any] = {
        "resolved_repo_root": str(PROJECT_ROOT),
        "cwd": str(PROJECT_ROOT),
        "pnpm": which_pnpm,
        "pnpm.cmd": which_pnpm_cmd,
        "tsx": which_tsx,
        "tsx.cmd": which_tsx_cmd,
    }

    base_args = ["scripts/cliPromptBridge.ts"]
    if debug_prompt:
        base_args.append("--debug-prompt")
    if debug_bridge:
        base_args.append("--debug-bridge")
    if debug_decision:
        base_args.append("--debug-decision")
    base_args.append(user_input)

    # Resolution order: pnpm exec tsx, pnpm.cmd exec tsx, tsx, tsx.cmd
    if which_pnpm:
        cmd = [which_pnpm, "exec", "tsx"] + base_args
        debug_info["attempted_command"] = cmd
        return (cmd, debug_info)
    if which_pnpm_cmd:
        cmd = [which_pnpm_cmd, "exec", "tsx"] + base_args
        debug_info["attempted_command"] = cmd
        return (cmd, debug_info)
    if which_tsx:
        cmd = [which_tsx] + base_args
        debug_info["attempted_command"] = cmd
        return (cmd, debug_info)
    if which_tsx_cmd:
        cmd = [which_tsx_cmd] + base_args
        debug_info["attempted_command"] = cmd
        return (cmd, debug_info)

    debug_info["attempted_command"] = None
    return (None, debug_info)


def _format_binary_resolution_error(debug_info: dict[str, Any]) -> str:
    """Format a detailed error message when binary resolution fails."""
    lines = [
        "bridge_error: binary resolution failed",
        f"cwd={debug_info.get('cwd', '?')}",
        f"pnpm={debug_info.get('pnpm') or 'None'}",
        f"pnpm.cmd={debug_info.get('pnpm.cmd') or 'None'}",
        f"tsx={debug_info.get('tsx') or 'None'}",
        f"tsx.cmd={debug_info.get('tsx.cmd') or 'None'}",
        f"attempted_command={debug_info.get('attempted_command')}",
    ]
    return "\n".join(lines)


def run_canonical_prompt_bridge(
    user_input: str,
    *,
    debug_prompt: bool = False,
    debug_bridge: bool = False,
    debug_decision: bool = False,
) -> dict[str, Any]:
    """Run the TypeScript CLI prompt bridge (full canonical pipeline)."""
    cmd, debug_info = _resolve_bridge_command(
        user_input,
        debug_prompt=debug_prompt,
        debug_bridge=debug_bridge,
        debug_decision=debug_decision,
    )

    if cmd is None:
        return {
            "skip": True,
            "reason": "bridge_error",
            "bridge_error_detail": _format_binary_resolution_error(debug_info),
        }

    if debug_bridge:
        console.print("[dim]Bridge debug:[/dim]")
        for k, v in debug_info.items():
            console.print(f"  [dim]{k}=[/dim] {v}")
        console.print()

    try:
        result = subprocess.run(
            cmd,
            cwd=PROJECT_ROOT,
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=90,
        )
        if result.returncode != 0:
            return {"skip": True, "reason": "bridge_error", "bridge_error_detail": result.stderr or "subprocess failed"}
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        return {"skip": True, "reason": "bridge_error", "bridge_error_detail": "timeout (90s)"}
    except json.JSONDecodeError as e:
        return {"skip": True, "reason": "bridge_error", "bridge_error_detail": f"invalid JSON: {e}"}
    except FileNotFoundError:
        return {
            "skip": True,
            "reason": "bridge_error",
            "bridge_error_detail": _format_binary_resolution_error(debug_info),
        }


def run_interactive(
    system_prompt: str | None,
    debug_prompt: bool,
    debug_bridge: bool,
    debug_decision: bool,
) -> None:
    console.print("[bold cyan]Interactive LLM Test Mode (Canonical Pipeline)[/bold cyan]")
    console.print("Type [bold]exit[/bold] or [bold]quit[/bold] to stop.\n")

    while True:
        user_input = input("Prompt > ").strip()
        if user_input.lower() in {"exit", "quit"}:
            break
        if not user_input:
            continue

        # Resolve bridge command
        cmd, debug_info = _resolve_bridge_command(
            user_input,
            debug_prompt=debug_prompt,
            debug_bridge=debug_bridge,
            debug_decision=debug_decision,
        )

        if cmd:
            try:
                result = subprocess.run(
                    cmd,
                    cwd=PROJECT_ROOT,
                    env=os.environ.copy(),
                    capture_output=True,
                    text=True,
                    timeout=90,
                )
                if result.returncode != 0:
                    prompt_data = {"skip": True, "reason": "bridge_error", "bridge_error_detail": result.stderr or "subprocess failed"}
                else:
                    # Extract only last JSON line to ignore debug/console output
                    stdout_lines = result.stdout.strip().split("\n")
                    last_line = stdout_lines[-1] if stdout_lines else ""
                    prompt_data = json.loads(last_line)
            except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError, IndexError) as e:
                prompt_data = {"skip": True, "reason": "bridge_error", "bridge_error_detail": str(e)}
        else:
            prompt_data = {"skip": True, "reason": "bridge_error", "bridge_error_detail": "Binary resolution failed"}

        if prompt_data.get("skip"):
            reason = prompt_data.get("reason", "unknown")
            detail = prompt_data.get("bridge_error_detail")
            msg = f"[yellow]Skipped:[/yellow] {reason} (pipeline would not reply)"
            if detail:
                msg += f"\n[dim]bridge_error: {detail}[/dim]"
            console.print(msg)
            debug = prompt_data.get("debug", {})
            if debug:
                console.print(Panel(str(debug), title="[dim]Debug[/dim]", expand=False))
            console.print()
            continue

        if debug_prompt and prompt_data.get("debug"):
            console.print("\n[bold]DEBUG[/bold]")
            console.print(Panel(str(prompt_data["debug"]), expand=False))
            console.print()

        reply_text = prompt_data.get("reply_text", "")
        mode = prompt_data.get("mode", "unknown")
        title = f"Pipeline Response · mode={mode}"
        console.print(Panel(reply_text or "<empty response>", title=title, expand=True))
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

            # Resolve bridge command
            cmd, debug_info = _resolve_bridge_command(
                prompt,
                debug_prompt=debug_prompt,
                debug_bridge=False,
                debug_decision=False,
            )

            if cmd:
                try:
                    result = subprocess.run(
                        cmd,
                        cwd=PROJECT_ROOT,
                        env=os.environ.copy(),
                        capture_output=True,
                        text=False, # Get raw bytes to handle encoding
                        timeout=90,
                    )
                    if result.returncode != 0:
                        prompt_data = {"skip": True, "reason": "bridge_error", "bridge_error_detail": result.stderr.decode("utf-8", errors="replace") or "subprocess failed"}
                    else:
                        # Decode with utf-8 and extract only last JSON line
                        stdout_str = result.stdout.decode("utf-8", errors="replace")
                        stdout_lines = stdout_str.strip().split("\n")
                        last_line = stdout_lines[-1] if stdout_lines else ""
                        prompt_data = json.loads(last_line)
                except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError, IndexError) as e:
                    prompt_data = {"skip": True, "reason": "bridge_error", "bridge_error_detail": str(e)}
            else:
                prompt_data = {"skip": True, "reason": "bridge_error", "bridge_error_detail": "Binary resolution failed"}
            if prompt_data.get("skip"):
                reason = prompt_data.get("reason", "unknown")
                detail = prompt_data.get("bridge_error_detail")
                console.print(
                    f"[yellow]SKIP[/yellow] {name} — pipeline would skip: {reason}"
                    + (f" — {detail}" if detail else "")
                )
                if log_file:
                    write_ndjson(
                        log_file,
                        {
                            "test_name": name,
                            "input": prompt,
                            "passed": False,
                            "errors": [f"Pipeline skip: {reason}"],
                            "response": None,
                            "latency_ms": prompt_data.get("latency_ms", 0),
                            "usage": None,
                            "model": None,
                        },
                    )
                if strict:
                    passed = passed  # don't count as passed
                continue

            if debug_prompt and prompt_data.get("debug"):
                console.print(f"\n[bold]{name}[/bold]")
                console.print(Panel(str(prompt_data["debug"]), title="[dim]Debug[/dim]", expand=False))
                console.print()

            reply_text = prompt_data.get("reply_text", "")
            latency_ms = prompt_data.get("latency_ms", 0)
            latencies.append(latency_ms)
            result = evaluate_response(testcase, reply_text)

            if result["passed"]:
                passed += 1
                console.print(f"[green]PASS[/green] {name} [dim]({latency_ms} ms)[/dim]")
            else:
                console.print(f"[red]FAIL[/red] {name} [dim]({latency_ms} ms)[/dim]")
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
                        "latency_ms": latency_ms,
                        "usage": None,
                        "model": None,
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
    parser.add_argument("--system", help="System prompt string or path to file", default=None)
    parser.add_argument("--system-file", help="Alias for --system", default=None)
    parser.add_argument("--strict", action="store_true", help="Return exit code 1 on any failed test")
    parser.add_argument("--log-file", help="Optional NDJSON log file path", default=None)
    parser.add_argument(
        "--debug-prompt",
        action="store_true",
        help="Print prompt hash and debug info when pipeline replies",
    )
    parser.add_argument(
        "--debug-bridge",
        action="store_true",
        help="Print simulated mention payload and bridge debug info",
    )
    parser.add_argument(
        "--debug-decision",
        action="store_true",
        help="Print classifier result, mode, thesis, and skip reason details",
    )
    return parser


def main() -> None:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args()

    # Load system prompt (from file or string)
    system_prompt = _load_system_prompt(args)

    if args.mode == "interactive":
        run_interactive(
            system_prompt=system_prompt,
            debug_prompt=args.debug_prompt,
            debug_bridge=args.debug_bridge,
            debug_decision=args.debug_decision,
        )
        raise SystemExit(0)

    if args.mode == "file":
        if not args.file:
            raise SystemExit("--file is required in file mode")
        exit_code = run_file_tests(
            args.file, system_prompt, args.strict, args.log_file, args.debug_prompt
        )
        raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
