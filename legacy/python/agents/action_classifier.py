"""Action classification - determine intent from event."""

from dataclasses import dataclass

from src.config.constants import ActionType
from src.models.events import NormalizedEvent


@dataclass
class ClassificationResult:
    """Result of action classification."""

    action_type: ActionType
    confidence: float
    reason: str = ""


class ActionClassifier:
    """Classifies events to determine appropriate action type."""

    def classify(self, event: NormalizedEvent) -> ClassificationResult:
        """Determine action type from normalized event.

        For MVP, uses rule-based classification.
        Future: Could use AI for more nuanced decisions.
        """
        if event.type.value == "mention":
            return ClassificationResult(
                action_type=ActionType.REPLY,
                confidence=0.95,
                reason="Mention requires reply",
            )
        if event.type.value == "timeline":
            return ClassificationResult(
                action_type=ActionType.POST,
                confidence=0.8,
                reason="Timeline event for autonomous posting",
            )
        if event.type.value == "command":
            return ClassificationResult(
                action_type=ActionType.REPLY,
                confidence=1.0,
                reason="Command requires response",
            )
        if event.type.value == "reply":
            return ClassificationResult(
                action_type=ActionType.REPLY,
                confidence=0.9,
                reason="Reply in conversation",
            )

        return ClassificationResult(
            action_type=ActionType.IGNORE,
            confidence=0.5,
            reason="Unknown event type",
        )
