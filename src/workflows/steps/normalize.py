"""Event normalization step."""

from datetime import datetime, timezone
from typing import Any

from src.config.constants import EventType
from src.models.events import Event, NormalizedEvent


def normalize_tweet_to_event(
    tweet_data: dict[str, Any],
    event_type: EventType,
    source: str = "x_api",
) -> Event:
    """Convert X API tweet payload to Event."""
    tweet_id = tweet_data.get("id", "")
    if isinstance(tweet_id, int):
        tweet_id = str(tweet_id)

    return Event(
        id=tweet_id,
        type=event_type,
        source=source,
        payload=tweet_data,
        received_at=datetime.now(timezone.utc),
    )


def normalize_event(event: Event) -> NormalizedEvent:
    """Normalize raw event to workflow-ready format."""
    payload = event.payload

    tweet_id = payload.get("id")
    if isinstance(tweet_id, int):
        tweet_id = str(tweet_id)

    text = payload.get("text", "")
    author_id = payload.get("author_id", "")
    if isinstance(author_id, int):
        author_id = str(author_id)

    conversation_id = payload.get("conversation_id")
    if isinstance(conversation_id, int):
        conversation_id = str(conversation_id)

    in_reply_to = payload.get("in_reply_to_user_id")  # May be different from in_reply_to_tweet_id
    refs = payload.get("referenced_tweets", [])
    in_reply_to_id = None
    for ref in refs:
        if ref.get("type") == "replied_to":
            in_reply_to_id = ref.get("id")
            break

    return NormalizedEvent(
        id=event.id,
        type=event.type,
        tweet_id=tweet_id,
        author_id=author_id,
        content=text,
        thread_id=conversation_id,
        in_reply_to_id=in_reply_to_id,
        metadata={
            "source": event.source,
            "received_at": event.received_at.isoformat() if event.received_at else None,
        },
    )


class NormalizeStep:
    """Normalize raw event to workflow format."""

    async def run(self, context) -> "WorkflowContext":
        """Run normalization."""
        from src.workflows.engine import WorkflowContext
        ctx: WorkflowContext = context
        ctx.normalized_event = normalize_event(ctx.event)
        return ctx
