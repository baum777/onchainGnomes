"""Windows-focused tests for bridge binary resolution.

Tests:
- .cmd binary detection
- pnpm exec tsx resolution
- fallback to direct tsx
- correct cwd selection
- detailed error when nothing found
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Import after conftest adds src to path
from cli import (
    PROJECT_ROOT,
    _format_binary_resolution_error,
    _resolve_bridge_command,
)


def _make_which(pnpm=None, pnpm_cmd=None, tsx=None, tsx_cmd=None):
    """Return a side_effect for mock which that returns paths based on name."""

    def which(name: str):
        if name == "pnpm":
            return pnpm
        if name == "pnpm.cmd":
            return pnpm_cmd
        if name == "tsx":
            return tsx
        if name == "tsx.cmd":
            return tsx_cmd
        return None

    return which


@pytest.mark.parametrize(
    "pnpm_cmd_path,tsx_cmd_path",
    [
        ("C:\\Users\\dev\\AppData\\Local\\pnpm\\pnpm.cmd", "C:\\Users\\dev\\AppData\\Local\\npm\\tsx.cmd"),
        ("D:\\tools\\pnpm.cmd", "D:\\tools\\tsx.cmd"),
    ],
)
def test_cmd_binary_detection_windows(pnpm_cmd_path: str, tsx_cmd_path: str) -> None:
    """On Windows, .cmd executables are accepted as valid when bare names are not found."""
    with patch("cli.shutil.which", side_effect=_make_which(pnpm_cmd=pnpm_cmd_path, tsx_cmd=tsx_cmd_path)):
        cmd, debug_info = _resolve_bridge_command("hello", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == pnpm_cmd_path
    assert cmd[1] == "exec"
    assert cmd[2] == "tsx"
    assert "scripts/cliPromptBridge.ts" in cmd
    assert debug_info["pnpm.cmd"] == pnpm_cmd_path
    assert debug_info["tsx.cmd"] == tsx_cmd_path


def test_pnpm_exec_tsx_resolution() -> None:
    """When pnpm is found, prefer [pnpm, exec, tsx, ...]."""
    pnpm_path = "/usr/local/bin/pnpm" if sys.platform != "win32" else "C:\\pnpm\\pnpm.exe"
    with patch("cli.shutil.which", side_effect=_make_which(pnpm=pnpm_path, tsx="/usr/bin/tsx")):
        cmd, debug_info = _resolve_bridge_command("test input", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == pnpm_path
    assert cmd[1] == "exec"
    assert cmd[2] == "tsx"
    assert "scripts/cliPromptBridge.ts" in cmd
    assert "test input" in cmd
    assert debug_info["attempted_command"] == cmd


def test_fallback_to_direct_tsx() -> None:
    """When pnpm is not found but tsx is, use [tsx, ...] directly."""
    tsx_path = "/usr/local/bin/tsx" if sys.platform != "win32" else "C:\\npm\\tsx.cmd"
    with patch("cli.shutil.which", side_effect=_make_which(tsx=tsx_path)):
        cmd, debug_info = _resolve_bridge_command("fallback", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == tsx_path
    assert "exec" not in cmd[:3]
    assert "scripts/cliPromptBridge.ts" in cmd
    assert "fallback" in cmd


def test_fallback_to_tsx_cmd_when_only_tsx_cmd_available() -> None:
    """When only tsx.cmd is found (no pnpm), use [tsx.cmd, ...]."""
    tsx_cmd_path = "C:\\Users\\dev\\AppData\\npm\\tsx.cmd"
    with patch("cli.shutil.which", side_effect=_make_which(tsx_cmd=tsx_cmd_path)):
        cmd, debug_info = _resolve_bridge_command("tsx-only", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == tsx_cmd_path
    assert "scripts/cliPromptBridge.ts" in cmd


def test_correct_cwd_selection() -> None:
    """cwd in debug_info must be the main TypeScript repo root, not llm-terminal-test-bundle."""
    with patch("cli.shutil.which", side_effect=_make_which(pnpm="/bin/pnpm")):
        _, debug_info = _resolve_bridge_command("x", debug_bridge=False)
    cwd = debug_info["cwd"]
    resolved_root = debug_info["resolved_repo_root"]
    # PROJECT_ROOT = parent.parent.parent of cli.py = xAi_Bot-App
    # Should NOT end with llm-terminal-test-bundle (that would be wrong)
    assert "llm-terminal-test-bundle" not in Path(cwd).name
    assert cwd == resolved_root
    assert cwd == str(PROJECT_ROOT)


def test_detailed_error_when_nothing_found() -> None:
    """When no binary is found, return detailed error with which results."""
    with patch("cli.shutil.which", side_effect=_make_which()):
        cmd, debug_info = _resolve_bridge_command("fail", debug_bridge=False)
    assert cmd is None
    err = _format_binary_resolution_error(debug_info)
    assert "bridge_error: binary resolution failed" in err
    assert "cwd=" in err
    assert "pnpm=" in err
    assert "pnpm.cmd=" in err
    assert "tsx=" in err
    assert "tsx.cmd=" in err
    assert "attempted_command=" in err
    assert "None" in err


def test_resolution_order_pnpm_before_pnpm_cmd() -> None:
    """Bare pnpm is preferred over pnpm.cmd."""
    pnpm_path = "C:\\pnpm\\pnpm.exe"
    pnpm_cmd_path = "C:\\pnpm\\pnpm.cmd"
    with patch(
        "cli.shutil.which",
        side_effect=_make_which(pnpm=pnpm_path, pnpm_cmd=pnpm_cmd_path, tsx="C:\\tsx.exe"),
    ):
        cmd, _ = _resolve_bridge_command("x", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == pnpm_path


def test_resolution_order_pnpm_cmd_before_tsx() -> None:
    """pnpm.cmd is preferred over direct tsx."""
    pnpm_cmd_path = "C:\\pnpm.cmd"
    tsx_path = "C:\\tsx.exe"
    with patch(
        "cli.shutil.which",
        side_effect=_make_which(pnpm_cmd=pnpm_cmd_path, tsx=tsx_path),
    ):
        cmd, _ = _resolve_bridge_command("x", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == pnpm_cmd_path
    assert cmd[1] == "exec"
    assert cmd[2] == "tsx"


def test_resolution_order_tsx_before_tsx_cmd() -> None:
    """Bare tsx is preferred over tsx.cmd when no pnpm available."""
    tsx_path = "C:\\tsx.exe"
    tsx_cmd_path = "C:\\tsx.cmd"
    with patch(
        "cli.shutil.which",
        side_effect=_make_which(tsx=tsx_path, tsx_cmd=tsx_cmd_path),
    ):
        cmd, _ = _resolve_bridge_command("x", debug_bridge=False)
    assert cmd is not None
    assert cmd[0] == tsx_path
