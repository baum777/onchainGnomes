# Gorky Rollout Checklist

Operational checklist for staged rollout. Aligned with existing `launchGate` values: `off | dry_run | staging | prod`.

**Mapping:** `staging` = restricted, `prod` = full.

---

## Stage Definitions

| Stage | LAUNCH_MODE | Publish | Allowlist | Log All |
|-------|-------------|---------|-----------|---------|
| off | `off` | Never | N/A | Optional |
| dry_run | `dry_run` | Never | N/A | Yes |
| restricted | `staging` | Allowlist only | Required | Yes |
| full | `prod` | All eligible | Ignored | Yes |

---

## Pre-Rollout

- [ ] `npm test` passes
- [ ] `npm test -- tests/gorky` passes
- [ ] `XAI_API_KEY` and X API credentials set
- [ ] `config/gorky.yaml` reviewed
- [ ] `data/audit_log.jsonl` path writable
- [ ] `/metrics` endpoint reachable

---

## Stage: off

**Allowed behavior:** No LLM calls when possible. No publish.

- [ ] Set `LAUNCH_MODE=off`
- [ ] Worker starts without error
- [ ] No tweets posted
- [ ] Optional: poll loop runs, mentions logged

**Success metrics:** Zero publish attempts.

**Abort:** N/A.

---

## Stage: dry_run

**Allowed behavior:** Full pipeline, LLM generates. No publish. All events logged.

- [ ] Set `LAUNCH_MODE=dry_run`
- [ ] Trigger test mention
- [ ] Verify `[DRY_RUN] Would reply to ...` in logs
- [ ] Verify `data/audit_log.jsonl` contains entry
- [ ] Verify no tweet posted
- [ ] Run ≥24h for stability

**Success metrics:** Audit log populated, zero posts.

**Abort:** None.

**Go/no-go:** Proceed to staging when dry_run stable.

---

## Stage: staging (restricted)

**Allowed behavior:** Publish only to `ALLOWLIST_HANDLES`. Others skipped.

- [ ] Set `LAUNCH_MODE=staging`
- [ ] Set `ALLOWLIST_HANDLES=handle1,handle2` (comma-separated, no @)
- [ ] Restart worker
- [ ] Test: allowlisted handle → reply posted
- [ ] Test: non-allowlisted handle → skip, log
- [ ] Monitor: `safety_blocks`, `skip_reason` distribution

**Success metrics:** Publish count > 0 for allowlist; 0 for non-allowlist.

**Abort if:** `safety_blocks` > 1% of processed.

**Monitoring:** `audit_log.jsonl`, skip_reason counts.

**Go/no-go:** Proceed to prod when staging stable ≥1 week.

---

## Stage: prod (full)

**Allowed behavior:** Publish all eligible mentions.

- [ ] Set `LAUNCH_MODE=prod`
- [ ] Restart worker
- [ ] Monitor: publish/skip ratio, validation failures, rate limits
- [ ] Dashboards: relevance, pattern usage, validation reasons

**Success metrics:** Publish/skip ratio within expected band.

**Abort if:** Persona drift > 0.5%, manual incident, safety regression.

**Monitoring:** 24/7 alerts, log aggregation.

---

## Rollback

1. Set `LAUNCH_MODE=dry_run` or `LAUNCH_MODE=off`
2. Restart worker
3. Investigate `audit_log.jsonl`
4. Fix, re-run dry_run, then re-enable
