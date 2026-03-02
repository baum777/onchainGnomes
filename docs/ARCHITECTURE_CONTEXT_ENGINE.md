# Context-Aware Reply Engine Architecture

## Migration Modes (CONTEXT_ENGINE_MODE)

- **legacy**: brand_matrix/contextBuilder only
- **v2**: contextBuilderV2 + timelineScoutV2 only
- **hybrid**: v2 primary; fallback to legacy summary if v2 missing

## Overview

The Context Engine provides thread analysis, keyword extraction, and optional timeline sampling to power the Gorky persona replies.

## High-Level Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Mention   │────▶│ ThreadContext│────▶│   Guard     │
│   Event     │     │   Builder    │     │   Check     │
└─────────────┘     └──────────────┘     └──────┬──────┘
                         │                     │
                         ▼                     ▼
                  ┌──────────────┐     ┌─────────────┐
                  │Keyword Extract│    │     LLM     │
                  └──────────────┘     │   (xAI)     │
                         │              └──────┬──────┘
                         ▼                     │
                  ┌──────────────┐              │
                  │TimelineScout │──────────────┘
                  │  (optional)  │
                  └──────────────┘
```

## ContextBundle Schema

```typescript
interface ContextBundle {
  mention: MentionInput;      // The incoming mention
  thread: ThreadContext;     // Thread chain + analysis
  timeline?: TimelineBrief;  // Optional recent tweet brief
  controls: ReplyControls;    // Governance knobs
  trace: {                   // Observability data
    request_id: string;
    started_at: string;
    cache_hits: string[];
    api_calls: Array<{ name: string; ok: boolean; ms: number }>;
    warnings: string[];
  };
}
```

## Data Flow

1. **MentionInput** - Capture tweet ID, text, author info
2. **buildThreadContext()** - Walk parent chain (up to max_thread_depth)
3. **extractKeywords()** - Parse entities ($tickers, #hashtags, @handles)
4. **buildTimelineBrief()** (optional) - Sample recent tweets by keywords
5. **preLLMGuards()** - Safety check before LLM call
6. **LLM Prompt** - System + Developer + User template
7. **JSON Response** - Structured reply with metadata

## Safety + Governance

- **PII Detection**: Blocks mentions with phone/address patterns
- **postLLMGuards**: Reply length ≤280, no identity slurs
- **Rate Limiting**: Max 2 timeline queries per mention
- **Thread Depth Guard**: Configurable max parent traversal
- **Empty Content Block**: Rejects empty mentions early

## Rate Limit Strategy

- Timeline Scout uses `maxQueries` guard (default: 2)
- Each API call logged in `trace.api_calls`
- Exponential backoff handled by underlying twitter-api-v2 client
- Cache prevents repeated thread fetches

## Extension Ideas

1. **Embeddings** - Semantic similarity for better thread grouping
2. **Semantic Clustering** - Group similar conversations
3. **Adaptive Roast Level** - Adjust based on user history
4. **Sentiment Timeline** - Track sentiment shifts in mentions
5. **Knowledge Graph** - Build entity relationships over time
