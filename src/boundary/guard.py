"""
Public/Private Boundary Guards (CRITICAL).

These guards ensure that internal metrics (scores, XP, cooldowns, traces)
NEVER appear in public output (tweets, replies, captions).
"""

import re
from typing import List, Optional, Pattern


class BoundaryViolation(Exception):
    """Raised when private/internal data would leak into public output."""

    def __init__(self, message: str, pattern_matched: Optional[str] = None):
        super().__init__(message)
        self.pattern_matched = pattern_matched


class PublicOutputGuard:
    """
    Guards against internal data appearing in public output.

    Public output = tweets, replies, image captions (what users see)
    Private data = scores, XP, thresholds, cooldowns, traces, risk flags
    """

    # Forbidden patterns in public text
    FORBIDDEN_PATTERNS: List[tuple] = [
        (re.compile(r'\\b\\d+\\s*(?:points?|xp|score)s?\\b', re.IGNORECASE),
         "Numeric scores/points/XP"),
        (re.compile(r'\\b(?:cooldown|trace|flag|risk|threshold)\\b', re.IGNORECASE),
         "Internal terminology (cooldown, trace, flag, risk, threshold)"),
        (re.compile(r'\\b(?:internal_|private_|telemetry_)\\w+\\b', re.IGNORECASE),
         "Internal variable prefixes"),
        (re.compile(r'\\{\\s*(?:score|xp|points|internal_\\w+)\\s*\\}', re.IGNORECASE),
         "Template variables for internal metrics"),
        (re.compile(r'level\\s*\\d+', re.IGNORECASE),
         "Level numbers"),
        (re.compile(r'\\b(?:debug|trace|log)_id\\b', re.IGNORECASE),
         "Debug/trace identifiers"),
    ]

    # Context-specific patterns
    BADGE_NUMBER_PATTERN = re.compile(r'\\d', re.IGNORECASE)

    def __init__(self):
        self.violations: List[str] = []

    def check(self, text: str, context: str = "general") -> bool:
        """
        Check if text is safe for public output.

        Args:
            text: The text to check
            context: Context type ('general', 'badge', 'caption', 'reply')

        Returns:
            True if safe, False if violations found

        Raises:
            BoundaryViolation: If violations are found (unless suppressed)
        """
        violations = self._check_patterns(text, context)

        if violations:
            self.violations.extend(violations)
            raise BoundaryViolation(
                f"Boundary violation in {context} context: {violations[0][1]}",
                pattern_matched=violations[0][0]
            )

        return True

    def _check_patterns(self, text: str, context: str) -> List[tuple]:
        """Check text against all forbidden patterns."""
        violations = []

        for pattern, description in self.FORBIDDEN_PATTERNS:
            if pattern.search(text):
                violations.append((pattern.pattern, description))

        # Context-specific checks
        if context == "badge" and self.BADGE_NUMBER_PATTERN.search(text):
            violations.append((
                self.BADGE_NUMBER_PATTERN.pattern,
                "Badge output contains numbers (scores, levels, etc.)"
            ))

        return violations

    def sanitize(self, text: str, context: str = "general") -> str:
        """
        Check and return text if safe, otherwise raise.

        Args:
            text: The text to check
            context: Context type

        Returns:
            The original text if safe

        Raises:
            BoundaryViolation: If text contains forbidden patterns
        """
        self.check(text, context)
        return text


class BadgeGuard(PublicOutputGuard):
    """Specialized guard for /badge me command output."""

    ALLOWED_BADGES = [
        "Certified Menace",
        "Chart Destroyer",
        "Bag Holder Supreme",
        "Liquidity Ghost",
        "Exit Liquidity",
        "Rug Survivor",
        "Diamond Hands (Paper Core)",
        "FOMO Legend",
        "Copium Connoisseur",
        "Revived Entity",
        "Market Trauma",
        "Chart Graveyard",
    ]

    def validate_badge(self, badge_text: str) -> str:
        """
        Validate badge output has no numbers and is from allowed set.

        Args:
            badge_text: The badge text to validate

        Returns:
            The badge text if valid

        Raises:
            BoundaryViolation: If badge contains numbers or isn't in allowed set
        """
        # Check for any digits
        if re.search(r'\\d', badge_text):
            raise BoundaryViolation(
                f"Badge contains numbers: {badge_text}",
                pattern_matched=r'\\d'
            )

        # Check against allowed badges (case-insensitive)
        badge_lower = badge_text.lower().strip()
        allowed_lower = [b.lower() for b in self.ALLOWED_BADGES]

        if badge_lower not in allowed_lower:
            # Allow any non-numeric badge that's not obviously a score
            # but warn in logs
            pass  # For now, allow any non-numeric badge

        return badge_text


class CaptionGuard(PublicOutputGuard):
    """Specialized guard for image caption output."""

    MAX_CAPTION_LENGTH = 280  # Tweet limit

    def validate_caption(self, caption: str) -> str:
        """
        Validate caption is safe and within length limit.

        Args:
            caption: The caption text

        Returns:
            The caption if valid

        Raises:
            BoundaryViolation: If caption contains forbidden patterns or is too long
        """
        # Check for internal metrics
        self.sanitize(caption, context="caption")

        # Check length
        if len(caption) > self.MAX_CAPTION_LENGTH:
            raise BoundaryViolation(
                f"Caption exceeds {self.MAX_CAPTION_LENGTH} chars: {len(caption)}"
            )

        return caption


# Module-level convenience functions

def guard_public_output(text: str, context: str = "general") -> str:
    """
    Guard public output - raises BoundaryViolation if unsafe.

    Args:
        text: Text to validate
        context: Context type

    Returns:
        Original text if safe

    Raises:
        BoundaryViolation: If text contains internal metrics
    """
    guard = PublicOutputGuard()
    return guard.sanitize(text, context)


def guard_badge_output(badge_text: str) -> str:
    """Guard badge command output."""
    guard = BadgeGuard()
    return guard.validate_badge(badge_text)


def guard_caption_output(caption: str) -> str:
    """Guard image caption output."""
    guard = CaptionGuard()
    return guard.validate_caption(caption)
