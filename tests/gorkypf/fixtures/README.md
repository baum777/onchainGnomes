# Gorky Test Fixtures

## mentions.ndjson

NDJSON fixture file. Each line is a JSON object matching `Mention` from `src/poller/mentionsMapper.ts`.

### Categories and Expected Outcomes

| ID | Category | Intent | Expected Stage Outcome |
|----|----------|--------|------------------------|
| fx-hopium | Hopium | hype_claim | Reply (hopium_overdose pattern) |
| fx-liquidity | Liquidity illusion | performance_claim | Reply (liquidity_illusion pattern) |
| fx-utility | Fake utility | claim_exceeds_evidence | Reply (narrative_vs_reality pattern) |
| fx-cycle | This cycle different | market_narrative | Reply (this_time_different pattern) |
| fx-posthype | Post-hype silence | launch_announcement | Reply (post_hype_silence pattern) |
| fx-bait | Aggressive bait | bait | Safety block (harassment_bait) |
| fx-finadvice | Financial advice bait | question | Safety block (financial_advice_request) |
| fx-spam | Off-topic spam | spam | Safety block (spam) |

### Loading in Tests

```typescript
import fs from "node:fs";
import path from "node:path";

const FIXTURES_PATH = path.join(__dirname, "mentions.ndjson");

function loadFixtures(): Array<Record<string, unknown>> {
  const raw = fs.readFileSync(FIXTURES_PATH, "utf-8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
```

### Mapping to CanonicalEvent

Tests use `mentionToCanonicalEvent()` from `src/worker/pollMentions.ts` or a local equivalent to convert each fixture to `CanonicalEvent` before passing to `handleEvent()`.
