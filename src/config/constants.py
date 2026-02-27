"""Enums and default constants."""

from enum import Enum


class EventType(str, Enum):
    """Types of events from X API."""

    MENTION = "mention"
    TIMELINE = "timeline"
    REPLY = "reply"
    DM = "dm"
    SCHEDULED = "scheduled"
    COMMAND = "command"


class ActionType(str, Enum):
    """Types of actions the agent can execute."""

    REPLY = "reply"
    POST = "post"
    LIKE = "like"
    RETWEET = "retweet"
    GENERATE_IMAGE = "generate_image"
    IGNORE = "ignore"


class WorkflowType(str, Enum):
    """Workflow types for routing."""

    MENTION = "mention"
    TIMELINE = "timeline"
    REPLY = "reply"
    DM = "dm"
    SCHEDULED = "scheduled"
    COMMAND = "command"


class CooldownType(str, Enum):
    """Cooldown types for rate limiting."""

    PER_USER_REPLY = "per_user_reply"
    GLOBAL_POSTING = "global_posting"
    PER_THREAD = "per_thread"
    API_CALL = "api_call"


# Default durations in seconds
COOLDOWN_DURATIONS = {
    CooldownType.PER_USER_REPLY: 300,  # 5 min
    CooldownType.GLOBAL_POSTING: 900,  # 15 min
    CooldownType.PER_THREAD: 0,  # Count-based, not time
    CooldownType.API_CALL: 60,  # 1 min default
}

# Max replies per thread
MAX_REPLIES_PER_THREAD = 3
