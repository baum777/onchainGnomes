# Gorky — Repository Tree

```
xAi_Bot-App/
├── src/
│   ├── index.ts
│   ├── server.ts
│   │
│   ├── worker/
│   │   └── pollMentions.ts          ◄── EXISTING: processCanonicalMention, runWorkerLoop
│   │
│   ├── canonical/
│   │   └── pipeline.ts               ◄── EXISTING: handleEvent (orchestration)
│   │
│   ├── roast/                       ◄── EXISTING: patternEngine, formatDecision
│   ├── narrative/                   ◄── EXISTING: narrativeMapper
│   ├── safety/                      ◄── EXISTING: safetyFilter
│   ├── validation/                  ◄── EXISTING: repairLayer
│   ├── ops/                         ◄── EXISTING: dedupeGuard, rateLimiter, launchGate
│   │
│   └── gorky/                       ◄── NEW: publishDecision.ts
│       └── publishDecision.ts
│
├── config/
│   ├── default.yaml                 ◄── EXISTING
│   └── gorky.yaml                   ◄── NEW: Gorky overrides
│
├── schemas/
│   └── gorky/                       ◄── NEW: 11 JSON schemas
│       ├── mention_signal.schema.json
│       ├── normalized_event.schema.json
│       ├── safety_result.schema.json
│       ├── relevance_result.schema.json
│       ├── narrative_result.schema.json
│       ├── pattern_selection.schema.json
│       ├── format_decision.schema.json
│       ├── llm_generation_request.schema.json
│       ├── validation_result.schema.json
│       ├── publish_result.schema.json
│       └── analytics_log.schema.json
│
├── tests/
│   └── gorky/                       ◄── NEW
│       ├── fixtures/
│       │   ├── mentions.ndjson
│       │   └── README.md
│       ├── integration/
│       │   └── pipeline.integration.test.ts
│       └── safety/
│           └── adversarial.test.ts
│
└── docs/
    └── implementation-package/     ◄── THIS PACKAGE
        ├── PACKAGE_SUMMARY.md
        ├── REPO_TREE.md
        ├── MODULE_RESPONSIBILITIES.md
        ├── INTERFACE_CONTRACTS.md
        ├── CODE_SKELETONS.md
        ├── ROLLOUT_CHECKLIST.md
        └── INTEGRATION_NOTES.md
```

## Relationship to Existing Code

```
pollMentions.ts
    │
    ├─► mentionToCanonicalEvent(mention)  → CanonicalEvent
    │
    └─► handleEvent(event, deps, config)   [pipeline.ts]
            │
            ├─► dedupeCheckAndMark(event_id)      [ops/dedupeGuard]
            ├─► enforceLaunchRateLimits(...)     [ops/rateLimiter]
            ├─► safetyFilter(event)               [safety]
            ├─► classify(event)                   [canonical]
            ├─► scoreEvent, checkEligibility, extractThesis
            ├─► mapNarrative, selectPattern, formatDecision
            ├─► fallbackCascade (LLM + validate + repair)
            └─► buildAuditRecord, persistAuditRecord
    │
    └─► shouldPost(authorHandle)           [ops/launchGate]
    └─► xClient.reply(...) or [DRY_RUN] log
```
