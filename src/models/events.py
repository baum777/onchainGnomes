"""Event dataclasses for workflow processing."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from src.config.constants import EventType


@dataclass
class Event:
    """Raw event from X API or scheduler."""

    id: str
    type: EventType
    source: str
    payload: dict[str, Any]
    received_at: datetime | None = None


@dataclass
class NormalizedEvent:
    """Normalized event for workflow processing."""

    id: str
    type: EventType
    tweet_id: str | None = None
    author_id: str | None = None
    content: str | None = None
    thread_id: str | None = None
    in_reply_to_id: str | None = None
    metadata: dict[str, Any] | None = None
