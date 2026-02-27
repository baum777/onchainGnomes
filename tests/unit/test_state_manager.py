"""Tests for StateManager."""

import pytest
import tempfile
from pathlib import Path

from src.state.manager import StateManager


@pytest.mark.asyncio
async def test_event_deduplication():
    """Test processed event tracking."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        async with StateManager(db_path) as state:
            assert not await state.is_event_processed("evt1")
            await state.mark_event_processed(
                "evt1", "mention", "reply", True
            )
            assert await state.is_event_processed("evt1")
    finally:
        Path(db_path).unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_cooldown():
    """Test cooldown set and get."""
    from datetime import datetime, timedelta, timezone

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        async with StateManager(db_path) as state:
            state.conn  # ensure migrations run
            await state.set_cooldown(
                "per_user_reply",
                "user123",
                datetime.now(timezone.utc) + timedelta(minutes=5),
            )
            expires = await state.get_cooldown("per_user_reply", "user123")
            assert expires is not None
    finally:
        Path(db_path).unlink(missing_ok=True)
