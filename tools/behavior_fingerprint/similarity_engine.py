"""Compare fingerprints and compute similarity scores."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

from .fingerprint_engine import Fingerprint


@dataclass
class SimilarityScores:
    """Similarity comparison result between two fingerprints."""

    semantic_similarity: float
    structure_similarity: float
    style_similarity: float
    length_delta: float

    def to_dict(self) -> dict[str, float]:
        return {
            "semantic_similarity": self.semantic_similarity,
            "structure_similarity": self.structure_similarity,
            "style_similarity": self.style_similarity,
            "length_delta": self.length_delta,
        }


def _hash_similarity(hash_a: str, hash_b: str) -> float:
    """Binary: exact match = 1.0, else 0.0. Hashes are deterministic."""
    return 1.0 if hash_a == hash_b else 0.0


def _length_delta(char_a: int, char_b: int) -> float:
    """Relative length difference: 0 = identical, 1 = one is double the other."""
    if char_a == 0 and char_b == 0:
        return 0.0
    if char_a == 0 or char_b == 0:
        return 1.0
    max_len = max(char_a, char_b)
    min_len = min(char_a, char_b)
    return (max_len - min_len) / max_len


def compare_fingerprints(baseline: Fingerprint, current: Fingerprint) -> SimilarityScores:
    """
    Compare two fingerprints.

    Uses hash equality as primary signal; when hashes differ, computes
    proxy scores via set overlap (json_keys), length comparison, and
    structural feature alignment.
    """
    # Semantic: hash match = 1.0; else use structural overlap as proxy
    semantic_sim = _hash_similarity(baseline.semantic_hash, current.semantic_hash)
    if semantic_sim < 1.0:
        keys_base = set(baseline.json_keys)
        keys_curr = set(current.json_keys)
        keys_overlap = (
            len(keys_base & keys_curr) / len(keys_base | keys_curr)
            if (keys_base or keys_curr)
            else 1.0
        )
        bullet_ok = 1.0 if baseline.bullet_count == current.bullet_count else 0.5
        table_max = max(1, baseline.table_rows, current.table_rows)
        table_sim = 1.0 - min(1.0, abs(baseline.table_rows - current.table_rows) / table_max)
        semantic_sim = 0.4 * keys_overlap + 0.3 * bullet_ok + 0.3 * table_sim

    # Structure: hash match = 1.0; else formatting alignment
    structure_sim = _hash_similarity(baseline.structure_hash, current.structure_hash)
    if structure_sim < 1.0:
        bullet_ok = 1.0 if baseline.bullet_count == current.bullet_count else 0.0
        table_ok = 1.0 if baseline.table_rows == current.table_rows else 0.0
        md_base = baseline.markdown_structure_signature or ""
        md_curr = current.markdown_structure_signature or ""
        md_match = 1.0 if md_base == md_curr else (0.5 if md_base and md_curr else 0.6)
        structure_sim = (bullet_ok + table_ok + md_match) / 3 if (bullet_ok or table_ok or md_base or md_curr) else 0.6

    # Style: hash match = 1.0; else variance + reasoning alignment
    style_sim = _hash_similarity(baseline.style_hash, current.style_hash)
    if style_sim < 1.0:
        var_base = baseline.sentence_length_variance or 0
        var_curr = current.sentence_length_variance or 0
        denom = max(1, var_base + var_curr)
        var_sim = 1.0 - min(1.0, abs(var_base - var_curr) / denom)
        reason_match = 1.0 if baseline.reasoning_steps == current.reasoning_steps else 0.6
        style_sim = 0.5 * var_sim + 0.5 * reason_match

    length_d = _length_delta(baseline.char_length, current.char_length)

    return SimilarityScores(
        semantic_similarity=round(semantic_sim, 4),
        structure_similarity=round(structure_sim, 4),
        style_similarity=round(style_sim, 4),
        length_delta=round(length_d, 4),
    )


def compare_texts_semantic(text_a: str, text_b: str) -> float:
    """Use SequenceMatcher for raw text semantic similarity (when original text is available)."""
    if not text_a and not text_b:
        return 1.0
    if not text_a or not text_b:
        return 0.0
    return round(SequenceMatcher(None, text_a, text_b).ratio(), 4)
