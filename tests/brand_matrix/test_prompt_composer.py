"""Tests for GORKY PromptComposer."""

import pytest
from pathlib import Path

from src.brand_matrix.prompt_composer import GorkyPromptComposer


class TestGorkyPromptComposer:
    """Test suite for GorkyPromptComposer."""

    @pytest.fixture
    def composer(self):
        """Create composer with project prompts dir."""
        return GorkyPromptComposer(prompts_dir=Path("prompts"))

    def test_compose_returns_non_empty_string(self, composer):
        """Compose produces non-empty output."""
        result = composer.compose(
            user_input="test input",
            mode="authority",
        )
        assert isinstance(result, str)
        assert len(result) > 0

    def test_compose_includes_user_input(self, composer):
        """Composed prompt includes user input."""
        user_input = "chart looks dead"
        result = composer.compose(user_input=user_input, mode="authority")
        assert "chart looks dead" in result or user_input in result

    def test_compose_includes_mode_instructions(self, composer):
        """Composed prompt includes mode-specific instructions."""
        result = composer.compose(user_input="test", mode="goblin")
        assert "goblin" in result.lower() or "chaos" in result.lower()

    def test_rhyme_override_mode_instructions(self, composer):
        """Rhyme override mode has de-escalation instructions."""
        result = composer.compose(user_input="test", mode="rhyme_override")
        assert "rhyme" in result.lower() or "aggressive" in result.lower() or "de-escalat" in result.lower()

    def test_no_private_data_leakage(self, composer):
        """Composed output does not contain forbidden tokens."""
        forbidden = ["score", "xp", "threshold", "cooldown", "trace", "risk", "telemetry", "flag"]
        result = composer.compose(user_input="test", mode="authority", user_handle="user123")
        result_lower = result.lower()
        for token in forbidden:
            assert token not in result_lower, f"Forbidden token '{token}' leaked"

    def test_compose_for_mention_convenience(self, composer):
        """compose_for_mention works with aggression flag."""
        result = composer.compose_for_mention(
            user_input="angry text",
            energy=3,
            aggression_flag=True,
            flavor="chaos",
        )
        assert len(result) > 0

    def test_compose_caching(self, composer):
        """Same inputs return cached result."""
        r1 = composer.compose(user_input="cached test", mode="authority")
        r2 = composer.compose(user_input="cached test", mode="authority")
        assert r1 == r2
