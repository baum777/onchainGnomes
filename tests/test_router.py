"""
Tests für den Command Router

Validiert:
- Command-Routing
- Template-Auswahl
- Brand Matrix Integration
- Fehlerbehandlung
"""

import pytest
from src.commands.router import CommandRouter, RouteResult
from src.commands.parser import CommandParser
from src.commands.schemas import CommandName, ActionType, Flavor, ParsedCommand, CommandContext
from src.commands.errors import ErrorCatalog


class MockImagePresets:
    """Mock für ImagePresetLoader."""

    def has_preset(self, name: str) -> bool:
        return name in ["cyberpunk", "vaporwave", "abstract"]


class TestCommandRouter:
    """Test-Suite für CommandRouter."""

    @pytest.fixture
    def router(self):
        """Erzeugt einen Router mit Mock-Presets."""
        presets = MockImagePresets()
        return CommandRouter(image_presets=presets)

    @pytest.fixture
    def parser(self):
        """Erzeugt einen Parser."""
        return CommandParser()

    def test_route_ask(self, router, parser):
        """Testet Routing von /ask."""
        parsed = parser.parse("/ask What is DePIN?", user_id="123").parsed
        result = router.route(parsed)

        assert result.success is True
        assert result.action_plan.action_type == ActionType.TEXT_GENERATION
        assert result.action_plan.template_key == "text_default"
        assert result.action_plan.prompt_text == "What is DePIN?"

    def test_route_img_with_preset(self, router, parser):
        """Testet Routing von /img mit Preset."""
        parsed = parser.parse('/img preset=cyberpunk prompt="robot"', user_id="123").parsed
        result = router.route(parsed)

        assert result.success is True
        assert result.action_plan.action_type == ActionType.IMAGE_GENERATION
        assert result.action_plan.template_key == "image_generation"
        assert result.action_plan.preset_key == "cyberpunk"

    def test_route_img_invalid_preset(self, router, parser):
        """Testet Routing mit ungültigem Preset."""
        parsed = parser.parse('/img preset=invalid prompt="test"', user_id="123").parsed
        result = router.route(parsed)

        assert result.success is False
        assert result.error.error_code == "UNKNOWN_PRESET"

    def test_route_remix(self, router, parser):
        """Testet Routing von /remix."""
        parsed = parser.parse('/remix energy=5 flavor=chaos', user_id="123").parsed
        result = router.route(parsed)

        assert result.success is True
        assert result.action_plan.action_type == ActionType.REMIX_GENERATION
        assert result.action_plan.energy == 5
        assert result.action_plan.flavor == Flavor.CHAOS
        assert "remix_dynamic_chaos" in result.action_plan.template_key

    def test_route_badge(self, router, parser):
        """Testet Routing von /badge."""
        parsed = parser.parse('/badge me', user_id="123").parsed
        result = router.route(parsed)

        assert result.success is True
        assert result.action_plan.action_type == ActionType.BADGE_STATUS
        assert result.action_plan.template_key == "badge_status"

    def test_route_help(self, router, parser):
        """Testet Routing von /help."""
        parsed = parser.parse('/help', user_id="123").parsed
        result = router.route(parsed)

        assert result.success is True
        assert result.action_plan.action_type == ActionType.HELP
        assert result.action_plan.prompt_text == "general"

    def test_route_with_context(self, router, parser):
        """Testet Routing mit CommandContext."""
        parsed = parser.parse('/ask hello', user_id="123").parsed

        context = CommandContext(
            user_handle="@testuser",
            user_stats={"energy": 4}
        )

        result = router.route(parsed, context)

        assert result.success is True
        assert result.action_plan.energy == 4

    def test_get_template_for_command(self, router):
        """Testet Template-Lookup."""
        assert router.get_template_for_command("ask") == "text_default"
        assert router.get_template_for_command("img") == "image_generation"
        assert router.get_template_for_command("unknown") is None


class TestCommandRouterTemplates:
    """Tests für Template-Auswahl."""

    @pytest.fixture
    def router(self):
        return CommandRouter()

    def test_all_flavor_templates_exist(self, router, parser):
        """Testet dass für alle Flavors Templates existieren."""
        flavors = ["chaos", "zen", "glitch", "ether", "neon", "vapor"]

        for flavor in flavors:
            parsed = parser.parse(f'/remix flavor={flavor}', user_id="123").parsed
            result = router.route(parsed)

            assert result.success is True
            expected_template = f"remix_dynamic_{flavor}"
            assert result.action_plan.template_key == expected_template


class TestCommandRouterIntegration:
    """Integration-Tests für Router."""

    def test_full_flow_ask(self):
        """Testet kompletten Flow für /ask."""
        parser = CommandParser()
        router = CommandRouter()

        parse_result = parser.parse("/ask What is the meaning of life?", user_id="42")
        assert parse_result.success is True

        route_result = router.route(parse_result.parsed)
        assert route_result.success is True

        plan = route_result.action_plan
        assert plan.action_type == ActionType.TEXT_GENERATION
        assert plan.to_matrix_payload()["user_prompt"] == "What is the meaning of life?"
