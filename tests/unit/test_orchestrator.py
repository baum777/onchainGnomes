"""Tests for Orchestrator."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.core.orchestrator import Orchestrator
from src.core.event_router import EventRouter
from src.config.constants import EventType, WorkflowType
from src.models.events import Event, NormalizedEvent


def test_event_router_mentions():
    """Test routing mention to MENTION workflow."""
    router = EventRouter()
    event = NormalizedEvent(id="1", type=EventType.MENTION, content="hi")
    workflow = router.route(event)
    assert workflow == WorkflowType.MENTION


def test_event_router_command():
    """Test routing command."""
    router = EventRouter()
    event = NormalizedEvent(id="1", type=EventType.COMMAND, content="/help")
    workflow = router.route(event)
    assert workflow == WorkflowType.COMMAND
