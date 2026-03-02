"""Conversation tracking for thread management."""

from datetime import datetime, timezone

from src.config.constants import MAX_REPLIES_PER_THREAD
from src.models.context import Message
from src.models.state import CooldownStatus
from src.state.manager import StateManager


class ConversationTracker:
    """Tracks conversations and enforces reply limits."""

    def __init__(self, state_manager: StateManager):
        self._state = state_manager

    async def get_thread_reply_count(self, thread_id: str) -> int:
        """Get number of bot replies in this thread."""
        return await self._state.get_conversation_reply_count(thread_id)

    async def can_reply_to_thread(self, thread_id: str) -> bool:
        """Check if we can still reply to this thread."""
        count = await self.get_thread_reply_count(thread_id)
        return count < MAX_REPLIES_PER_THREAD

    async def record_reply(self, thread_id: str) -> None:
        """Record that we replied to a thread."""
        await self._state.increment_conversation_reply_count(thread_id)

    async def upsert_conversation(
        self,
        thread_id: str,
        root_tweet_id: str | None = None,
        context_summary: str | None = None,
        reply_count: int = 0,
    ) -> None:
        """Create or update conversation record."""
        await self._state.upsert_conversation(
            thread_id=thread_id,
            root_tweet_id=root_tweet_id,
            context_summary=context_summary,
            reply_count=reply_count,
        )

    async def add_message(
        self,
        thread_id: str,
        tweet_id: str,
        author_id: str,
        content: str,
        created_at: datetime,
        is_from_bot: bool = False,
    ) -> None:
        """Add message to conversation history."""
        await self._state.add_conversation_message(
            thread_id=thread_id,
            tweet_id=tweet_id,
            author_id=author_id,
            content=content,
            created_at=created_at,
            is_from_bot=is_from_bot,
        )
