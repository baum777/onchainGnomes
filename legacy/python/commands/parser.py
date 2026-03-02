"""
Command DSL Parser

Deterministisches Parsing von Mini Commands.
Unterstützt: /ask, /img, /remix, /badge, /help

Design-Prinzipien:
1. Keine LLM-Interpretation beim Parsing
2. Strukturierte, deterministische Ausgabe
3. Klare Fehlermeldungen bei ungültigen Eingaben
4. Support für quoted strings
5. Case-insensitive Command-Erkennung
"""

import re
from typing import Optional, Dict, Any, Tuple, List
from dataclasses import dataclass

from .schemas import ParsedCommand, CommandName
from .errors import CommandValidationError, ErrorCatalog


@dataclass
class ParseResult:
    """Ergebnis des Parsing-Vorgangs."""
    success: bool
    parsed: Optional[ParsedCommand] = None
    error: Optional[CommandValidationError] = None


class CommandParser:
    """
    Deterministischer Command Parser für die Mini DSL.

    Unterstützt Commands:
    - /ask <text>
    - /img preset=<key> prompt="<text>"
    - /remix energy=1..5 flavor=<enum>
    - /badge me
    - /help

    Usage:
        parser = CommandParser()
        result = parser.parse("@bot /ask What is DePIN?", user_id="123")
        if result.success:
            print(result.parsed.name, result.parsed.args)
    """

    # Erkannte Command-Präfixe
    COMMAND_PREFIXES = ["/", "!", "."]

    # Gültige Command-Namen
    VALID_COMMANDS = {cmd.value for cmd in CommandName}

    # Regex für Command-Extraktion
    COMMAND_PATTERN = re.compile(
        r'^[@\w\s]*'  # Optional: Bot-Handle und Whitespace
        r'(?P<prefix>[\/!\.])'  # Command-Präfix
        r'(?P<name>\w+)'  # Command-Name
        r'(?P<args>.*)?$',  # Optionale Argumente
        re.IGNORECASE
    )

    # Regex für key=value Paare
    KV_PATTERN = re.compile(
        r'(\w+)=("[^"]*"|\S+)',  # key="quoted value" oder key=value
        re.IGNORECASE
    )

    # Gültige Flavors
    VALID_FLAVORS = {"chaos", "zen", "glitch", "ether", "neon", "vapor"}

    def __init__(self, bot_handles: Optional[List[str]] = None):
        """
        Initialisiert den Parser.

        Args:
            bot_handles: Liste von Bot-Handles die entfernt werden sollen
        """
        self.bot_handles = bot_handles or []

    def parse(
        self,
        text: str,
        user_id: Optional[str] = None,
        source_tweet_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        remix_of: Optional[str] = None
    ) -> ParseResult:
        """
        Parst einen Command aus Text.

        Args:
            text: Der zu parsende Text (z.B. Tweet-Inhalt)
            user_id: ID des Benutzers
            source_tweet_id: ID des Quell-Tweets
            conversation_id: ID der Konversation
            remix_of: Optional - Referenz zu vorherigem Remix

        Returns:
            ParseResult mit success, parsed Command oder error
        """
        # Text normalisieren
        normalized_text = self._normalize_text(text)

        # Command extrahieren
        command_match = self.COMMAND_PATTERN.match(normalized_text)
        if not command_match:
            return ParseResult(
                success=False,
                error=CommandValidationError(
                    error_code="NO_COMMAND",
                    message="Kein Command gefunden.",
                    suggestion="Commands beginnen mit /, ! oder ."
                )
            )

        groups = command_match.groupdict()
        name = groups["name"].lower()
        args_text = groups.get("args", "") or ""

        # Command-Name validieren
        if name not in self.VALID_COMMANDS:
            return ParseResult(
                success=False,
                error=ErrorCatalog.UNKNOWN_COMMAND(name)
            )

        # Argumente parsen
        command_name = CommandName(name)
        args, error = self._parse_args(command_name, args_text)

        if error:
            return ParseResult(success=False, error=error)

        # ParsedCommand erstellen
        parsed = ParsedCommand(
            name=command_name,
            args=args,
            raw_text=text,
            user_id=user_id,
            source_tweet_id=source_tweet_id,
            conversation_id=conversation_id,
            remix_of=remix_of
        )

        return ParseResult(success=True, parsed=parsed)

    def _normalize_text(self, text: str) -> str:
        """
        Normalisiert Text für das Parsing.

        - Entfernt Bot-Handles
        - Entfernt überflüssige Whitespace
        - Trimmt
        """
        normalized = text.strip()

        # Bot-Handles entfernen
        for handle in self.bot_handles:
            normalized = normalized.replace(handle, "")

        # Mehrfache Whitespace zu einfachem
        normalized = " ".join(normalized.split())

        return normalized.strip()

    def _parse_args(
        self,
        command: CommandName,
        args_text: str
    ) -> Tuple[Dict[str, Any], Optional[CommandValidationError]]:
        """
        Parst Command-spezifische Argumente.

        Args:
            command: Der Command-Name
            args_text: Der Argument-Text

        Returns:
            Tuple von (args dict, optional error)
        """
        parsers = {
            CommandName.ASK: self._parse_ask_args,
            CommandName.IMG: self._parse_img_args,
            CommandName.REMIX: self._parse_remix_args,
            CommandName.BADGE: self._parse_badge_args,
            CommandName.HELP: self._parse_help_args,
        }

        parser_func = parsers.get(command)
        if not parser_func:
            return {}, CommandValidationError(
                error_code="NO_PARSER",
                message=f"Kein Parser für Command: {command.value}"
            )

        return parser_func(args_text)

    def _parse_ask_args(self, args_text: str) -> Tuple[Dict[str, Any], Optional[CommandValidationError]]:
        """
        Parst /ask Argumente.

        Format: /ask <text>
        Beispiel: /ask What is DePIN?
        """
        text = args_text.strip()

        if not text:
            return {}, ErrorCatalog.MISSING_ARGUMENT("text")

        return {"text": text}, None

    def _parse_img_args(self, args_text: str) -> Tuple[Dict[str, Any], Optional[CommandValidationError]]:
        """
        Parst /img Argumente.

        Formate:
        - /img preset=<key> prompt="<text>"
        - /img prompt="<text>"
        - /img preset=<key>
        - /img <text> (impliziter Prompt)

        Beispiele:
        - /img preset=cyberpunk prompt="robot trader"
        - /img "a beautiful sunset"
        """
        args: Dict[str, Any] = {}
        text = args_text.strip()

        if not text:
            return {}, ErrorCatalog.MISSING_ARGUMENT("prompt oder preset")

        # Key-Value Paare extrahieren
        kv_args = {}
        remaining = text

        for match in self.KV_PATTERN.finditer(text):
            key = match.group(1).lower()
            value = match.group(2)

            # Quotes entfernen wenn vorhanden
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            kv_args[key] = value
            remaining = remaining.replace(match.group(0), "")

        remaining = remaining.strip()

        # Preset extrahieren
        if "preset" in kv_args:
            args["preset"] = kv_args["preset"]

        # Prompt extrahieren
        if "prompt" in kv_args:
            args["prompt"] = kv_args["prompt"]
        elif remaining:
            # Rest als impliziter Prompt
            args["prompt"] = remaining

        return args, None

    def _parse_remix_args(self, args_text: str) -> Tuple[Dict[str, Any], Optional[CommandValidationError]]:
        """
        Parst /remix Argumente.

        Format: /remix energy=1..5 flavor=<enum>
        Beispiel: /remix energy=5 flavor=chaos
        """
        args: Dict[str, Any] = {}
        text = args_text.strip()

        if not text:
            # Default-Werte wenn keine Argumente
            return {"energy": 3, "flavor": "zen"}, None

        # Key-Value Paare extrahieren
        for match in self.KV_PATTERN.finditer(text):
            key = match.group(1).lower()
            value = match.group(2).lower()

            # Quotes entfernen
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            args[key] = value

        # Validierung
        # Energy validieren
        if "energy" in args:
            try:
                energy = int(args["energy"])
                if energy < 1 or energy > 5:
                    return {}, ErrorCatalog.INVALID_ENERGY
                args["energy"] = energy
            except ValueError:
                return {}, ErrorCatalog.INVALID_ENERGY
        else:
            args["energy"] = 3  # Default

        # Flavor validieren
        if "flavor" in args:
            flavor = args["flavor"].lower()
            if flavor not in self.VALID_FLAVORS:
                return {}, ErrorCatalog.INVALID_FLAVOR(flavor)
            args["flavor"] = flavor
        else:
            args["flavor"] = "zen"  # Default

        return args, None

    def _parse_badge_args(self, args_text: str) -> Tuple[Dict[str, Any], Optional[CommandValidationError]]:
        """
        Parst /badge Argumente.

        Format: /badge me
        Beispiel: /badge me
        """
        text = args_text.strip().lower()

        if not text:
            return {}, ErrorCatalog.MISSING_ARGUMENT("me")

        if text != "me":
            return {}, CommandValidationError(
                error_code="INVALID_BADGE_ARG",
                message="Badge-Command erwartet 'me' als Argument.",
                suggestion="Verwende: /badge me"
            )

        return {"target": "me"}, None

    def _parse_help_args(self, args_text: str) -> Tuple[Dict[str, Any], Optional[CommandValidationError]]:
        """
        Parst /help Argumente.

        Format: /help [topic]
        Beispiel: /help, /help img
        """
        text = args_text.strip().lower()

        if text:
            return {"topic": text}, None

        return {}, None  # Keine Argumente = allgemeine Hilfe

    def has_command(self, text: str) -> bool:
        """
        Prüft ob Text ein Command enthält.

        Args:
            text: Zu prüfender Text

        Returns:
            True wenn Command gefunden
        """
        normalized = self._normalize_text(text)
        return bool(self.COMMAND_PATTERN.match(normalized))

    def extract_command_name(self, text: str) -> Optional[str]:
        """
        Extrahiert den Command-Namen aus Text.

        Args:
            text: Text mit Command

        Returns:
            Command-Name oder None
        """
        normalized = self._normalize_text(text)
        match = self.COMMAND_PATTERN.match(normalized)

        if match:
            return match.group("name").lower()

        return None
