# Persona Memory Layers

## SSOT Rule

- Canonical core persona remains `data/gnomes/*.yaml`.
- Semantic records are derived artifacts only (`artifacts/persona-semantic-records.json`).
- Reflection may promote records, but never edits YAML automatically.

## 4-Layer Architecture

1. **Core Persona Layer (static / curated)**
   - Gnome identity, role, archetype, style anchors, negative boundaries, relations.
2. **Semantic Persona Layer (derived / retrieval)**
   - Compiler-generated records (`voice_core`, `voice_style_anchor`, `voice_activation_rule`, `voice_negative_boundary`, `voice_relation`, `voice_example`, `lore_chunk`).
3. **Episodic Memory Layer (dynamic)**
   - Interaction episodes with quality signals (`PersonaEpisode`).
4. **Reflective Curation Layer (gatekeeper)**
   - Heuristic scoring (`inCharacter`, `utility`, `driftRisk`) and retain/promote decisions.

## Compiler Flow

`pnpm persona:build-semantic`

1. Load canonical YAML profiles.
2. Optionally enrich with lore chunks.
3. Deterministically build semantic records.
4. Emit JSON artifacts (combined + optional per-voice files).

## Retrieval Flow

- Rule-based selector computes hard/base routing score first.
- Semantic retrieval contributes `semanticFitScore` and explainability anchors/boundaries.
- Final score is combined: `ruleBasedScore`, `semanticFitScore`, `continuityScore`.
- Hard safety/routing overrides still win (e.g., caution mode suppressing meme-heavy voice dominance).

## Reflection / Promotion Flow

`interaction -> reflection -> selective retention -> retrieval-shaped future behavior`

- Episodes are scored for in-character fit, utility, and drift risk.
- Only retained/promoted episodes become derived semantic records (`sourceType: reflection`).
- Promoted records are versioned and traceable via `derivedFrom`.

## Drift Protection

- Core YAML is immutable from runtime learning.
- Negative boundaries and safety boundaries are included in prompt context + retrieval results.
- Poor/high-drift episodes are rejected from promotion.
