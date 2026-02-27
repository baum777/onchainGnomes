"""State models for persistence."""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any


@dataclass
class ProcessedEventRecord:
    """Record of a processed event."""

    id: str
    event_type: str
    processed_at: datetime
    action_type: str | None
    success: bool
    error_message: str | None = None


@dataclass
class ConversationRecord:
    """Conversation record for thread tracking."""

    thread_id: str
    root_tweet_id: str | None
    context_summary: str | None
    last_activity: datetime
    reply_count: int


class CooldownStatus:
    """Status of a cooldown check."""

    def __init__(self, active: bool, remaining_seconds: float = 0):
        self.active = active
        self.remaining_seconds = remaining_seconds

