"""
Command DSL Router

Routet geparste Commands zu ActionPlans.
Integriert mit Brand Matrix für Template-Auswahl und Parameter-Mapping.

Design:
ParsedCommand → Router → ActionPlan → WorkflowExecution

Der Router ist die zentrale Komponente, die entscheidet:
1. Welcher ActionType verwendet wird
2. Welches Template aus der Brand Matrix geladen wird
3. Wie Energy und Flavor gemappt werden
4. Welche Presets für Images verwendet werden
"""

from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass

from .schemas import ParsedCommand, ActionPlan, ActionType, Flavor, CommandName, CommandContext
from .errors import CommandValidationError, ErrorCatalog


@dataclass
class RouteResult:
    """Ergebnis des Routing-Vorgangs."""
    success: bool
    action_plan: Optional[ActionPlan] = None
    error: Optional[CommandValidationError] = None


class CommandRouter:
    """
    Routet Commands zu ActionPlans mit Brand Matrix Integration.

    Mapping:
    - /ask → text_generation
    - /img → image_generation
    - /remix → remix_generation
    - /badge → badge_status
    - /help → help

    Brand Matrix Integration:
    - Wählt template_key basierend auf Command und Kontext
    - Mapped energy (1-5) zu Brand Matrix energy
    - Mapped flavor zu Brand Matrix flavor
    - Enthält remix_of für Chain-Verfolgung

    Usage:
        router = CommandRouter(image_presets=preset_loader)
        result = router.route(parsed_command, context)
        if result.success:
            execute_workflow(result.action_plan)
    """

    # Template-Mapping für Brand Matrix
    COMMAND_TEMPLATES = {
        CommandName.ASK: "text_default",
        CommandName.IMG: "image_generation",
        CommandName.REMIX: "remix_dynamic",
        CommandName.BADGE: "badge_status",
        CommandName.HELP: "help_system",
    }

    # Energy-Mapping zu Brand Matrix
    DEFAULT_ENERGY = 3

    # Flavor-Mapping zu Brand Matrix
    DEFAULT_FLAVOR = Flavor.ZEN

    def __init__(
        self,
        image_presets: Optional[Any] = None,
        brand_matrix: Optional[Any] = None,
        custom_templates: Optional[Dict[str, str]] = None
    ):
        """
        Initialisiert den Router.

        Args:
            image_presets: ImagePresetLoader für Preset-Validierung
            brand_matrix: BrandMatrixClient für Template-Integration
            custom_templates: Optionale Custom Template-Overrides
        """
        self.image_presets = image_presets
        self.brand_matrix = brand_matrix
        self.templates = {**self.COMMAND_TEMPLATES, **(custom_templates or {})}

        # Handler-Registry
        self._handlers: Dict[CommandName, Callable] = {
            CommandName.ASK: self._route_ask,
            CommandName.IMG: self._route_img,
            CommandName.REMIX: self._route_remix,
            CommandName.BADGE: self._route_badge,
            CommandName.HELP: self._route_help,
        }

    def route(
        self,
        parsed: ParsedCommand,
        context: Optional[CommandContext] = None
    ) -> RouteResult:
        """
        Routet ein geparstes Command zu einem ActionPlan.

        Args:
            parsed: Das geparste Command
            context: Optionaler Command-Kontext

        Returns:
            RouteResult mit success, action_plan oder error
        """
        handler = self._handlers.get(parsed.name)

        if not handler:
            return RouteResult(
                success=False,
                error=ErrorCatalog.UNKNOWN_COMMAND(parsed.name.value)
            )

        return handler(parsed, context)

    def _route_ask(
        self,
        parsed: ParsedCommand,
        context: Optional[CommandContext]
    ) -> RouteResult:
        """
        Routet /ask Command.

        Mapped zu: text_generation
        Template: text_default
        """
        text = parsed.get_arg("text", "")

        # Energy aus Context oder Default
        energy = self._extract_energy(context)

        # Template-Auswahl
        template_key = self.templates[CommandName.ASK]

        action_plan = ActionPlan(
            action_type=ActionType.TEXT_GENERATION,
            template_key=template_key,
            energy=energy,
            flavor=self.DEFAULT_FLAVOR,
            prompt_text=text,
            parsed_command=parsed,
            metadata={
                "source": "ask_command",
                "user_id": parsed.user_id,
            }
        )

        return RouteResult(success=True, action_plan=action_plan)

    def _route_img(
        self,
        parsed: ParsedCommand,
        context: Optional[CommandContext]
    ) -> RouteResult:
        """
        Routet /img Command.

        Mapped zu: image_generation
        Template: image_generation

        Validiert Preset wenn angegeben.
        """
        preset_key = parsed.get_arg("preset")
        prompt = parsed.get_arg("prompt", "")

        # Preset validieren wenn vorhanden
        if preset_key and self.image_presets:
            if not self.image_presets.has_preset(preset_key):
                return RouteResult(
                    success=False,
                    error=ErrorCatalog.UNKNOWN_PRESET(preset_key)
                )

        # Energy aus Context oder Default
        energy = self._extract_energy(context)

        # Template-Auswahl
        template_key = self.templates[CommandName.IMG]

        action_plan = ActionPlan(
            action_type=ActionType.IMAGE_GENERATION,
            template_key=template_key,
            energy=energy,
            flavor=self.DEFAULT_FLAVOR,
            prompt_text=prompt,
            preset_key=preset_key,
            parsed_command=parsed,
            metadata={
                "source": "img_command",
                "user_id": parsed.user_id,
                "has_preset": preset_key is not None,
            }
        )

        return RouteResult(success=True, action_plan=action_plan)

    def _route_remix(
        self,
        parsed: ParsedCommand,
        context: Optional[CommandContext]
    ) -> RouteResult:
        """
        Routet /remix Command.

        Mapped zu: remix_generation
        Template: remix_dynamic

        Unterstützt remix_of für Chain-Verfolgung.
        """
        energy = parsed.get_arg("energy", self.DEFAULT_ENERGY)
        flavor_str = parsed.get_arg("flavor", self.DEFAULT_FLAVOR.value)

        try:
            flavor = Flavor(flavor_str)
        except ValueError:
            return RouteResult(
                success=False,
                error=ErrorCatalog.INVALID_FLAVOR(flavor_str)
            )

        # Template-Auswahl mit Flavor-Variante
        base_template = self.templates[CommandName.REMIX]
        template_key = f"{base_template}_{flavor.value}"

        action_plan = ActionPlan(
            action_type=ActionType.REMIX_GENERATION,
            template_key=template_key,
            energy=energy,
            flavor=flavor,
            prompt_text="",  # Wird aus remix_of geladen
            parsed_command=parsed,
            metadata={
                "source": "remix_command",
                "user_id": parsed.user_id,
                "remix_chain": True,
                "original_tweet_id": parsed.remix_of,
            }
        )

        return RouteResult(success=True, action_plan=action_plan)

    def _route_badge(
        self,
        parsed: ParsedCommand,
        context: Optional[CommandContext]
    ) -> RouteResult:
        """
        Routet /badge Command.

        Mapped zu: badge_status
        Template: badge_status
        """
        action_plan = ActionPlan(
            action_type=ActionType.BADGE_STATUS,
            template_key=self.templates[CommandName.BADGE],
            energy=self.DEFAULT_ENERGY,
            flavor=self.DEFAULT_FLAVOR,
            prompt_text="",
            parsed_command=parsed,
            metadata={
                "source": "badge_command",
                "user_id": parsed.user_id,
                "target": parsed.get_arg("target"),
            }
        )

        return RouteResult(success=True, action_plan=action_plan)

    def _route_help(
        self,
        parsed: ParsedCommand,
        context: Optional[CommandContext]
    ) -> RouteResult:
        """
        Routet /help Command.

        Mapped zu: help
        Template: help_system
        """
        topic = parsed.get_arg("topic")

        action_plan = ActionPlan(
            action_type=ActionType.HELP,
            template_key=self.templates[CommandName.HELP],
            energy=self.DEFAULT_ENERGY,
            flavor=self.DEFAULT_FLAVOR,
            prompt_text=topic or "general",
            parsed_command=parsed,
            metadata={
                "source": "help_command",
                "user_id": parsed.user_id,
                "topic": topic,
            }
        )

        return RouteResult(success=True, action_plan=action_plan)

    def _extract_energy(self, context: Optional[CommandContext]) -> int:
        """
        Extrahiert Energy-Level aus Context.

        Args:
            context: Command-Kontext

        Returns:
            Energy-Level (1-5)
        """
        if not context:
            return self.DEFAULT_ENERGY

        # Energy könnte aus User-Stats oder System-State kommen
        user_stats = context.user_stats
        if "energy" in user_stats:
            return max(1, min(5, int(user_stats["energy"])))

        return self.DEFAULT_ENERGY

    def get_template_for_command(self, command_name: str) -> Optional[str]:
        """
        Holt das Template für einen Command-Namen.

        Args:
            command_name: Name des Commands

        Returns:
            Template-Key oder None
        """
        try:
            cmd = CommandName(command_name)
            return self.templates.get(cmd)
        except ValueError:
            return None
