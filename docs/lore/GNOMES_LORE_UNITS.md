# GNOMES Lore Units Specification

## Unit types

- `voice_rule`: role-specific speaking behavior.
- `constraint_rule`: anti-hype / no-advice / treasury discipline constraint.
- `context_hint`: retrieval hint for mode/intent alignment.
- `dominance_rule`: role cap or override rule.

## Chunking rules

- Micro-chunks only (target 1–3 lines).
- One operational idea per unit.
- Avoid narrative paragraphs.

## Embed / no-embed policy

- `embed: true` for retrieval-descriptive context hints.
- `embed: false` for strict constraints/dominance controls where semantic expansion is risky.

## Status model

- `candidate`: non prompt-effective.
- `approved`: reviewed but still inert unless activated.
- `active`: prompt-effective and allowed in runtime injection budget.

## Good unit example

- Short, role-tagged, mode-tagged, explicit behavior, includes status + source version.

## Bad unit example

- Long story paragraph, no role tags, no status, no runtime use.

## Wave-1 note

Wave 1 stays file-based. No vendor/tool specific vector-store assumptions are introduced here.
