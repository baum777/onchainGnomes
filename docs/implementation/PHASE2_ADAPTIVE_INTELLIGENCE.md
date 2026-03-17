# Phase 2 Adaptive Intelligence

## Signals Computed

| Signal | Values | Heuristic |
|--------|--------|-----------|
| sentiment | negative, neutral, positive | Keyword scan (good/great vs bad/rug) |
| toxicity | low, med, high | Swear-word count |
| urgency | low, med, high | "now", "urgent", "help" presence |
| novelty | low, med, high | Timeline hot phrases, length |
| confidence | 0..1 | Context length / 2000 |
| roast_level | mild, medium, spicy, deescalate | Derived from toxicity + intent |

## Roast-Level Decision Table

| Toxicity | Intent | Roast level |
|----------|--------|-------------|
| high | any | deescalate |
| med | joke/provocation | medium |
| low | joke/provocation | spicy |
| any | question/request | mild |

## De-escalation Behavior

- Use playful humor or short ironic twist
- Never match aggression
- Redirect to market/situation, not person
- Short rhyme override possible

## Extension Path

1. **Embeddings** - Semantic similarity for thread grouping
2. **Clustering** - Group similar conversations
3. **Adaptive Query Expansion** - Adjust timeline keywords by user history
4. **Confidence Calibration** - Tune confidence heuristic with A/B data

## Next: Phase 3

See [Phase 3 Semantic Intelligence](./PHASE3_SEMANTIC_INTELLIGENCE.md) for semantic relevance ranking and topic clustering.
