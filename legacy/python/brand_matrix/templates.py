"""
Brand Matrix Templates

Template-Registry für Brand Matrix Integration.
Verwaltet verfügbare Templates und deren Konfiguration.
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum


class TemplateCategory(str, Enum):
    """Template-Kategorien."""
    TEXT = "text"
    IMAGE = "image"
    REMIX = "remix"
    SYSTEM = "system"


@dataclass
class TemplateConfig:
    """
    Konfiguration für ein Brand Matrix Template.

    Attributes:
        key: Eindeutiger Template-Schlüssel
        category: Template-Kategorie
        display_name: Anzeigename für UI
        description: Beschreibung des Templates
        default_energy: Standard-Energy für dieses Template
        supported_flavors: Liste unterstützter Flavors
        parameters: Zusätzliche Template-Parameter
    """
    key: str
    category: TemplateCategory
    display_name: str
    description: str = ""
    default_energy: int = 3
    supported_flavors: List[str] = field(default_factory=lambda: ["zen"])
    parameters: Dict[str, Any] = field(default_factory=dict)

    def supports_flavor(self, flavor: str) -> bool:
        """Prüft ob ein Flavor unterstützt wird."""
        return flavor in self.supported_flavors


class TemplateRegistry:
    """
    Registry für Brand Matrix Templates.

    Verwaltet alle verfügbaren Templates und bietet:
    - Template-Lookup nach Key
    - Template-Listen nach Kategorie
    - Validierung von Template-Keys

    Usage:
        registry = TemplateRegistry()
        config = registry.get("text_default")
        if config and config.supports_flavor("chaos"):
            use_template(config)
    """

    # Standard-Templates
    DEFAULT_TEMPLATES = {
        # Text Generation
        "text_default": TemplateConfig(
            key="text_default",
            category=TemplateCategory.TEXT,
            display_name="Standard Text",
            description="Standard-Template für Text-Generation",
            default_energy=3,
            supported_flavors=["zen", "chaos", "neon"],
        ),
        "text_technical": TemplateConfig(
            key="text_technical",
            category=TemplateCategory.TEXT,
            display_name="Technical",
            description="Technisches, präzises Text-Template",
            default_energy=2,
            supported_flavors=["zen", "ether"],
        ),
        "text_creative": TemplateConfig(
            key="text_creative",
            category=TemplateCategory.TEXT,
            display_name="Creative",
            description="Kreatives, ausdrucksstarkes Text-Template",
            default_energy=4,
            supported_flavors=["chaos", "glitch", "neon", "vapor"],
        ),

        # Image Generation
        "image_generation": TemplateConfig(
            key="image_generation",
            category=TemplateCategory.IMAGE,
            display_name="Image Gen",
            description="Standard-Template für Bild-Generation",
            default_energy=3,
            supported_flavors=["zen", "neon", "ether", "vapor"],
        ),
        "image_photorealistic": TemplateConfig(
            key="image_photorealistic",
            category=TemplateCategory.IMAGE,
            display_name="Photorealistic",
            description="Fotorealistisches Bild-Template",
            default_energy=4,
            supported_flavors=["zen", "ether"],
        ),
        "image_abstract": TemplateConfig(
            key="image_abstract",
            category=TemplateCategory.IMAGE,
            display_name="Abstract",
            description="Abstraktes, künstlerisches Bild-Template",
            default_energy=4,
            supported_flavors=["chaos", "glitch", "neon", "vapor"],
        ),

        # Remix Generation
        "remix_dynamic": TemplateConfig(
            key="remix_dynamic",
            category=TemplateCategory.REMIX,
            display_name="Dynamic Remix",
            description="Dynamisches Remix-Template",
            default_energy=4,
            supported_flavors=["chaos", "glitch", "neon", "zen", "ether", "vapor"],
        ),
        "remix_chaos": TemplateConfig(
            key="remix_chaos",
            category=TemplateCategory.REMIX,
            display_name="Chaos Remix",
            description="Chaotisches, transformierendes Remix",
            default_energy=5,
            supported_flavors=["chaos"],
        ),
        "remix_zen": TemplateConfig(
            key="remix_zen",
            category=TemplateCategory.REMIX,
            display_name="Zen Remix",
            description="Harmonisches, ausgewogenes Remix",
            default_energy=2,
            supported_flavors=["zen"],
        ),
        "remix_glitch": TemplateConfig(
            key="remix_glitch",
            category=TemplateCategory.REMIX,
            display_name="Glitch Remix",
            description="Glitch-artiges, verzerrtes Remix",
            default_energy=4,
            supported_flavors=["glitch"],
        ),
        "remix_neon": TemplateConfig(
            key="remix_neon",
            category=TemplateCategory.REMIX,
            display_name="Neon Remix",
            description="Neon-beleuchtetes, futuristisches Remix",
            default_energy=4,
            supported_flavors=["neon"],
        ),
        "remix_ether": TemplateConfig(
            key="remix_ether",
            category=TemplateCategory.REMIX,
            display_name="Ether Remix",
            description="Ätherisches, traumhaftes Remix",
            default_energy=3,
            supported_flavors=["ether"],
        ),
        "remix_vapor": TemplateConfig(
            key="remix_vapor",
            category=TemplateCategory.REMIX,
            display_name="Vapor Remix",
            description="Vaporwave-ästhetisches Remix",
            default_energy=3,
            supported_flavors=["vapor"],
        ),

        # System
        "badge_status": TemplateConfig(
            key="badge_status",
            category=TemplateCategory.SYSTEM,
            display_name="Badge Status",
            description="Template für Badge-Status-Anzeige",
            default_energy=1,
            supported_flavors=["zen"],
        ),
        "help_system": TemplateConfig(
            key="help_system",
            category=TemplateCategory.SYSTEM,
            display_name="Help System",
            description="Template für Hilfe-System",
            default_energy=1,
            supported_flavors=["zen"],
        ),
    }

    def __init__(self, custom_templates: Optional[Dict[str, TemplateConfig]] = None):
        """
        Initialisiert die Registry.

        Args:
            custom_templates: Optionale Custom Templates
        """
        self._templates: Dict[str, TemplateConfig] = {
            **self.DEFAULT_TEMPLATES,
            **(custom_templates or {}),
        }

    def get(self, key: str) -> Optional[TemplateConfig]:
        """
        Holt ein Template nach Key.

        Args:
            key: Template-Schlüssel

        Returns:
            TemplateConfig oder None
        """
        return self._templates.get(key)

    def has(self, key: str) -> bool:
        """
        Prüft ob ein Template existiert.

        Args:
            key: Template-Schlüssel

        Returns:
            True wenn Template existiert
        """
        return key in self._templates

    def list_by_category(self, category: TemplateCategory) -> List[TemplateConfig]:
        """
        Listet alle Templates einer Kategorie.

        Args:
            category: Zu filternde Kategorie

        Returns:
            Liste von TemplateConfigs
        """
        return [
            template for template in self._templates.values()
            if template.category == category
        ]

    def list_all(self) -> List[TemplateConfig]:
        """
        Listet alle verfügbaren Templates.

        Returns:
            Liste aller TemplateConfigs
        """
        return list(self._templates.values())

    def get_for_flavor(self, flavor: str) -> List[TemplateConfig]:
        """
        Findet Templates die einen Flavor unterstützen.

        Args:
            flavor: Zu prüfender Flavor

        Returns:
            Liste kompatibler Templates
        """
        return [
            template for template in self._templates.values()
            if template.supports_flavor(flavor)
        ]

    def register(self, config: TemplateConfig) -> None:
        """
        Registriert ein neues Template.

        Args:
            config: TemplateConfig zum Registrieren
        """
        self._templates[config.key] = config

    def remove(self, key: str) -> bool:
        """
        Entfernt ein Template.

        Args:
            key: Zu entfernender Template-Key

        Returns:
            True wenn entfernt, False wenn nicht existiert
        """
        if key in self._templates:
            del self._templates[key]
            return True
        return False

    def validate_key(self, key: str, flavor: Optional[str] = None) -> bool:
        """
        Validiert einen Template-Key und optional den Flavor.

        Args:
            key: Zu validierender Template-Key
            flavor: Optional - zu prüfender Flavor

        Returns:
            True wenn valide
        """
        template = self.get(key)
        if not template:
            return False

        if flavor and not template.supports_flavor(flavor):
            return False

        return True

    def get_default_for_action(self, action_type: str) -> Optional[TemplateConfig]:
        """
        Holt das Default-Template für einen ActionType.

        Args:
            action_type: ActionType-Wert

        Returns:
            Default TemplateConfig oder None
        """
        defaults = {
            "text_generation": "text_default",
            "image_generation": "image_generation",
            "remix_generation": "remix_dynamic",
            "badge_status": "badge_status",
            "help": "help_system",
        }

        key = defaults.get(action_type)
        if key:
            return self.get(key)

        return None
