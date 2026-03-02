# HORNY Meme Template Pack (Sharp + SVG)

Templates live in `memes/templates/*.yaml`.

Each template provides:
- `template_key`
- `base_style_prompt` (for your image generator upstream)
- `overlay_elements` (PNG overlays)
- `text_zones` (variant strings per zone)
- optional `roast_combos` (handcrafted combos)

Runtime flow:
1) Select template (rarity + dice)
2) Pick zone texts (dice or combo)
3) Compute placements via fit-to-box
4) Generate SVG overlay
5) Composite base image + overlays + SVG using sharp
