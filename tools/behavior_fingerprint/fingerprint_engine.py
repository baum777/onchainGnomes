"""LLM Behavior Fingerprinting - Deterministic signature generation from model responses."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Fingerprint:
    """Reproducible signature of model behavior."""

    test_name: str
    model: str
    timestamp: str

    semantic_hash: str
    structure_hash: str
    style_hash: str

    char_length: int
    token_estimate: int

    bullet_count: int
    json_keys: list[str]
    table_rows: int

    safety_flags: list[str]
    reasoning_steps: int

    # Optional extensions
    token_entropy_score: float | None = None
    sentence_length_variance: float | None = None
    markdown_structure_signature: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "test_name": self.test_name,
            "model": self.model,
            "timestamp": self.timestamp,
            "semantic_hash": self.semantic_hash,
            "structure_hash": self.structure_hash,
            "style_hash": self.style_hash,
            "char_length": self.char_length,
            "token_estimate": self.token_estimate,
            "bullet_count": self.bullet_count,
            "json_keys": self.json_keys,
            "table_rows": self.table_rows,
            "safety_flags": self.safety_flags,
            "reasoning_steps": self.reasoning_steps,
        }
        if self.token_entropy_score is not None:
            d["token_entropy_score"] = self.token_entropy_score
        if self.sentence_length_variance is not None:
            d["sentence_length_variance"] = self.sentence_length_variance
        if self.markdown_structure_signature is not None:
            d["markdown_structure_signature"] = self.markdown_structure_signature
        return d


def _normalize_text(text: str) -> str:
    """Normalize text for semantic hashing: lowercase, collapse whitespace."""
    if not text:
        return ""
    normalized = text.lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def _structure_skeleton(text: str) -> str:
    """Preserve formatting structure, remove content. Replace alphanumeric with placeholder."""
    if not text:
        return ""
    # Replace sequences of word characters with single X
    skeleton = re.sub(r"[a-zA-Z0-9]+", "X", text)
    # Preserve newlines, bullets, dashes, pipes, etc.
    skeleton = re.sub(r"\s+", "\n", skeleton)
    return skeleton


def _style_pattern(text: str) -> str:
    """Punctuation sequence + sentence length pattern for style fingerprint."""
    if not text:
        return ""
    # Extract punctuation (only punctuation marks)
    punct = "".join(c for c in text if c in ".,;:!?-()[]{}'\"")

    # Sentence lengths (words per sentence)
    sentences = re.split(r"[.!?]\s+", text)
    lengths = [len(s.split()) for s in sentences if s.strip()]

    pattern = f"p:{punct}|l:{','.join(map(str, lengths))}"
    return pattern


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def _count_bullets(text: str) -> int:
    """Count bullet points (- or * at line start)."""
    if not text:
        return 0
    lines = text.strip().split("\n")
    count = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("- ") or stripped.startswith("* "):
            count += 1
    return count


def _extract_json_keys(text: str) -> list[str]:
    """Extract top-level keys from JSON response if present."""
    keys: list[str] = []
    try:
        # Try to find JSON object in text
        start = text.find("{")
        if start >= 0:
            depth = 0
            for i, c in enumerate(text[start:], start):
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        obj_str = text[start : i + 1]
                        obj = json.loads(obj_str)
                        if isinstance(obj, dict):
                            keys = sorted(obj.keys())
                        break
    except (json.JSONDecodeError, ValueError):
        pass
    return keys


def _count_table_rows(text: str) -> int:
    """Count markdown table rows (lines with | separators)."""
    if not text:
        return 0
    lines = text.strip().split("\n")
    count = 0
    for line in lines:
        if "|" in line and line.strip().startswith("|"):
            # Skip separator row (|---|---|)
            if re.search(r"^[\s|:-]+$", line):
                continue
            count += 1
    return count


def _detect_safety_flags(text: str) -> list[str]:
    """Detect common safety-related patterns."""
    flags: list[str] = []
    lower = text.lower()

    refusal_phrases = ["can't", "cannot", "won't", "unable", "refuse", "cannot assist"]
    if any(p in lower for p in refusal_phrases):
        flags.append("refusal")

    uncertainty_phrases = ["i don't know", "uncertain", "not aware", "no information"]
    if any(p in lower for p in uncertainty_phrases):
        flags.append("uncertainty")

    # Hallucination guard: very short + hedged
    if len(text) < 50 and ("may" in lower or "might" in lower or "possibly" in lower):
        flags.append("hedged")

    return flags


def _count_reasoning_steps(text: str) -> int:
    """Estimate reasoning steps (numbered steps, 'step', 'therefore', etc.)."""
    if not text:
        return 0
    count = 0
    # Numbered steps: 1. 2. 3. or Step 1, Step 2
    numbered = re.findall(r"\b\d+[.)]\s", text)
    count += len(numbered)
    if count == 0:
        step_markers = re.findall(r"\b(?:step|therefore|thus|hence)\b", text, re.I)
        count = len(step_markers)
    return count


def _token_entropy_score(text: str) -> float:
    """Simple token diversity score: unique words / total words."""
    if not text:
        return 0.0
    words = re.findall(r"\b\w+\b", text.lower())
    if not words:
        return 0.0
    return len(set(words)) / len(words)


def _sentence_length_variance(text: str) -> float:
    """Variance of sentence lengths (words per sentence)."""
    if not text:
        return 0.0
    sentences = re.split(r"[.!?]\s+", text)
    lengths = [len(s.split()) for s in sentences if s.strip()]
    if len(lengths) < 2:
        return 0.0
    mean_len = sum(lengths) / len(lengths)
    variance = sum((x - mean_len) ** 2 for x in lengths) / len(lengths)
    return round(variance, 2)


def _markdown_structure_signature(text: str) -> str:
    """Signature of markdown structure: headers, lists, tables."""
    parts: list[str] = []
    lines = text.strip().split("\n")

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            level = len(re.match(r"^#+", stripped).group()) if re.match(r"^#+", stripped) else 0
            parts.append(f"h{level}")
        elif stripped.startswith("- ") or stripped.startswith("* "):
            parts.append("ul")
        elif re.match(r"^\d+\.", stripped):
            parts.append("ol")
        elif "|" in stripped and stripped.startswith("|"):
            if re.search(r"^[\s|:-]+$", stripped):
                parts.append("tb-sep")
            else:
                parts.append("tb")
        elif stripped == "":
            parts.append("br")
    return ".".join(parts) if parts else "plain"


def generate_fingerprint(
    test_name: str,
    model: str,
    response: str,
    timestamp: str = "",
) -> Fingerprint:
    """Generate a fingerprint for a single model response."""
    import datetime
    from datetime import timezone

    ts = timestamp or datetime.datetime.now(timezone.utc).isoformat()

    normalized = _normalize_text(response)
    semantic_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    skeleton = _structure_skeleton(response)
    structure_hash = hashlib.sha256(skeleton.encode("utf-8")).hexdigest()

    style = _style_pattern(response)
    style_hash = hashlib.sha256(style.encode("utf-8")).hexdigest()

    char_len = len(response)
    token_est = _estimate_tokens(response)
    bullet_count = _count_bullets(response)
    json_keys = _extract_json_keys(response)
    table_rows = _count_table_rows(response)
    safety_flags = _detect_safety_flags(response)
    reasoning_steps = _count_reasoning_steps(response)

    # Optional extensions
    entropy = _token_entropy_score(response)
    var = _sentence_length_variance(response)
    md_sig = _markdown_structure_signature(response) if response else ""

    return Fingerprint(
        test_name=test_name,
        model=model,
        timestamp=ts,
        semantic_hash=semantic_hash,
        structure_hash=structure_hash,
        style_hash=style_hash,
        char_length=char_len,
        token_estimate=token_est,
        bullet_count=bullet_count,
        json_keys=json_keys,
        table_rows=table_rows,
        safety_flags=safety_flags,
        reasoning_steps=reasoning_steps,
        token_entropy_score=round(entropy, 4),
        sentence_length_variance=var,
        markdown_structure_signature=md_sig or None,
    )
