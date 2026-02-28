"""
Tests für Brand Matrix Integration

Validiert:
- Contract-Validierung
- Klassifizierung
- Payload-Generierung
"""

import pytest
from src.brand_matrix.contract import BrandMatrixContract, MatrixPayload, MatrixVersion
from src.brand_matrix.classifier import MatrixClassifier, ClassificationResult
from src.brand_matrix.templates import TemplateRegistry, TemplateConfig, TemplateCategory
from src.commands.schemas import ActionPlan, ActionType, Flavor, ParsedCommand, CommandName


class TestMatrixPayload:
    """Test-Suite für MatrixPayload."""

    def test_create_payload(self):
        """Testet Payload-Erstellung."""
        payload = MatrixPayload(
            user_prompt="Test prompt",
            template_key="text_default",
            energy=3,
            flavor="zen"
        )

        assert payload.user_prompt == "Test prompt"
        assert payload.template_key == "text_default"
        assert payload.energy == 3
        assert payload.flavor == "zen"

    def test_validation_empty_prompt(self):
        """Testet Validierung leerer Prompt."""
        with pytest.raises(ValueError, match="user_prompt"):
            MatrixPayload(
                user_prompt="",
                template_key="text_default"
            )

    def test_validation_energy_range(self):
        """Testet Validierung Energy-Bereich."""
        with pytest.raises(ValueError, match="energy"):
            MatrixPayload(
                user_prompt="Test",
                template_key="text_default",
                energy=10
            )

    def test_to_dict(self):
        """Testet Dictionary-Konvertierung."""
        payload = MatrixPayload(
            user_prompt="Test",
            template_key="text_default",
            energy=4,
            flavor="chaos",
            remix_of="tweet123"
        )

        data = payload.to_dict()
        assert data["user_prompt"] == "Test"
        assert data["energy"] == 4
        assert data["flavor"] == "chaos"
        assert data["remix_of"] == "tweet123"
        assert data["version"] == "v2"

    def test_from_dict(self):
        """Testet Erstellung aus Dictionary."""
        data = {
            "user_prompt": "Test",
            "template_key": "text_default",
            "energy": 3,
            "flavor": "zen",
            "version": "v2"
        }

        payload = MatrixPayload.from_dict(data)
        assert payload.user_prompt == "Test"
        assert payload.energy == 3

    def test_with_remix(self):
        """Testet Remix-Erstellung."""
        original = MatrixPayload(
            user_prompt="Original",
            template_key="text_default",
            energy=3
        )

        remix = original.with_remix("tweet789")
        assert remix.remix_of == "tweet789"
        assert remix.user_prompt == "Original"
        assert remix.metadata["is_remix"] is True


class TestBrandMatrixContract:
    """Test-Suite für BrandMatrixContract."""

    @pytest.fixture
    def contract(self):
        return BrandMatrixContract()

    def test_build_payload(self, contract):
        """Testet Payload-Building."""
        payload = contract.build_payload(
            user_prompt="Test",
            template_key="text_default",
            energy=3,
            flavor="zen"
        )

        assert isinstance(payload, MatrixPayload)
        assert payload.user_prompt == "Test"

    def test_validate_valid(self, contract):
        """Testet Validierung gültiger Payloads."""
        payload = MatrixPayload(
            user_prompt="Test",
            template_key="text_default",
            energy=3,
            flavor="zen"
        )

        assert contract.validate(payload) is True

    def test_validate_invalid_energy(self, contract):
        """Testet Validierung ungültiger Energy."""
        payload = MatrixPayload(
            user_prompt="Test",
            template_key="text_default",
            energy=10,
            flavor="zen"
        )

        assert contract.validate(payload) is False

    def test_validate_invalid_flavor(self, contract):
        """Testet Validierung ungültiger Flavor."""
        payload = MatrixPayload(
            user_prompt="Test",
            template_key="text_default",
            energy=3,
            flavor="invalid"
        )

        assert contract.validate(payload) is False

    def test_validate_dict(self, contract):
        """Testet Dictionary-Validierung."""
        valid = {
            "user_prompt": "Test",
            "template_key": "text_default",
            "energy": 3,
            "flavor": "zen"
        }

        assert contract.validate_dict(valid) is True

    def test_get_validation_errors(self, contract):
        """Testet Fehler-Details."""
        invalid = {
            "user_prompt": "",
            "energy": 10,
            "flavor": "invalid"
        }

        errors = contract.get_validation_errors(invalid)
        assert len(errors) > 0


class TestMatrixClassifier:
    """Test-Suite für MatrixClassifier."""

    @pytest.fixture
    def classifier(self):
        return MatrixClassifier()

    @pytest.fixture
    def sample_action_plan(self):
        return ActionPlan(
            action_type=ActionType.TEXT_GENERATION,
            template_key="text_default",
            energy=3,
            flavor=Flavor.ZEN,
            prompt_text="Test prompt"
        )

    def test_classify_success(self, classifier, sample_action_plan):
        """Testet erfolgreiche Klassifizierung."""
        result = classifier.classify(sample_action_plan)

        assert result.success is True
        assert result.payload is not None
        assert result.payload.user_prompt == "Test prompt"

    def test_classify_includes_humor_mode(self, classifier, sample_action_plan):
        """Testet dass humor_mode in Metadata enthalten ist."""
        result = classifier.classify(sample_action_plan)

        assert result.success is True
        assert "humor_mode" in result.payload.metadata
        assert result.payload.metadata["humor_mode"] in (
            "authority", "scientist", "therapist", "reality", "goblin", "rhyme_override"
        )

    def test_classify_error(self, classifier):
        """Testet Fehlerbehandlung."""
        invalid_plan = ActionPlan(
            action_type=ActionType.TEXT_GENERATION,
            template_key="",
            energy=3,
            flavor=Flavor.ZEN,
            prompt_text="Test"
        )

        result = classifier.classify(invalid_plan)
        assert result.success is False
        assert result.error is not None

    def test_calculate_energy(self, classifier):
        """Testet Energy-Berechnung."""
        plan = ActionPlan(
            action_type=ActionType.REMIX_GENERATION,
            template_key="remix",
            energy=4,
            flavor=Flavor.CHAOS,  # 1.2x multiplier
            prompt_text="Test"
        )

        result = classifier.classify(plan)
        assert result.success is True
        # Energy 4 * 1.2 = 4.8 -> capped to 5
        assert result.payload.energy <= 5


class TestTemplateRegistry:
    """Test-Suite für TemplateRegistry."""

    @pytest.fixture
    def registry(self):
        return TemplateRegistry()

    def test_get_template(self, registry):
        """Testet Template-Abfrage."""
        template = registry.get("text_default")

        assert template is not None
        assert template.key == "text_default"

    def test_has_template(self, registry):
        """Testet Existenz-Prüfung."""
        assert registry.has("text_default") is True
        assert registry.has("nonexistent") is False

    def test_list_by_category(self, registry):
        """Testet Kategorie-Filterung."""
        text_templates = registry.list_by_category(TemplateCategory.TEXT)

        assert len(text_templates) > 0
        for template in text_templates:
            assert template.category == TemplateCategory.TEXT

    def test_validate_key(self, registry):
        """Testet Key-Validierung."""
        assert registry.validate_key("text_default") is True
        assert registry.validate_key("text_default", "zen") is True
        assert registry.validate_key("text_default", "chaos") is True
        assert registry.validate_key("nonexistent") is False

    def test_register_template(self, registry):
        """Testet Template-Registrierung."""
        new_template = TemplateConfig(
            key="custom_template",
            category=TemplateCategory.TEXT,
            display_name="Custom"
        )

        registry.register(new_template)
        assert registry.has("custom_template")

    def test_get_default_for_action(self, registry):
        """Testet Default-Template-Abfrage."""
        template = registry.get_default_for_action("text_generation")

        assert template is not None
        assert template.category == TemplateCategory.TEXT


class TestBrandMatrixIntegration:
    """Integration-Tests für Brand Matrix."""

    def test_full_flow(self):
        """Testet kompletten Flow von ActionPlan zu Payload."""
        # Create ActionPlan
        parsed = ParsedCommand(
            name=CommandName.ASK,
            args={"text": "Hello world"},
            user_id="123"
        )

        plan = ActionPlan(
            action_type=ActionType.TEXT_GENERATION,
            template_key="text_default",
            energy=3,
            flavor=Flavor.ZEN,
            prompt_text="Hello world",
            parsed_command=parsed
        )

        # Classify
        classifier = MatrixClassifier()
        result = classifier.classify(plan)

        assert result.success is True
        assert result.payload.user_prompt == "Hello world"
        assert result.payload.to_matrix_payload()["action_type"] == "text_generation"

    def test_matrix_payload_contract(self):
        """Testet v2 Contract-Konformität."""
        payload = MatrixPayload(
            user_prompt="Test",
            template_key="text_default",
            energy=3,
            flavor="zen"
        )

        contract = BrandMatrixContract()
        assert contract.validate(payload)

        data = payload.to_dict()
        assert "user_prompt" in data
        assert "energy" in data
        assert "flavor" in data
        assert "template_key" in data
        assert "version" in data
