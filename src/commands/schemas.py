"""
Command DSL Schemas

Datenmodelle für die Mini Command DSL.
Definiert die Struktur von ParsedCommand und ActionPlan.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from enum import Enum


class CommandName(str, Enum):
    """Unterstützte Command-Namen."""
    ASK = "ask"
    IMG = "img"
    REMIX = "remix"
    BADGE = "badge"
    HELP = "help"


class ActionType(str, Enum):
    """Action-Typen für die Workflow-Engine."""
    TEXT_GENERATION = "text_generation"
    IMAGE_GENERATION = "image_generation"
    REMIX_GENERATION = "remix_generation"
    BADGE_STATUS = "badge_status"
    HELP = "help"


class Flavor(str, Enum):
    """Verfügbare Flavor-Optionen für Remix."""
    CHAOS = "chaos"
    ZEN = "zen"
    GLITCH = "glitch"
    ETHER = "ether"
    NEON = "neon"
    VAPOR = "vapor"


@dataclass
class ParsedCommand:
    """
    Repräsentiert ein geparstes Command nach dem Parsing.

    Attributes:
        name: Der Command-Name (ask, img, remix, badge, help)
        args: Dictionary mit geparsten Argumenten
        raw_text: Der originale unverarbeitete Text
        user_id: ID des Benutzers, der das Command gesendet hat
        source_tweet_id: ID des Tweets, der das Command enthält
        conversation_id: ID der Konversation (für Thread-Kontext)
        remix_of: Optional - Referenz zu einem vorherigen Remix
    """
    name: CommandName
    args: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""
    user_id: Optional[str] = None
    source_tweet_id: Optional[str] = None
    conversation_id: Optional[str] = None
    remix_of: Optional[str] = None

    def get_arg(self, key: str, default: Any = None) -> Any:
        """Holt ein Argument mit Default-Wert."""
        return self.args.get(key, default)


@dataclass
class ActionPlan:
    """
    Der ActionPlan definiert, WAS ausgeführt werden soll.

    Wird vom Router aus dem ParsedCommand erzeugt und enthält
    alle notwendigen Informationen für die Workflow-Execution.

    Attributes:
        action_type: Typ der auszuführenden Action
        template_key: Schlüssel für das Brand Matrix Template
        energy: Energie-Level (1-5) für Generation
        flavor: Stilrichtung für Generation
        prompt_text: Der verarbeitete Prompt-Text
        preset_key: Optional - Schlüssel für Image Preset
        metadata: Zusätzliche Metadaten für die Ausführung
        parsed_command: Referenz zum originalen Command
    """
    action_type: ActionType
    template_key: str = "default"
    energy: int = 3
    flavor: Flavor = Flavor.ZEN
    prompt_text: str = ""
    preset_key: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    parsed_command: Optional[ParsedCommand] = None

    def to_matrix_payload(self) -> Dict[str, Any]:
        """
        Konvertiert den ActionPlan in ein Brand Matrix Payload.

        Returns:
            Dictionary im v2-Contract Format
        """
        return {
            "user_prompt": self.prompt_text,
            "energy": self.energy,
            "flavor": self.flavor.value,
            "template_key": self.template_key,
            "remix_of": self.parsed_command.remix_of if self.parsed_command else None,
            "preview_request_id": self.metadata.get("preview_request_id"),
            "preset_key": self.preset_key,
            "action_type": self.action_type.value,
        }


@dataclass
class CommandResult:
    """
    Ergebnis der Command-Ausführung.

    Attributes:
        success: Ob die Ausführung erfolgreich war
        content: Der generierte Inhalt (Text oder Bild-URL)
        media_id: Optional - Media ID für hochgeladene Bilder
        metadata: Zusätzliche Ausführungs-Metadaten
        error_message: Fehlermeldung bei Misserfolg
    """
    success: bool
    content: str = ""
    media_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None

    @property
    def is_error(self) -> bool:
        """Prüft ob das Ergebnis ein Fehler ist."""
        return not self.success


@dataclass
class CommandContext:
    """
    Kontext-Informationen für Command-Ausführung.

    Wird während der Workflow-Ausführung aufgebaut und enthält
    alle relevanten Informationen für die Command-Verarbeitung.

    Attributes:
        user_handle: X-Handle des Benutzers
        user_display_name: Anzeigename des Benutzers
        conversation_history: Liste vorheriger Nachrichten im Thread
        user_stats: Statistiken über den Benutzer
        system_state: Aktueller System-State
    """
    user_handle: Optional[str] = None
    user_display_name: Optional[str] = None
    conversation_history: List[Dict[str, Any]] = field(default_factory=list)
    user_stats: Dict[str, Any] = field(default_factory=dict)
    system_state: Dict[str, Any] = field(default_factory=dict)


class CommandError(Exception):
    """Basisklasse für Command-spezifische Fehler."""
    pass
