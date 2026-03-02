"""Context dataclasses for AI decisions."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class Message:
    """Single message in a conversation."""

    id: str
    author_id: str
    content: str
    created_at: datetime
    is_from_bot: bool = False


@dataclass
class UserProfile:
    """User profile information."""

    user_id: str
    username: str | None = None
    display_name: str | None = None
    metadata: dict[str, Any] | None = None


@dataclass
class AgentContext:
    """Context assembled for AI decisions."""

    conversation_thread: list[Message]
    user_profile: UserProfile | None
    recent_posts: list[dict[str, Any]]
    current_time: datetime
    active_preset: str
    system_state: dict[str, Any]
    event_metadata: dict[str, Any] | None = None
