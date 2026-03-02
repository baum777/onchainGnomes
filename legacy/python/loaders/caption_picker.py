"""Caption picker with deterministic seeded selection."""

from dataclasses import dataclass
from typing import Optional

from .dataset_loader import DatasetLoader, DatasetKey
from .seed import mulberry32, seed_from_string


@dataclass
class PickCaptionArgs:
    """Arguments for picking a caption."""

    dataset_loader: DatasetLoader
    bank: Optional[str] = None
    seed_key: str = ""
    rules: Optional[list] = None


def normalize_bank(bank: Optional[str]) -> DatasetKey:
    """Normalize bank name to a valid DatasetKey."""
    b = (bank or "captions").strip().lower()
    if b == "captions":
        return "captions"
    if b == "example_tweets":
        return "example_tweets"
    if b == "roast_replies":
        return "roast_replies"
    return "captions"


def pick_caption(args: PickCaptionArgs) -> str:
    """
    Deterministically pick a caption from a dataset.

    Uses mulberry32 PRNG seeded with 'bank:seed_key' for reproducible results.

    Args:
        args: PickCaptionArgs with dataset_loader, bank, and seed_key

    Returns:
        Selected caption string
    """
    key = normalize_bank(args.bank)
    lines = args.dataset_loader.load(key)

    seed = seed_from_string(f"{key}:{args.seed_key}")
    rng = mulberry32(seed)

    idx = int(rng() * len(lines))
    idx = max(0, min(len(lines) - 1, idx))

    picked = lines[idx]

    if args.rules:
        for rule in args.rules:
            if rule == "short" and len(picked) > 280:
                for _ in range(min(10, len(lines))):
                    idx = int(rng() * len(lines))
                    candidate = lines[max(0, min(len(lines) - 1, idx))]
                    if len(candidate) <= 280:
                        return candidate

    return picked
