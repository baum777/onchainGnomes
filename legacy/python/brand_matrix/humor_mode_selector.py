"""
GORKY Humor Mode Selector

Deterministic selection of humor mode based on energy, aggression flag, and context.
Used by prompt composer and brand matrix classifier.
"""

from typing import Optional, Dict, Any

# All supported modes
MODES = ("authority", "scientist", "therapist", "reality", "goblin", "rhyme_override")


class HumorModeSelector:
    """
    Selects humor mode for GORKY persona.

    Deterministic: same inputs always produce same output.
    """

    @staticmethod
    def select_mode(
        energy: int = 3,
        aggression_flag: bool = False,
        flavor: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Select humor mode based on inputs.

        Args:
            energy: 1-5 energy level
            aggression_flag: True if user input is aggressive (triggers rhyme override)
            flavor: Optional flavor string (chaos, zen, glitch, ether, neon, vapor)
            context: Optional additional context

        Returns:
            One of: authority, scientist, therapist, reality, goblin, rhyme_override
        """
        # Aggression always wins
        if aggression_flag:
            return "rhyme_override"

        # Clamp energy
        energy = max(1, min(5, energy))

        # Energy-based selection (deterministic)
        if energy >= 5:
            return "goblin"
        if energy <= 2:
            return "therapist"
        if energy == 3:
            return "authority"
        if energy == 4:
            # flavor can nudge: zen -> therapist, chaos -> scientist
            if flavor == "zen":
                return "therapist"
            if flavor in ("chaos", "neon"):
                return "scientist"
            return "scientist"  # default for energy 4

        return "authority"  # fallback

    @classmethod
    def get_mode_for_remix(cls, energy: int, flavor: str = "chaos") -> str:
        """Convenience for remix command."""
        return cls.select_mode(energy=energy, aggression_flag=False, flavor=flavor)

    @classmethod
    def get_mode_for_mention(cls, energy: int, aggression_flag: bool, flavor: str = "chaos") -> str:
        """Convenience for mention workflow."""
        return cls.select_mode(
            energy=energy, aggression_flag=aggression_flag, flavor=flavor
        )
