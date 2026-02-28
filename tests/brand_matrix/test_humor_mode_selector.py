"""Tests for GORKY HumorModeSelector."""

import pytest
from src.brand_matrix.humor_mode_selector import HumorModeSelector, MODES


class TestHumorModeSelector:
    """Test suite for HumorModeSelector."""

    def test_aggression_triggers_rhyme_override(self):
        """Aggressive input always returns rhyme_override."""
        assert HumorModeSelector.select_mode(energy=3, aggression_flag=True) == "rhyme_override"
        assert HumorModeSelector.select_mode(energy=5, aggression_flag=True) == "rhyme_override"
        assert HumorModeSelector.select_mode(energy=1, aggression_flag=True) == "rhyme_override"

    def test_energy_5_triggers_goblin(self):
        """Energy >= 5 triggers goblin mode."""
        assert HumorModeSelector.select_mode(energy=5, aggression_flag=False) == "goblin"
        assert HumorModeSelector.select_mode(energy=6, aggression_flag=False) == "goblin"

    def test_energy_low_triggers_therapist(self):
        """Energy <= 2 triggers therapist mode."""
        assert HumorModeSelector.select_mode(energy=1, aggression_flag=False) == "therapist"
        assert HumorModeSelector.select_mode(energy=2, aggression_flag=False) == "therapist"

    def test_energy_3_triggers_authority(self):
        """Energy 3 triggers authority mode."""
        assert HumorModeSelector.select_mode(energy=3, aggression_flag=False) == "authority"

    def test_energy_4_triggers_scientist(self):
        """Energy 4 triggers scientist mode by default."""
        assert HumorModeSelector.select_mode(energy=4, aggression_flag=False) == "scientist"

    def test_flavor_zen_nudges_to_therapist(self):
        """Flavor zen at energy 4 returns therapist."""
        assert HumorModeSelector.select_mode(
            energy=4, aggression_flag=False, flavor="zen"
        ) == "therapist"

    def test_flavor_chaos_energy_4_returns_scientist(self):
        """Flavor chaos at energy 4 returns scientist."""
        assert HumorModeSelector.select_mode(
            energy=4, aggression_flag=False, flavor="chaos"
        ) == "scientist"

    def test_deterministic_same_inputs(self):
        """Same inputs produce same output."""
        r1 = HumorModeSelector.select_mode(energy=4, aggression_flag=False, flavor="neon")
        r2 = HumorModeSelector.select_mode(energy=4, aggression_flag=False, flavor="neon")
        assert r1 == r2

    def test_modes_tuple_valid(self):
        """MODES contains valid mode names."""
        assert "rhyme_override" in MODES
        assert "goblin" in MODES
        assert "therapist" in MODES
        assert "authority" in MODES
        assert "scientist" in MODES
        assert "reality" in MODES

    def test_get_mode_for_remix(self):
        """Convenience method for remix."""
        mode = HumorModeSelector.get_mode_for_remix(energy=5, flavor="chaos")
        assert mode == "goblin"

    def test_get_mode_for_mention_with_aggression(self):
        """Mention with aggression returns rhyme_override."""
        mode = HumorModeSelector.get_mode_for_mention(
            energy=3, aggression_flag=True, flavor="chaos"
        )
        assert mode == "rhyme_override"
