"""Drift detection using configurable thresholds."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .fingerprint_engine import Fingerprint
from .similarity_engine import SimilarityScores, compare_fingerprints


@dataclass
class DriftThresholds:
    """Thresholds for drift detection."""

    semantic_similarity_min: float = 0.80
    structure_similarity_min: float = 0.85
    style_similarity_min: float = 0.75
    length_delta_max: float = 0.35


@dataclass
class DriftResult:
    """Result of drift detection for a single test."""

    test_name: str
    drift_detected: bool
    drift_type: list[str]
    severity: Literal["low", "medium", "high"]
    scores: SimilarityScores | None = None


DEFAULT_THRESHOLDS = DriftThresholds()


def detect_drift(
    baseline: Fingerprint,
    current: Fingerprint,
    thresholds: DriftThresholds | None = None,
) -> DriftResult:
    """
    Compare baseline and current fingerprints; flag drift if any threshold exceeded.
    """
    th = thresholds or DEFAULT_THRESHOLDS
    scores = compare_fingerprints(baseline, current)

    drift_types: list[str] = []

    if scores.semantic_similarity < th.semantic_similarity_min:
        drift_types.append("semantic")
    if scores.structure_similarity < th.structure_similarity_min:
        drift_types.append("structure")
    if scores.style_similarity < th.style_similarity_min:
        drift_types.append("style")
    if scores.length_delta > th.length_delta_max:
        drift_types.append("length")

    drift_detected = len(drift_types) > 0

    # Severity: high if 3+ types or semantic+structure; medium if 2; low if 1
    if not drift_detected:
        severity: Literal["low", "medium", "high"] = "low"
    else:
        n = len(drift_types)
        has_semantic = "semantic" in drift_types
        has_structure = "structure" in drift_types

        if n >= 3 or (has_semantic and has_structure):
            severity = "high"
        elif n == 2:
            severity = "medium"
        else:
            severity = "low"

    return DriftResult(
        test_name=baseline.test_name,
        drift_detected=drift_detected,
        drift_type=drift_types,
        severity=severity,
        scores=scores,
    )
