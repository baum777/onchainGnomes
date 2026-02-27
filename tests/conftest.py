"""Pytest configuration and fixtures."""

import os
import pytest
from pathlib import Path

# Force test config
os.environ.setdefault("STATE_DB_PATH", "state/test_agent.db")
os.environ.setdefault("DRY_RUN", "true")
os.environ.setdefault("LOG_LEVEL", "WARNING")


@pytest.fixture
def sample_tweet_payload():
    """Sample tweet from X API."""
    return {
        "id": "1234567890",
        "text": "Hello @testbot",
        "author_id": "111",
        "conversation_id": "1234567890",
        "created_at": "2026-02-27T10:00:00Z",
        "referenced_tweets": [],
    }


@pytest.fixture
def sample_event(sample_tweet_payload):
    """Sample Event for testing."""
    from src.models.events import Event
    from src.config.constants import EventType

    return Event(
        id="1234567890",
        type=EventType.MENTION,
        source="test",
        payload=sample_tweet_payload,
    )
