# Launch Readiness Checklist — Quality Gates & Rollout Criteria

Quality gates and rollout criteria for Phase 5 launch readiness. For operational steps (off → dry_run → staging → prod), see [ROLLOUT_CHECKLIST.md](./ROLLOUT_CHECKLIST.md).

---

## Quality Gates

Before advancing to any rollout stage, the following must hold:

| Gate | Criteria | Verification |
|------|----------|--------------|
| **Minimum passing test set** | `tests/gorky/llm/*.test.ts`, `tests/gorky/safety/adversarial.test.ts`, `tests/canonical/promptBuilder.test.ts` all pass | `npm test -- tests/gorky tests/canonical/promptBuilder` |
| **No critical safety regressions** | Golden blocked cases (aggressive bait, financial-advice bait, identity-targeted, off-topic spam) all yield skip_safety_filter and LLM not called | golden.eval.test.ts blocked cases |
| **No persona drift in golden set** | For each golden allow case that publishes, enforcePersonaGuardrails(reply).passed and !detectPersonaDrift(reply) | golden.eval.test.ts allowed cases |
| **No malformed prompt/render output** | prompt.render tests pass; no undefined in system/developer/user | prompt.render.test.ts |
| **No unsafe response on blocked inputs** | When action is skip, reply_text is null; no fallback text emitted | response.generation.test.ts, golden.eval.test.ts |

---

## Rollout Gate Criteria

### dry_run

**Prerequisites:**
- [ ] All Phase 5 tests pass: `npm test -- tests/gorky/llm`
- [ ] Golden blocked cases: safetyFilter blocks, block_reason matches
- [ ] No malformed prompt (prompt.render tests)
- [ ] No reply_text on any skip

**Then:** Run ROLLOUT_CHECKLIST dry_run steps (LAUNCH_MODE=dry_run, trigger test mention, verify audit log, no tweet posted).

### restricted (staging)

**Prerequisites:**
- [ ] dry_run gate satisfied
- [ ] dry_run stable for ≥24h (or as configured)

**Then:** Run ROLLOUT_CHECKLIST staging steps (LAUNCH_MODE=staging, ALLOWLIST_HANDLES, allowlisted handle → post, non-allowlisted → skip).

**Abort if:** safety_blocks > 1% of processed.

### full (prod)

**Prerequisites:**
- [ ] restricted gate satisfied
- [ ] Staging stable ≥1 week (or as configured)

**Then:** Run ROLLOUT_CHECKLIST prod steps (LAUNCH_MODE=prod, monitor publish/skip ratio, validation failures, rate limits).

**Abort if:** Persona drift > 0.5%, manual incident, safety regression.

---

## Reference

| Document | Purpose |
|----------|---------|
| [ROLLOUT_CHECKLIST.md](./ROLLOUT_CHECKLIST.md) | Operational steps per stage (off, dry_run, staging, prod) |
| [PHASE5_RESPONSE_QUALITY.md](./PHASE5_RESPONSE_QUALITY.md) | Phase 5 scope, files, test strategy, golden set |
