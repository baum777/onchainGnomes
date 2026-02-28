"""YAML-driven template text picker with deterministic seeded selection."""

from dataclasses import dataclass
from typing import Dict, Optional

from .template_loader import MemeTemplate
from .seed import mulberry32, seed_from_string


@dataclass
class PickedTemplateText:
    """Result of picking template text."""

    text_by_zone: Dict[str, str]
    used_combo: bool


@dataclass
class PickTemplateTextArgs:
    """Arguments for picking template text."""

    template: MemeTemplate
    seed_key: str  # Deterministic key (tweet/mention/event id)
    combo_chance: float = 0.15  # Chance to use a roast_combo (default 15%)
    zone_overrides: Optional[Dict[str, str]] = None  # Force specific zone values


def pick_template_text(args: PickTemplateTextArgs) -> PickedTemplateText:
    """
    Deterministically picks either:
    - A roast_combo (zone overrides) OR
    - Random values per zone from template.text_zones

    Uses mulberry32 PRNG seeded with 'template:template_key:seed_key'.

    Args:
        args: PickTemplateTextArgs with template, seed_key, combo_chance, zone_overrides

    Returns:
        PickedTemplateText with text_by_zone and used_combo flag

    Raises:
        ValueError: If the template has no text zones defined
    """
    combo_chance = args.combo_chance if args.combo_chance is not None else 0.15

    # Create deterministic seed
    seed = seed_from_string(f"template:{args.template.template_key}:{args.seed_key}")
    rng = mulberry32(seed)

    text_by_zone: Dict[str, str] = {}
    used_combo = False

    # 1) Maybe use a combo
    combos = args.template.roast_combos
    use_combo = len(combos) > 0 and rng() < combo_chance

    if use_combo:
        idx = int(rng() * len(combos))
        idx = max(0, min(len(combos) - 1, idx))
        combo = combos[idx]
        for k, v in combo.items():
            if isinstance(v, str) and v.strip():
                text_by_zone[k] = v.strip()
        used_combo = True

    # 2) Fill remaining zones from banks (or all zones if no combo)
    for zone, options in args.template.text_zones.items():
        if zone in text_by_zone:
            continue  # Already filled by combo
        if not isinstance(options, list) or len(options) == 0:
            continue

        j = int(rng() * len(options))
        j = max(0, min(len(options) - 1, j))
        picked = str(options[j]).strip()
        if picked:
            text_by_zone[zone] = picked

    # 3) Apply explicit overrides last (highest priority)
    if args.zone_overrides:
        for k, v in args.zone_overrides.items():
            if isinstance(v, str) and v.strip():
                text_by_zone[k] = v.strip()

    return PickedTemplateText(text_by_zone=text_by_zone, used_combo=used_combo)
