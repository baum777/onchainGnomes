# Image Generation Workflow (Replicate)

## Overview

This workflow describes how reply images are generated using **Replicate** as the provider.

The system builds a structured prompt using the StyleBand system, sends it to Replicate, waits for prediction completion, and returns the generated image for reply usage.

---

## Provider

- **Provider**: Replicate
- **Authentication**: `REPLICATE_API_KEY`
- **Model**: Configurable via `REPLICATE_IMAGE_MODEL` (default: `black-forest-labs/flux-schnell`)

📌 Environment variables are documented exclusively in:
→ `docs/var.README.md`

---

## High-Level Flow

1. **Trigger**
   - ROAST_IMAGE reward triggered (Level >= 3)
   - Explicit `/img` command
   - Mention with image intent

2. **Prompt Construction** (`src/prompts/buildPromptFromSchema.ts`)
   - Persona Signature (constant)
   - StyleBand Core (based on energy/level/aggression)
   - Topic Metaphors (from lexicon)
   - Safety constraints
   - No internal scoring metadata

3. **StyleBand Selection** (`src/prompts/selectStyleBand.ts`)
   - `/img` command → `GORKY_MEME_CARD_CLEAN`
   - Aggression detected → `GORKY_SHADOW_IRONY`
   - User Level >= 4 → `GORKY_DOMINANCE_MODE`
   - Energy 4-5 → `GORKY_CYBER_GLITCH`
   - Energy 0-1 → `GORKY_BLUEPRINT_MINIMAL`
   - Default → `GORKY_NEON_CHALK`

4. **Replicate Request** (`src/clients/replicateClient.ts`)
   - Create prediction with structured prompt
   - Timeouts: `REPLICATE_RUN_TIMEOUT_MS` (45s default)
   - Wait for completion

5. **Download** (`src/clients/replicateClient.ts`)
   - Extract URL from Replicate output
   - Download with `REPLICATE_DOWNLOAD_TIMEOUT_MS` (20s default)
   - Return as Buffer

6. **Result Handling** (`src/services/imageGenerator.ts`)
   - Optional: Cache result (LRU with TTL)
   - Attach to reply payload

7. **Publish Reply** (`src/workflows/mentionWorkflow.ts`)
   - Post text + image via X API
   - Log outcome

---

## Prompt Rules

- Follow StyleBand system (`src/prompts/styleBands.ts`)
- Use Topic Lexicon for visual metaphors (`src/prompts/topicLexicon.ts`)
- No internal metrics exposed (no scores, thresholds, trace data)
- No hidden scoring data
- Enforce platform-safe content
- Avoid secrets in prompts

---

## Error Handling

| Error Type | Cause | Action |
|------------|-------|--------|
| Auth Error | Invalid / missing token | Check ENV |
| Model Not Found | Wrong model slug | Validate `REPLICATE_IMAGE_MODEL` |
| Timeout | Provider delay | Retry (bounded, with `withRetry`) |
| Safety Refusal | Provider policy block | Fallback to TEXT reply |
| Download Fail | Network / URL issue | Log error, fallback to TEXT |

---

## Observability

Log (without secrets):

- `model` - Replicate model slug
- `style_band` - Selected StyleBand key
- `latency_ms` - Total generation time
- `from_cache` - Whether served from cache
- `success/failure` - Outcome

Never log:
- API tokens
- Internal scoring values
- Private user metadata
- Full prompt content (in production)

---

## Caching

The ImageGeneratorService supports LRU caching (`src/cache/lruImageCache.ts`):

- Cache Key: Deterministic hash of model + styleBand + aspect + intent + keywords + energy + userLevel
- TTL: 6-24 hours (configurable)
- Benefits: Cost savings, faster replies for similar requests

---

## Local Testing Checklist

- [ ] `REPLICATE_API_KEY` present
- [ ] `REPLICATE_IMAGE_MODEL` correctly configured
- [ ] One successful generation completed
- [ ] Image Buffer returned
- [ ] Reply successfully published
- [ ] Cache hit/miss logged correctly

---

## Related Files

- `src/clients/replicateClient.ts` - Replicate API client
- `src/services/imageGenerator.ts` - High-level image service
- `src/prompts/styleBands.ts` - 6 StyleBand definitions
- `src/prompts/topicLexicon.ts` - 45 keyword → metaphor mappings
- `src/prompts/buildPromptFromSchema.ts` - Prompt construction
- `src/workflows/mentionWorkflow.ts` - Mention handling with image branch
