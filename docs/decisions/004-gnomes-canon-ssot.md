# 004 — GNOMES Canon SSOT

## Status
Accepted

## Context
GNOMES extension required a strict separation between human canon, runtime profiles, prompt voice fragments, and retrieval units.

## Decision
- Adopt `docs/lore/GNOMES_MATRIX.md` as GNOMES canon SSOT.
- Keep runtime in `data/gnomes/*.yaml` and prompt voice in `prompts/fragments/gnomes/*.md`.
- Keep retrieval units in `memory/lore/*` with status gates.
- Preserve existing joinpoints (`gnomeSelector`, `composeGnomePrompt`, shared/global fragments).

## Consequences
- Minimal-invasive runtime integration.
- Controlled growth (`candidate -> approved -> active`).
- Reduced voice drift and role confusion risk.
