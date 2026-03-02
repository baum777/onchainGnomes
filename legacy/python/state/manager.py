"""State management and persistence operations."""

import aiosqlite
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.config import get_settings
from src.models.state import ProcessedEventRecord


class StateManager:
    """Manages all persistence operations for the agent."""

    def __init__(self, db_path: Path | str | None = None):
        settings = get_settings()
        self._db_path = Path(db_path or settings.state_db)
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        """Establish database connection and run migrations if needed."""
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(str(self._db_path))
        self._conn.row_factory = aiosqlite.Row

        # Run migrations on first connect
        migrations_dir = Path(__file__).parent / "migrations"
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            name = sql_file.name
            cursor = await self._conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='_migrations'"
            )
            if await cursor.fetchone():
                cursor = await self._conn.execute(
                    "SELECT 1 FROM _migrations WHERE name = ?", (name,)
                )
                if await cursor.fetchone():
                    continue
            else:
                await self._conn.execute("""
                    CREATE TABLE IF NOT EXISTS _migrations (
                        name TEXT PRIMARY KEY,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
            sql = sql_file.read_text()
            await self._conn.executescript(sql)
            await self._conn.execute("INSERT OR IGNORE INTO _migrations (name) VALUES (?)", (name,))
            await self._conn.commit()

    async def close(self) -> None:
        """Close database connection."""
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def __aenter__(self) -> "StateManager":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()

    @property
    def conn(self) -> aiosqlite.Connection:
        """Get connection, raises if not connected."""
        if not self._conn:
            raise RuntimeError("StateManager not connected. Call connect() first.")
        return self._conn

    # Processed events
    async def is_event_processed(self, event_id: str) -> bool:
        """Check if event was already processed."""
        cursor = await self.conn.execute(
            "SELECT 1 FROM processed_events WHERE id = ?",
            (event_id,),
        )
        return (await cursor.fetchone()) is not None

    async def mark_event_processed(
        self,
        event_id: str,
        event_type: str,
        action_type: str | None,
        success: bool,
        error_message: str | None = None,
    ) -> None:
        """Mark event as processed."""
        await self.conn.execute(
            """INSERT INTO processed_events 
               (id, event_type, action_type, success, error_message)
               VALUES (?, ?, ?, ?, ?)""",
            (event_id, event_type, action_type or "", success, error_message or ""),
        )
        await self.conn.commit()

    # Cooldowns
    async def get_cooldown(self, cooldown_type: str, target_id: str) -> datetime | None:
        """Get cooldown expiry if active."""
        cursor = await self.conn.execute(
            "SELECT expires_at FROM cooldowns WHERE type = ? AND target_id = ?",
            (cooldown_type, target_id),
        )
        row = await cursor.fetchone()
        if row and row[0]:
            return datetime.fromisoformat(row[0])
        return None

    async def set_cooldown(
        self,
        cooldown_type: str,
        target_id: str,
        expires_at: datetime,
    ) -> None:
        """Set or update cooldown."""
        await self.conn.execute(
            """INSERT OR REPLACE INTO cooldowns (type, target_id, expires_at)
               VALUES (?, ?, ?)""",
            (cooldown_type, target_id, expires_at.isoformat()),
        )
        await self.conn.commit()

    async def clear_expired_cooldowns(self) -> None:
        """Remove expired cooldown entries."""
        now = datetime.now(timezone.utc).isoformat()
        await self.conn.execute(
            "DELETE FROM cooldowns WHERE expires_at < ?",
            (now,),
        )
        await self.conn.commit()

    # System state
    async def get_system_state(self, key: str) -> str | None:
        """Get system state value."""
        cursor = await self.conn.execute(
            "SELECT value FROM system_state WHERE key = ?",
            (key,),
        )
        row = await cursor.fetchone()
        return row[0] if row else None

    async def set_system_state(self, key: str, value: str) -> None:
        """Set system state value."""
        now = datetime.now(timezone.utc).isoformat()
        await self.conn.execute(
            """INSERT OR REPLACE INTO system_state (key, value, updated_at)
               VALUES (?, ?, ?)""",
            (key, value, now),
        )
        await self.conn.commit()

    # Conversations
    async def get_conversation_reply_count(self, thread_id: str) -> int:
        """Get reply count for a conversation thread."""
        cursor = await self.conn.execute(
            "SELECT reply_count FROM conversations WHERE thread_id = ?",
            (thread_id,),
        )
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def upsert_conversation(
        self,
        thread_id: str,
        root_tweet_id: str | None = None,
        context_summary: str | None = None,
        reply_count: int = 0,
    ) -> None:
        """Insert or update conversation record."""
        now = datetime.now(timezone.utc).isoformat()
        await self.conn.execute(
            """INSERT INTO conversations 
               (thread_id, root_tweet_id, context_summary, last_activity, reply_count)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(thread_id) DO UPDATE SET
                 last_activity = excluded.last_activity,
                 reply_count = excluded.reply_count,
                 context_summary = COALESCE(excluded.context_summary, context_summary),
                 root_tweet_id = CASE WHEN excluded.root_tweet_id != '' 
                    THEN excluded.root_tweet_id ELSE root_tweet_id END""",
            (thread_id, root_tweet_id or "", context_summary or "", now, reply_count),
        )
        await self.conn.commit()

    async def increment_conversation_reply_count(self, thread_id: str) -> None:
        """Increment reply count for a thread."""
        await self.conn.execute(
            """UPDATE conversations 
               SET reply_count = reply_count + 1, last_activity = ?
               WHERE thread_id = ?""",
            (datetime.now(timezone.utc).isoformat(), thread_id),
        )
        await self.conn.commit()

    async def add_conversation_message(
        self,
        thread_id: str,
        tweet_id: str,
        author_id: str,
        content: str,
        created_at: datetime,
        is_from_bot: bool = False,
    ) -> None:
        """Add message to conversation."""
        await self.conn.execute(
            """INSERT OR IGNORE INTO conversation_messages 
               (thread_id, tweet_id, author_id, content, created_at, is_from_bot)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                thread_id,
                tweet_id,
                author_id,
                content,
                created_at.isoformat(),
                is_from_bot,
            ),
        )
        await self.conn.commit()
