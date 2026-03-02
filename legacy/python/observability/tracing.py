"""Debug tracing for agent decisions."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from src.observability.logger import get_logger

logger = get_logger(__name__)


@dataclass
class DecisionStep:
    """A single step in the decision chain."""

    step: str
    result: Any
    metadata: dict[str, Any] = field(default_factory=dict)


def log_decision_chain(
    event_id: str,
    decision_chain: list[DecisionStep],
    final_action: str | None = None,
    success: bool | None = None,
) -> None:
    """Log the full decision chain for debugging agent decisions."""
    payload = {
        "event_id": event_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "decision_chain": [
            {
                "step": s.step,
                "result": str(s.result),
                **s.metadata,
            }
            for s in decision_chain
        ],
        "final_action": final_action,
        "success": success,
    }
    logger.debug("decision_chain", **payload)
