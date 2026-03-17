# Codebase Audit — 2026-03-17

## Critical / runtime-breaking
- Legacy default safe gnome IDs referenced non-existent profiles (`gorky`, `grit`, `moss`) in active selection paths.
- Prompt fragment loader had hardcoded `gorky` fallback persona text.

## Config / deployment drift
- Env and schema defaults still used `GORKY_ON_SOL` prefixes and bot usernames.
- Render cron/service naming drifted from active identity.

## Docs / branding drift
- Root README and docs entrypoint used mixed/legacy branding and outdated defaults.

## Schema / typing drift
- `GnomeProfile` lacked typed support for actively used YAML fields (`tone`, lore gates/tags) and had weak runtime validation.

## Output-format / sigil missing
- No SSOT sigil model in gnome profiles.
- No deterministic post-render contract enforcing 1/2/3 voice sigil output at final publish stage.

## Already fixed / not open
- Historic `x-gnome-tokens.json` security issue previously fixed; no action required in this pass.
