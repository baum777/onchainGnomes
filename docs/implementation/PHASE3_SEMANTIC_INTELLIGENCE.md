# Phase 3 Semantic Intelligence

Additive semantic layer atop Context Engine v2 + Phase 2 AdaptiveSignals. Governed by feature flags; default shadow mode ensures no behavior change.

## Goals

1. **Semantic relevance** - Rank timeline candidates by semantic similarity to thread context
2. **Topic clustering** - Group similar conversations without external DB
3. **Memory** - Short-term per-user semantic history
4. **Zero external deps** - In-memory index + deterministic hash embeddings (optional xAI upgrade)

## Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **shadow** | Compute + log; no reply changes | Safe rollout, metrics collection |
| **assist** | Append 1-2 semantic bullets to timeline brief (if confidence ≥0.55) | Augmented context, human-verified |
| **full** | Semantic-driven bullet selection (with fallback to heuristic if confidence <0.55) | Full automation (governed) |

## Embedding Providers

### Hash Fallback (always available)
- Deterministic 128-dim vectors from token hashes
- No API calls, no external deps
- Sufficient for shadow mode clustering

### xAI Embeddings (optional upgrade)
- Set `XAI_EMBEDDINGS_MODEL=embedding-grok-2`
- Requires `XAI_API_KEY`
- Higher quality for assist/full modes

## Index + TTL Governance

- **InMemorySemanticIndex**: FIFO eviction at `SEMANTIC_INDEX_MAX_DOCS` (default 2000)
- **TTL**: Documents expire after `SEMANTIC_INDEX_TTL_DAYS` (default 7)
- **Memory**: Per-user store with `SEMANTIC_MEMORY_TTL_DAYS` (default 14)

## Clustering + Ranking

1. Embed thread context → seed vector
2. Embed candidate tweets → candidate vectors
3. Cosine similarity ranking
4. Greedy clustering by `SEMANTIC_CLUSTER_SIM` (default 0.82)
5. Label clusters by top shared keywords

## Safety Notes

- **Do not leak** internal similarity scores or cluster labels in public replies
- **Shadow mode first** - always validate metrics before assist/full
- **Dry-run compatible** - semantic computations run even when LLM call skipped
- **Confidence gate** - `avg_top5_sim < 0.55` triggers fallback to heuristic bullets (avoids semantic hallucination)

## Configuration

```bash
# Enable (default: false)
SEMANTIC_ENABLED=true

# Mode: shadow | assist | full
SEMANTIC_MODE=shadow

# Tuning
SEMANTIC_TOPK=20
SEMANTIC_CLUSTER_SIM=0.82
SEMANTIC_INDEX_TTL_DAYS=7
SEMANTIC_INDEX_MAX_DOCS=2000
SEMANTIC_MEMORY_TTL_DAYS=14

# Optional xAI embeddings
XAI_EMBEDDINGS_MODEL=embedding-grok-2
```

## Architecture

```
ThreadContext ──► seedText ──► embedder ──► seedVec
                                    │
TimelineCandidates ──► embed ───────┴──► cosine sim ──► rank ──► cluster
                                    │
                                    ▼
                         SemanticBrief (shadow/assist/full)
```

## Extension Paths

1. **Adaptive Query Expansion** - Use top_topic to refine search queries
2. **Conversation Threading** - Cluster across multiple users by topic
3. **Confidence Calibration** - Tune threshold with shadow-mode data
4. **Embeddings Cache** - Persist frequent vectors to SQLite
