# Gorky Implementation Package — Engineer Handoff

---

## First 10 Files to Create (Exact Order)

1. `schemas/gorky/mention_signal.schema.json`
2. `schemas/gorky/normalized_event.schema.json`
3. `schemas/gorky/safety_result.schema.json`
4. `schemas/gorky/relevance_result.schema.json`
5. `schemas/gorky/narrative_result.schema.json`
6. `schemas/gorky/pattern_selection.schema.json`
7. `schemas/gorky/format_decision.schema.json`
8. `schemas/gorky/llm_generation_request.schema.json`
9. `schemas/gorky/validation_result.schema.json`
10. `schemas/gorky/publish_result.schema.json`

Then: `analytics_log.schema.json`, `config/gorky.yaml`, `src/gorky/publishDecision.ts`, docs, tests.

---

## Minimal Build Sequence

1. **Schemas** — Create all 11 JSON schemas (no runtime dependency)
2. **Config** — `config/gorky.yaml`
3. **Code** — `src/gorky/publishDecision.ts`
4. **Docs** — REPO_TREE, MODULE_RESPONSIBILITIES, INTERFACE_CONTRACTS, CODE_SKELETONS, ROLLOUT_CHECKLIST, INTEGRATION_NOTES
5. **Fixtures** — `mentions.ndjson`, `fixtures/README.md`
6. **Tests** — `pipeline.integration.test.ts`, `adversarial.test.ts`
7. **Verify** — `npm test -- tests/gorky`

---

## Engineer Handoff Note

This package extends the existing xAi_Bot-App with Gorky-specific documentation, schemas, config, and tests. **No changes to `pipeline.ts` or `pollMentions.ts` are required.** The pipeline already wires safety, narrative, pattern, and format. The worker already uses launchGate for dry_run/staging/prod.

**To run Gorky:**
1. Set `LAUNCH_MODE=dry_run` (or `staging` / `prod`)
2. Set `XAI_API_KEY`, X API credentials
3. For staging: `ALLOWLIST_HANDLES=handle1,handle2`
4. Start: `npm start` or `node dist/index.js`

**To test:** `npm test -- tests/gorky`

---

## Most Likely Integration Pitfall

**Launch gate vs. dryRun:** `dryRun` in `pollMentions` comes from `isPostingDisabled()` when `LAUNCH_MODE` is set, else from `DRY_RUN` env. If both are set, `LAUNCH_MODE` wins. Ensure `LAUNCH_MODE` is explicitly set in staging/prod to avoid `DRY_RUN=true` overriding intended behavior.
