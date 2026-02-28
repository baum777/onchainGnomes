"""
Brand Matrix Integration Module

Erzeugt deterministische Payloads für die Brand Matrix nach v2-Contract.
"""

from .contract import BrandMatrixContract, MatrixPayload, MatrixVersion
from .classifier import MatrixClassifier
from .templates import TemplateRegistry, TemplateConfig, TemplateCategory

__all__ = [
    "BrandMatrixContract",
    "MatrixPayload",
    "MatrixVersion",
    "MatrixClassifier",
    "TemplateRegistry",
    "TemplateConfig",
    "TemplateCategory",
]
