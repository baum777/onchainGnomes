# Gorky Implementation Package — Summary

## Purpose

Extension layer for the existing xAi_Bot-App. Adds Gorky-specific documentation, schemas, config, publish-decision skeleton, and tests. **Does not replace** `src/canonical/pipeline.ts` or `src/worker/pollMentions.ts`.

## Scope

| Area | Contents |
|------|----------|
| Docs | REPO_TREE, MODULE_RESPONSIBILITIES, INTERFACE_CONTRACTS, CODE_SKELETONS, ROLLOUT_CHECKLIST |
| Schemas | 11 JSON schemas in `schemas/gorky/` |
| Config | `config/gorky.yaml` |
| Code | `src/gorky/publishDecision.ts` |
| Tests | fixtures, integration, adversarial safety |
| Integration | Minimal touch points into pipeline and worker |

## LaunchGate Mapping

| Gorky Stage | launchGate | Publish |
|-------------|------------|---------|
| off | off | Never |
| dry-run | dry_run | Never (log only) |
| restricted | staging | Allowlist only |
| full | prod | All eligible |

## Phase 5: Response Quality & Launch Readiness

- **PHASE5_RESPONSE_QUALITY.md**: Prompt rendering validation, LLM response tests, persona consistency, golden set, quality gates.
- **LAUNCH_READINESS_CHECKLIST.md**: Quality gates (min test set, no safety regressions, no persona drift) and rollout criteria for dry_run → restricted → full.

## Key Assumptions

- Pipeline `handleEvent()` already orchestrates: Safety → Classify → Score → Eligibility → Thesis → Narrative → Pattern → Format → LLM → Validate → Audit.
- Worker `processCanonicalMention()` calls `handleEvent()`, then `shouldPost()`, then `xClient.reply()` or dry-run log.
- Dedupe and rate limit run **before** `handleEvent()` in pipeline.
- Launch gate runs **after** `handleEvent()` in worker.
