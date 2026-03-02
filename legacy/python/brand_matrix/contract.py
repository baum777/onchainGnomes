"""
Brand Matrix Contract v2

Definiert den deterministischen Contract für Brand Matrix Payloads.
Alle Outputs müssen diesem Contract folgen für v2-Kompatibilität.

v2 Contract Format:
{
    "user_prompt": str,
    "energy": int (1-5),
    "flavor": str (enum),
    "template_key": str,
    "remix_of": Optional[str],
    "preview_request_id": Optional[str],
    "metadata": dict
}
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum


class MatrixVersion(str, Enum):
    """Unterstützte Matrix-Versionen."""
    V1 = "v1"
    V2 = "v2"


@dataclass
class MatrixPayload:
    """
    Brand Matrix Payload nach v2-Contract.

    Dies ist das zentrale Datenmodell für alle Brand Matrix Interaktionen.
    Jeder Command wird in ein MatrixPayload umgewandelt vor der Generation.

    Attributes:
        user_prompt: Der vom Benutzer bereinigte Prompt
        energy: Energie-Level (1-5) für Generation-Stärke
        flavor: Stilrichtung der Generation
        template_key: Schlüssel für das zu verwendende Template
        remix_of: Optional - Referenz zu vorherigem Tweet für Remix
        preview_request_id: Optional - Tracking ID für Preview
        metadata: Zusätzliche Metadaten für die Generation
        version: Matrix-Version (default: v2)
    """
    user_prompt: str
    template_key: str
    energy: int = 3
    flavor: str = "zen"
    remix_of: Optional[str] = None
    preview_request_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    version: MatrixVersion = MatrixVersion.V2

    def __post_init__(self):
        """Validiert die Felder nach Initialisierung."""
        if not self.user_prompt:
            raise ValueError("user_prompt darf nicht leer sein")

        if not 1 <= self.energy <= 5:
            raise ValueError(f"energy muss zwischen 1 und 5 sein, war {self.energy}")

        if not self.template_key:
            raise ValueError("template_key darf nicht leer sein")

    def to_dict(self) -> Dict[str, Any]:
        """
        Konvertiert Payload zu Dictionary für API-Requests.

        Returns:
            Dictionary im v2-Contract Format
        """
        return {
            "user_prompt": self.user_prompt,
            "energy": self.energy,
            "flavor": self.flavor,
            "template_key": self.template_key,
            "remix_of": self.remix_of,
            "preview_request_id": self.preview_request_id,
            "metadata": self.metadata,
            "version": self.version.value,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MatrixPayload":
        """
        Erzeugt Payload aus Dictionary.

        Args:
            data: Dictionary mit Payload-Daten

        Returns:
            MatrixPayload Instanz
        """
        return cls(
            user_prompt=data.get("user_prompt", ""),
            template_key=data.get("template_key", "default"),
            energy=data.get("energy", 3),
            flavor=data.get("flavor", "zen"),
            remix_of=data.get("remix_of"),
            preview_request_id=data.get("preview_request_id"),
            metadata=data.get("metadata", {}),
            version=MatrixVersion(data.get("version", "v2")),
        )

    def with_remix(self, original_tweet_id: str) -> "MatrixPayload":
        """
        Erzeugt eine Kopie mit Remix-Referenz.

        Args:
            original_tweet_id: ID des zu remixenden Tweets

        Returns:
            Neue MatrixPayload mit remix_of gesetzt
        """
        return MatrixPayload(
            user_prompt=self.user_prompt,
            template_key=self.template_key,
            energy=self.energy,
            flavor=self.flavor,
            remix_of=original_tweet_id,
            preview_request_id=self.preview_request_id,
            metadata={**self.metadata, "is_remix": True},
            version=self.version,
        )


class BrandMatrixContract:
    """
    Contract-Validator für Brand Matrix Payloads.

    Stellt sicher, dass alle Payloads dem v2-Contract entsprechen.
    Zentraler Einstiegspunkt für Brand Matrix Integration.

    Usage:
        contract = BrandMatrixContract()
        payload = contract.build_payload(action_plan)
        if contract.validate(payload):
            send_to_matrix(payload)
    """

    # Pflichtfelder für v2
    REQUIRED_FIELDS = ["user_prompt", "energy", "flavor", "template_key"]

    # Gültige Flavor-Werte
    VALID_FLAVORS = {"chaos", "zen", "glitch", "ether", "neon", "vapor"}

    def __init__(self, version: MatrixVersion = MatrixVersion.V2):
        """
        Initialisiert den Contract.

        Args:
            version: Die zu verwendende Matrix-Version
        """
        self.version = version

    def build_payload(
        self,
        user_prompt: str,
        template_key: str,
        energy: int = 3,
        flavor: str = "zen",
        remix_of: Optional[str] = None,
        preview_request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> MatrixPayload:
        """
        Baut ein MatrixPayload aus einzelnen Parametern.

        Args:
            user_prompt: Der Benutzer-Prompt
            template_key: Template-Schlüssel
            energy: Energie-Level (1-5)
            flavor: Stilrichtung
            remix_of: Optional - Remix-Referenz
            preview_request_id: Optional - Preview ID
            metadata: Optional - Zusätzliche Metadaten

        Returns:
            Validiertes MatrixPayload
        """
        return MatrixPayload(
            user_prompt=user_prompt,
            template_key=template_key,
            energy=energy,
            flavor=flavor,
            remix_of=remix_of,
            preview_request_id=preview_request_id,
            metadata=metadata or {},
            version=self.version,
        )

    def validate(self, payload: MatrixPayload) -> bool:
        """
        Validiert ein Payload gegen den Contract.

        Args:
            payload: Zu validierendes Payload

        Returns:
            True wenn valide, sonst False
        """
        try:
            # Pflichtfelder prüfen
            if not payload.user_prompt:
                return False

            if not payload.template_key:
                return False

            # Energy-Bereich prüfen
            if not 1 <= payload.energy <= 5:
                return False

            # Flavor validieren
            if payload.flavor not in self.VALID_FLAVORS:
                return False

            return True
        except (AttributeError, TypeError):
            return False

    def validate_dict(self, data: Dict[str, Any]) -> bool:
        """
        Validiert ein Dictionary gegen den Contract.

        Args:
            data: Zu validierendes Dictionary

        Returns:
            True wenn valide, sonst False
        """
        try:
            # Pflichtfelder prüfen
            for field in self.REQUIRED_FIELDS:
                if field not in data or not data[field]:
                    return False

            # Energy-Bereich prüfen
            energy = data.get("energy", 3)
            if not isinstance(energy, int) or not 1 <= energy <= 5:
                return False

            # Flavor validieren
            flavor = data.get("flavor", "zen")
            if flavor not in self.VALID_FLAVORS:
                return False

            return True
        except (AttributeError, TypeError, ValueError):
            return False

    def get_validation_errors(self, data: Dict[str, Any]) -> list:
        """
        Gibt detaillierte Validierungsfehler zurück.

        Args:
            data: Zu validierendes Dictionary

        Returns:
            Liste von Fehler-Strings
        """
        errors = []

        for field in self.REQUIRED_FIELDS:
            if field not in data or not data[field]:
                errors.append(f"Fehlendes Pflichtfeld: {field}")

        if "energy" in data:
            energy = data["energy"]
            if not isinstance(energy, int):
                errors.append(f"energy muss eine Ganzzahl sein, war {type(energy)}")
            elif not 1 <= energy <= 5:
                errors.append(f"energy muss zwischen 1 und 5 sein, war {energy}")

        if "flavor" in data:
            flavor = data["flavor"]
            if flavor not in self.VALID_FLAVORS:
                errors.append(f"Ungültiger flavor: {flavor}. Gültig: {self.VALID_FLAVORS}")

        return errors
