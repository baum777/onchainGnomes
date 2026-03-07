"""Pytest configuration for llm-terminal-test-bundle tests."""
import sys
from pathlib import Path

# Add src to path so we can import cli, evaluator, etc.
src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))
