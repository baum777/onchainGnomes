"""
Brand Matrix Integration Module

Erzeugt deterministische Payloads für die Brand Matrix nach v2-Contract.
"""

from .contract import BrandMatrixContract, MatrixPayload, MatrixVersion
from .classifier import MatrixClassifier
from .templates import TemplateRegistry, TemplateConfig, TemplateCategory
from .humor_mode_selector import HumorModeSelector, MODES
from .prompt_composer import GorkyPromptComposer

__all__ = [
    "BrandMatrixContract",
    "MatrixPayload",
    "MatrixVersion",
    "MatrixClassifier",
    "TemplateRegistry",
    "TemplateConfig",
    "TemplateCategory",
    "HumorModeSelector",
    "MODES",
    "GorkyPromptComposer",
]
