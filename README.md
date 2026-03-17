# Gnomes

Gnomes is an autonomous X bot runtime that replies to mentions with a deterministic canonical pipeline, gnome voice routing, and strict safety/guardrail checks.

## Lore Summary

Gnomes is onchain-native, anti-hype, and practical: mythic framing, grounded claims, wealth-aware language, and no performative certainty.

## Voices

The voices are different perspectives from the same Gnomes world. Routing chooses a primary voice and optional cameo voices for composition; public replies are finalized with deterministic sigils.

## Features

- Canonical mention-processing pipeline
- Multi-voice routing with safe fallback chain
- Deterministic voice sigil rendering (1/2/3-voice contract)
- Guardrails for policy, postability, and budget
- Optional lore/memory/world extensions

## Project Structure

- `src/canonical`: classification, scoring, mode selection, generation flow
- `src/gnomes`: profile types, loader, registry, sigil helpers
- `src/output`: final public output formatting
- `data/gnomes`: SSOT YAML voice profiles
- `tests`: unit/integration/e2e coverage

## Setup

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm dev
```

## Config / Env

Primary runtime keys:

- `BOT_USERNAME` (default: `Gnomes_onchain`)
- `REDIS_KEY_PREFIX` (default: `GNOMES_ONCHAIN:`)
- `GNOMES_ENABLED`
- `DEFAULT_SAFE_GNOME` (default: `stillhalter`)

See `.env.example` and `.env.oauth2.example`.

## X OAuth / Runtime Notes

Use OAuth2 refresh flow (`X_REFRESH_TOKEN`) for runtime token renewal. `X_ACCESS_TOKEN` is optional and treated as transient fallback.

## Render Notes

`render.yaml` provides worker and cron defaults aligned with the Gnomes identity.

## Development Notes

- Keep gnome profile data in `data/gnomes/*.yaml` as SSOT.
- Avoid hardcoded legacy fallback IDs in runtime paths.
- Apply final formatting in output stage, not prompt-only.

## Docs

Start with `docs/README.md` and domain-specific docs under `docs/architecture`, `docs/operations`, and `docs/lore`.
