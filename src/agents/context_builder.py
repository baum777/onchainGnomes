"""Context assembly for AI decisions."""

from datetime import datetime, timezone
from typing import Any

from src.models.context import AgentContext, Message, UserProfile
from src.models.events import NormalizedEvent
from src.state.manager import StateManager


class ContextBuilder:
    """Assembles relevant context for AI decisions."""

    def __init__(self, state_manager: StateManager):
        self._state = state_manager

    async def build(
        self,
        event: NormalizedEvent,
        conversation_history: list[dict[str, Any]] | None = None,
        user_profile: UserProfile | None = None,
        active_preset: str = "base",
        system_state: dict[str, Any] | None = None,
    ) -> AgentContext:
        """Build full context for an AI decision."""
        messages = []
        if conversation_history:
            for msg in conversation_history:
                messages.append(
                    Message(
                        id=str(msg.get("id", "")),
                        author_id=str(msg.get("author_id", "")),
                        content=msg.get("content", ""),
                        created_at=datetime.fromisoformat(
                            msg.get("created_at", datetime.now(timezone.utc).isoformat())
                        ),
                        is_from_bot=msg.get("is_from_bot", False),
                    )
                )

        if event.content and not any(m.content == event.content for m in messages):
            messages.append(
                Message(
                    id=event.id,
                    author_id=event.author_id or "",
                    content=event.content or "",
                    created_at=datetime.now(timezone.utc),
                    is_from_bot=False,
                )
            )

        return AgentContext(
            conversation_thread=messages,
            user_profile=user_profile,
            recent_posts=[],
            current_time=datetime.now(timezone.utc),
            active_preset=active_preset,
            system_state=system_state or {},
            event_metadata=event.metadata,
        )

    def format_for_prompt(self, context: AgentContext) -> str:
        """Format context for inclusion in prompt."""
        parts = []
        if context.conversation_thread:
            for msg in context.conversation_thread:
                role = "Bot" if msg.is_from_bot else "User"
                parts.append(f"{role}: {msg.content}")
        return "\n".join(parts) if parts else "(No prior conversation)"
