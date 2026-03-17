# Gnomes

**GNOMES** is a repo-native lore, persona, and voice system for grounded, anti-hype, treasury-minded CT/X posting behavior.

It uses earth-bound gnome mythology as an operational framework for differentiated output modes under noise and volatility.

## GNOMES at a Glance

- **Lore-backed:** canonized symbolic world logic, not decorative fantasy
- **Persona-driven:** seven role archetypes with clear anti-drift boundaries
- **Voice-disciplined:** role-separable writing styles with explicit forbidden patterns
- **Runtime-addressable:** profile-driven role selection via `data/gnomes/*.yaml`
- **Retrieval-friendly:** lore and persona units designed for controlled injection

> **GNOMES = earth-bound personas for signal, stability, and disciplined voice under chaotic conditions.**

## Practical framing

GNOMES turns earth-bound folklore into an operational CT/X persona matrix built around stillness, reserves, signal-reading, discipline, systems-building, memetic camouflage, and controlled force.

It is designed to be:

- canonically documented
- runtime-addressable
- prompt-composable
- retrieval-friendly
- safe against tone drift

## Features

- 4-layer persona-memory architecture with reflection gates

- Canonical mention-processing pipeline
- Multi-voice routing with safe fallback chain
- Deterministic voice sigil rendering (1/2/3-voice contract)
- Guardrails for policy, postability, and budget
- Optional lore/memory/world extensions


## Persona Memory Architecture

The runtime uses a 4-layer persona memory stack:
- **Core Persona** (`data/gnomes/*.yaml`) stays canonical and curated.
- **Semantic Persona** is compiler-derived for retrieval and routing support.
- **Episodic Memory** stores interaction episodes with quality signals.
- **Reflective Curation** gates retention/promotion to prevent drift.

Use `pnpm persona:build-semantic` to compile YAML profiles into semantic records.

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

## LLM Provider Configuration

The runtime supports **xAI (default)**, **OpenAI**, and **Anthropic** behind one internal `LLMClient` contract. Canonical pipeline, prompt builder, and persona routing stay provider-agnostic.

### Provider selection

- `LLM_PROVIDER` selects the primary provider: `xai | openai | anthropic`
- `LLM_FALLBACK_PROVIDER` is optional and used only for retryable/transient LLM failures (e.g. 429/5xx/timeout)
- Auth/policy errors are fail-closed (no silent fallback hopping)

### Required env by provider

- **xAI**: `XAI_API_KEY` (+ optional `XAI_MODEL_PRIMARY`, `XAI_BASE_URL`)
- **OpenAI**: `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `OPENAI_BASE_URL`)
- **Anthropic**: `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`)

Global optional defaults:

- `LLM_TIMEOUT_MS`
- `LLM_RETRY_MAX`
- `LLM_MAX_TOKENS`
- `LLM_TEMPERATURE`

When `LAUNCH_MODE != off`, startup validation fails closed if the primary provider key is missing. If fallback is configured, its key is also required.

### Example env setups

**1) xAI only (current default)**

```env
LLM_PROVIDER=xai
XAI_API_KEY=...
XAI_MODEL_PRIMARY=grok-3
```

**2) OpenAI as primary**

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

**3) Anthropic as primary**

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
```

**4) Primary + fallback**

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
LLM_FALLBACK_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

### Local validation

```bash
pnpm typecheck
pnpm test
pnpm run ci
```

## X OAuth / Runtime Notes

- Runtime uses OAuth2 refresh flow with an existing valid `X_REFRESH_TOKEN`.
- `offline.access` must be part of scopes during authorization, otherwise X will not issue a `refresh_token`.
- `X_ACCESS_TOKEN` is optional and treated as transient fallback.
- Token endpoint for confidential clients uses `Authorization: Basic base64(client_id:client_secret)`.

### Token Tooling

1. **Refresh only (normal runtime path):**
   - `pwsh ./Refresh-XAccessToken.ps1`
   - Refreshes an access token with the currently stored `X_REFRESH_TOKEN`.
   - Does **not** recover from an invalid/revoked refresh token by itself.

2. **Full OAuth2 PKCE re-authorization (recovery path):**
   - `pwsh ./scripts/Generate-XOAuthTokens.ps1 -ClientId "$env:X_CLIENT_ID" -ClientSecret "$env:X_CLIENT_SECRET"`
   - Starts browser login + local callback listener.
   - Use BOT account login (not management account).
   - Mints a new `refresh_token` (requires `offline.access`) and writes token response to local JSON.

If runtime refresh fails with `invalid token`, `invalid_request`, or `invalid_grant` style errors, run the full PKCE script and update `X_REFRESH_TOKEN` in your runtime secret store.

## Render Notes

`render.yaml` provides worker and cron defaults aligned with the Gnomes identity.

## Development Notes

- Keep gnome profile data in `data/gnomes/*.yaml` as SSOT.
- Avoid hardcoded legacy fallback IDs in runtime paths.
- Apply final formatting in output stage, not prompt-only.

## Docs

Start with `docs/README.md` and domain-specific docs under `docs/architecture`, `docs/operations`, and `docs/lore`.
