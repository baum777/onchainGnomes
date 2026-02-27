"""Tests for PromptLoader."""

import pytest
from pathlib import Path

from src.agents.prompt_loader import PromptLoader, Prompt


def test_load_base_prompt():
    """Test loading base system prompt."""
    loader = PromptLoader(Path("prompts"))
    content = loader.get("base", category="system", variables={"context": "test", "message": "hi"})
    assert "GrokBot" in content
    assert "test" in content
    assert "hi" in content


def test_load_mentions_prompt():
    """Test loading mentions prompt."""
    loader = PromptLoader(Path("prompts"))
    content = loader.get("mentions", category="system", variables={"context": "", "message": "hello"})
    assert "GrokBot" in content
    assert "mention" in content.lower()
