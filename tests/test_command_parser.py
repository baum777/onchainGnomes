"""
Tests für den Command Parser

Validiert:
- Command-Erkennung
- Argument-Parsing
- Fehlerbehandlung
- Edge Cases
"""

import pytest
from src.commands.parser import CommandParser
from src.commands.schemas import CommandName
from src.commands.errors import ErrorCatalog


class TestCommandParser:
    """Test-Suite für CommandParser."""

    @pytest.fixture
    def parser(self):
        """Erzeugt einen Parser mit Standard-Handles."""
        return CommandParser(bot_handles=["@mybot", "@testbot"])

    def test_parse_ask_simple(self, parser):
        """Testet einfaches /ask Command."""
        result = parser.parse("/ask What is DePIN?", user_id="123")

        assert result.success is True
        assert result.parsed.name == CommandName.ASK
        assert result.parsed.args["text"] == "What is DePIN?"
        assert result.parsed.user_id == "123"

    def test_parse_ask_with_bot_handle(self, parser):
        """Testet /ask mit Bot-Handle."""
        result = parser.parse("@mybot /ask Hello world", user_id="456")

        assert result.success is True
        assert result.parsed.name == CommandName.ASK
        assert result.parsed.args["text"] == "Hello world"

    def test_parse_img_with_preset(self, parser):
        """Testet /img mit Preset."""
        result = parser.parse('/img preset=cyberpunk prompt="robot trader"', user_id="789")

        assert result.success is True
        assert result.parsed.name == CommandName.IMG
        assert result.parsed.args["preset"] == "cyberpunk"
        assert result.parsed.args["prompt"] == "robot trader"

    def test_parse_img_implicit_prompt(self, parser):
        """Testet /img mit implizitem Prompt."""
        result = parser.parse('/img a beautiful sunset', user_id="789")

        assert result.success is True
        assert result.parsed.args["prompt"] == "a beautiful sunset"

    def test_parse_remix_with_args(self, parser):
        """Testet /remix mit allen Argumenten."""
        result = parser.parse('/remix energy=5 flavor=chaos', user_id="abc")

        assert result.success is True
        assert result.parsed.name == CommandName.REMIX
        assert result.parsed.args["energy"] == 5
        assert result.parsed.args["flavor"] == "chaos"

    def test_parse_remix_defaults(self, parser):
        """Testet /remix mit Default-Werten."""
        result = parser.parse('/remix', user_id="abc")

        assert result.success is True
        assert result.parsed.args["energy"] == 3
        assert result.parsed.args["flavor"] == "zen"

    def test_parse_remix_invalid_energy(self, parser):
        """Testet /remix mit ungültigem Energy-Wert."""
        result = parser.parse('/remix energy=10', user_id="abc")

        assert result.success is False
        assert result.error.error_code == "INVALID_ENERGY"

    def test_parse_remix_invalid_flavor(self, parser):
        """Testet /remix mit ungültigem Flavor."""
        result = parser.parse('/remix flavor=invalid', user_id="abc")

        assert result.success is False
        assert result.error.error_code == "INVALID_FLAVOR"

    def test_parse_badge_me(self, parser):
        """Testet /badge me."""
        result = parser.parse('/badge me', user_id="user123")

        assert result.success is True
        assert result.parsed.name == CommandName.BADGE
        assert result.parsed.args["target"] == "me"

    def test_parse_badge_missing_arg(self, parser):
        """Testet /badge ohne Argument."""
        result = parser.parse('/badge', user_id="user123")

        assert result.success is False
        assert result.error.error_code == "MISSING_ARGUMENT"

    def test_parse_help(self, parser):
        """Testet /help."""
        result = parser.parse('/help', user_id="user456")

        assert result.success is True
        assert result.parsed.name == CommandName.HELP
        assert result.parsed.args == {}

    def test_parse_help_with_topic(self, parser):
        """Testet /help mit Topic."""
        result = parser.parse('/help img', user_id="user456")

        assert result.success is True
        assert result.parsed.name == CommandName.HELP
        assert result.parsed.args["topic"] == "img"

    def test_parse_unknown_command(self, parser):
        """Testet unbekanntes Command."""
        result = parser.parse('/unknown something', user_id="user")

        assert result.success is False
        assert result.error.error_code == "UNKNOWN_COMMAND"

    def test_parse_no_command(self, parser):
        """Testet Text ohne Command."""
        result = parser.parse('Just a normal message', user_id="user")

        assert result.success is False
        assert result.error.error_code == "NO_COMMAND"

    def test_has_command_true(self, parser):
        """Testet Command-Erkennung (positiv)."""
        assert parser.has_command("/ask hello") is True
        assert parser.has_command("/help") is True

    def test_has_command_false(self, parser):
        """Testet Command-Erkennung (negativ)."""
        assert parser.has_command("Just text") is False
        assert parser.has_command("no command here") is False

    def test_extract_command_name(self, parser):
        """Testet Command-Name-Extraktion."""
        assert parser.extract_command_name("/ask something") == "ask"
        assert parser.extract_command_name("/remix") == "remix"
        assert parser.extract_command_name("no command") is None

    def test_parse_with_conversation_id(self, parser):
        """Testet Parsing mit Conversation ID."""
        result = parser.parse(
            '/ask Hello',
            user_id="user",
            source_tweet_id="tweet123",
            conversation_id="conv456"
        )

        assert result.success is True
        assert result.parsed.source_tweet_id == "tweet123"
        assert result.parsed.conversation_id == "conv456"

    def test_parse_with_remix_of(self, parser):
        """Testet Parsing mit Remix-Referenz."""
        result = parser.parse(
            '/remix energy=4 flavor=glitch',
            user_id="user",
            remix_of="original_tweet_789"
        )

        assert result.success is True
        assert result.parsed.remix_of == "original_tweet_789"

    def test_parse_case_insensitive(self, parser):
        """Testet case-insensitive Commands."""
        result = parser.parse('/ASK hello', user_id="user")

        assert result.success is True
        assert result.parsed.name == CommandName.ASK

    def test_parse_single_quotes(self, parser):
        """Testet Parsing mit einfachen Anführungszeichen."""
        result = parser.parse("/img prompt='single quoted text'", user_id="user")

        assert result.success is True
        assert result.parsed.args["prompt"] == "single quoted text"

    def test_parse_double_quotes(self, parser):
        """Testet Parsing mit doppelten Anführungszeichen."""
        result = parser.parse('/img prompt="double quoted text"', user_id="user")

        assert result.success is True
        assert result.parsed.args["prompt"] == "double quoted text"


class TestCommandParserEdgeCases:
    """Edge Cases für Command Parser."""

    @pytest.fixture
    def parser(self):
        return CommandParser()

    def test_empty_string(self, parser):
        """Testet leeren String."""
        result = parser.parse("", user_id="user")
        assert result.success is False

    def test_whitespace_only(self, parser):
        """Testet nur Whitespace."""
        result = parser.parse("   ", user_id="user")
        assert result.success is False

    def test_ask_empty_text(self, parser):
        """Testet /ask ohne Text."""
        result = parser.parse("/ask   ", user_id="user")
        assert result.success is False

    def test_img_empty(self, parser):
        """Testet /img ohne Argumente."""
        result = parser.parse("/img", user_id="user")
        assert result.success is False

    def test_multiple_spaces(self, parser):
        """Testet mehrfache Leerzeichen."""
        result = parser.parse("/ask    hello   world   ", user_id="user")
        assert result.success is True
        assert result.parsed.args["text"] == "hello world"

    def test_energy_boundary_low(self, parser):
        """Testet Energy-Grenzwert 1."""
        result = parser.parse("/remix energy=1", user_id="user")
        assert result.success is True
        assert result.parsed.args["energy"] == 1

    def test_energy_boundary_high(self, parser):
        """Testet Energy-Grenzwert 5."""
        result = parser.parse("/remix energy=5", user_id="user")
        assert result.success is True
        assert result.parsed.args["energy"] == 5

    def test_energy_boundary_zero(self, parser):
        """Testet Energy=0 (ungültig)."""
        result = parser.parse("/remix energy=0", user_id="user")
        assert result.success is False

    def test_energy_boundary_six(self, parser):
        """Testet Energy=6 (ungültig)."""
        result = parser.parse("/remix energy=6", user_id="user")
        assert result.success is False

    def test_all_valid_flavors(self, parser):
        """Testet alle gültigen Flavors."""
        valid_flavors = ["chaos", "zen", "glitch", "ether", "neon", "vapor"]

        for flavor in valid_flavors:
            result = parser.parse(f"/remix flavor={flavor}", user_id="user")
            assert result.success is True, f"Flavor {flavor} sollte gültig sein"
