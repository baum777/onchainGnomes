"""
Command DSL Error Handling

Benutzerfreundliche Fehlermeldungen für Command-Fehler.
Alle Fehler sind nicht-blockierend und produzieren hilfreiche Antworten.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class CommandValidationError:
    """
    Repräsentiert einen Validierungsfehler mit benutzerfreundlicher Nachricht.

    Diese Klasse wird verwendet statt Exceptions zu werfen,
    um den Workflow nicht zu unterbrechen.
    """
    error_code: str
    message: str
    suggestion: Optional[str] = None
    field: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Konvertiert zu Dictionary für Logging/Serialisierung."""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "suggestion": self.suggestion,
            "field": self.field,
        }

    def __str__(self) -> str:
        if self.suggestion:
            return f"{self.message} {self.suggestion}"
        return self.message


class ErrorCatalog:
    """
    Katalog aller möglichen Command-Fehler mit benutzerfreundlichen Nachrichten.

    Design-Philosophie:
    - Kurze, hilfreiche Nachrichten (Twitter-kompatibel)
    - Konkrete Vorschläge zur Problemlösung
    - Keine technischen Details oder Stacktraces
    """

    # Parser-Fehler
    UNKNOWN_COMMAND = lambda cmd: CommandValidationError(
        error_code="UNKNOWN_COMMAND",
        message=f"Unbekanntes Command: /{cmd}",
        suggestion="Verwende /help für verfügbare Commands."
    )

    MISSING_ARGUMENT = lambda arg: CommandValidationError(
        error_code="MISSING_ARGUMENT",
        message=f"Fehlendes Argument: {arg}",
        suggestion="Bitte gib den erforderlichen Parameter an."
    )

    INVALID_QUOTES = CommandValidationError(
        error_code="INVALID_QUOTES",
        message="Ungültige Anführungszeichen im Prompt.",
        suggestion='Verwende "doppelte" oder \'einfache\' Anführungszeichen.'
    )

    # Validierungsfehler
    INVALID_ENERGY = CommandValidationError(
        error_code="INVALID_ENERGY",
        message="Ungültiger Energie-Wert.",
        suggestion="Verwende einen Wert zwischen 1 und 5."
    )

    INVALID_FLAVOR = lambda flavor: CommandValidationError(
        error_code="INVALID_FLAVOR",
        message=f"Unbekannter Flavor: {flavor}",
        suggestion="Verfügbare Flavors: chaos, zen, glitch, ether, neon, vapor"
    )

    UNKNOWN_PRESET = lambda preset: CommandValidationError(
        error_code="UNKNOWN_PRESET",
        message=f"Unbekanntes Preset: {preset}",
        suggestion="Verwende /help für verfügbare Presets."
    )

    # State-Fehler
    REMIX_CHAIN_BROKEN = CommandValidationError(
        error_code="REMIX_CHAIN_BROKEN",
        message="Remix-Chain konnte nicht gefunden werden.",
        suggestion="Verwende /ask für neue Konversationen."
    )

    RATE_LIMITED = CommandValidationError(
        error_code="RATE_LIMITED",
        message="Zu viele Anfragen in kurzer Zeit.",
        suggestion="Bitte warte einen Moment vor der nächsten Anfrage."
    )

    # System-Fehler
    GENERATION_FAILED = CommandValidationError(
        error_code="GENERATION_FAILED",
        message="Generierung fehlgeschlagen.",
        suggestion="Bitte versuche es mit einem anderen Prompt erneut."
    )

    BADGE_SYSTEM_OFFLINE = CommandValidationError(
        error_code="BADGE_SYSTEM_OFFLINE",
        message="Badge-System ist noch nicht aktiviert.",
        suggestion="Bleib aktiv - Badges kommen bald!"
    )


class ErrorResponseBuilder:
    """
    Baut benutzerfreundliche Fehlerantworten.

    Alle Nachrichten sind für Twitter/X optimiert (kurz, hilfreich).
    """

    @staticmethod
    def build(error: CommandValidationError, include_prefix: bool = True) -> str:
        """
        Baut eine fehlerantwort.

        Args:
            error: Der Validierungsfehler
            include_prefix: Ob ein Präfix hinzugefügt werden soll

        Returns:
            Benutzerfreundliche Fehlermeldung
        """
        prefix = "⚠️ " if include_prefix else ""
        return f"{prefix}{error.message} {error.suggestion}".strip()

    @staticmethod
    def build_short(error: CommandValidationError) -> str:
        """
        Baut eine kurze Fehlermeldung für begrenzten Platz.

        Für Twitter/X wo Zeichen begrenzt sind.
        """
        return f"{error.message} {error.suggestion}".strip()

    @staticmethod
    def unknown_command(cmd: str) -> str:
        """Fehlermeldung für unbekanntes Command."""
        return ErrorResponseBuilder.build(ErrorCatalog.UNKNOWN_COMMAND(cmd))

    @staticmethod
    def invalid_energy() -> str:
        """Fehlermeldung für ungültigen Energie-Wert."""
        return ErrorResponseBuilder.build(ErrorCatalog.INVALID_ENERGY)

    @staticmethod
    def invalid_flavor(flavor: str) -> str:
        """Fehlermeldung für ungültigen Flavor."""
        return ErrorResponseBuilder.build(ErrorCatalog.INVALID_FLAVOR(flavor))

    @staticmethod
    def unknown_preset(preset: str) -> str:
        """Fehlermeldung für unbekanntes Preset."""
        return ErrorResponseBuilder.build(ErrorCatalog.UNKNOWN_PRESET(preset))

    @staticmethod
    def generation_failed() -> str:
        """Fehlermeldung für Generierungsfehler."""
        return ErrorResponseBuilder.build(ErrorCatalog.GENERATION_FAILED)

    @staticmethod
    def badge_offline() -> str:
        """Fehlermeldung für deaktiviertes Badge-System."""
        return ErrorResponseBuilder.build(ErrorCatalog.BADGE_SYSTEM_OFFLINE)
