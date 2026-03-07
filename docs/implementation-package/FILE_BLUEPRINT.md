# File-by-File Content Blueprint

## Documentation Package

| File | Purpose | Key Sections | Completion |
|------|---------|--------------|------------|
| REPO_TREE.md | Show package location vs pipeline/worker | Tree, relationship diagram | near-final |
| MODULE_RESPONSIBILITIES.md | Responsibility boundaries | Per-module table | near-final |
| INTERFACE_CONTRACTS.md | Type contracts | Producer, consumer, invariants | near-final |
| CODE_SKELETONS.md | Pseudocode → code map | Function locations | near-final |
| ROLLOUT_CHECKLIST.md | Stage checklist | off/dry_run/staging/prod | near-final |
| INTEGRATION_NOTES.md | Touch points | Pipeline, worker | near-final |

## Schema Package

| File | Purpose | Key Fields | Completion |
|------|---------|------------|------------|
| mention_signal.schema.json | Raw X mention | id, text, author_id, authorUsername | near-final |
| normalized_event.schema.json | CanonicalEvent | event_id, platform, trigger_type, text | near-final |
| safety_result.schema.json | Safety stage output | passed, block_reason, policy_flags | near-final |
| relevance_result.schema.json | Score breakdown | score, components | near-final |
| narrative_result.schema.json | Narrative label | label, confidence, sentiment | near-final |
| pattern_selection.schema.json | Pattern choice | pattern_id, framing, fallback_used | near-final |
| format_decision.schema.json | Format choice | format: skip\|short\|expanded\|thread | near-final |
| llm_generation_request.schema.json | LLM input | system, user, pattern_id, format_target | near-final |
| validation_result.schema.json | Validation output | ok, reason, repair_suggested | near-final |
| publish_result.schema.json | Publish outcome | outcome: posted\|skipped\|blocked\|validation_failed | near-final |
| analytics_log.schema.json | Audit event | event_id, safety_result, publish_decision | near-final |

## Config Package

| File | Purpose | Key Sections | Completion |
|------|---------|--------------|------------|
| config/gorky.yaml | Gorky overrides | relevance, thresholds, rollout, features | near-final |

## Code Package

| File | Purpose | Key Exports | Completion |
|------|---------|-------------|------------|
| src/gorky/publishDecision.ts | Publish checks | prePublishChecks, postPublishCheck | scaffold |

## Test Package

| File | Purpose | Key Cases | Completion |
|------|---------|-----------|------------|
| fixtures/mentions.ndjson | 8 fixture lines | hopium, bait, spam, etc. | near-final |
| fixtures/README.md | Fixture docs | Categories, expected outcomes | near-final |
| integration/pipeline.integration.test.ts | E2E | safety block, publish, dry_run, staging | scaffold |
| safety/adversarial.test.ts | Safety | insult, identity, financial, shill | scaffold |
