# GNOMES Governance

## Authority order

1. `docs/lore/GNOMES_MATRIX.md` (canonical behavior authority)
2. `docs/lore/GNOMES_LORE_UNITS.md` (lore unit rules)
3. `data/gnomes/*.yaml` (runtime profiles; must not redefine canon)
4. `prompts/fragments/gnomes/*.md` (voice realization; must not conflict with canon/safety)
5. Retrieval artifacts in `memory/lore/*` (derived operational context)

## Change control

- Canon changes require doc update + ADR/reference note.
- Runtime profile changes must remain schema/type compatible.
- Prompt fragment changes are additive and cannot weaken global safety/shared canon.

## Lore status process

`candidate -> approved -> active`

- `candidate`: draft, non prompt-effective, review-only.
- `approved`: reviewed quality/content, still not automatically prompt-effective.
- `active`: explicitly enabled for prompt consumption.

## Review and activation gates

- Gate A: Canon consistency (matrix + shared canon alignment).
- Gate B: Voice differentiation (no role confusion with neighboring role).
- Gate C: Safety + anti-advice compliance.
- Gate D: Runtime budget compatibility.

Only material passing all gates may move to `active`.
