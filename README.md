# xAi Bot App

Autonomous X (Twitter) AI Agent Backend - A Grok-like agent that handles mentions, replies, and commands.

## Features

- **Mention Handling** - AI-generated replies to @mentions
- **Command Parsing** - /help, /status, /preset
- **Prompt System** - External YAML prompts, versioned and editable
- **State Management** - SQLite persistence, deduplication, cooldowns
- **Dry Run Mode** - Test without posting
- **Observability** - Structured logging, Prometheus metrics

## Quick Start

```bash
# Setup
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Configure (copy and edit)
copy .env.example .env

# Initialize database
python scripts/init_db.py

# Test (dry run)
python scripts/dry_run.py

# Run
python -m src.main
```

## Project Structure

```
src/
  config/       - Settings, constants
  core/         - Orchestrator, Scheduler, EventRouter
  agents/       - Prompt loader, Context builder, Action classifier
  workflows/    - Engine, steps, handlers
  clients/      - X API, xAI, Media
  state/        - StateManager, Deduplicator
  commands/     - Parser, Registry
prompts/        - YAML prompts (system, tasks, presets, commands)
docs/           - Architecture, ADRs, Runbooks
```

## Configuration

| Variable | Description |
|----------|-------------|
| X_API_KEY | X API consumer key |
| X_API_SECRET | X API consumer secret |
| X_ACCESS_TOKEN | X OAuth access token |
| X_ACCESS_SECRET | X OAuth access secret |
| XAI_API_KEY | xAI (Grok) API key |
| DRY_RUN | Set true to simulate without posting |
| DEBUG | Enable debug logging |

## Development

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
python scripts/dry_run.py --event tests/fixtures/sample_events.json
```

## Docker

```bash
docker build -t xai-bot .
docker run --env-file .env xai-bot
```

## Context-Aware Reply Engine (Gorky Persona)

### Gorky Persona

Sarcastic, witty, crypto-native commentator. Roasts content, never identity. De-escalates aggression with playful humor. No doxxing, hate, or financial advice. Replies ≤280 chars. Internal tags/scores never exposed publicly.

### Context Engine v2 (thread + timeline)

Thread context walks reply chains; optional timeline scout samples recent tweets by keywords. Migration modes: **legacy** (brand_matrix builder), **v2** (new builder), **hybrid** (merge).

### Phase 2 Adaptive Intelligence

Signals: sentiment, toxicity, urgency, novelty, confidence. Roast-level routing: high toxicity → deescalate; joke/provocation → spicy; question/request → mild. De-escalation uses playful humor or short rhyme.

### Phase 3 Semantic Intelligence

Optional semantic layer atop Context Engine v2 (disabled by default). When enabled, defaults to **shadow** mode (logs only, no behavior change). Other modes: **assist** (appends semantic bullets if confidence healthy), **full** (semantic-driven selection with fallback to heuristic if confidence <0.55). Uses in-memory index (no external DB), deterministic hash embeddings with optional xAI embeddings upgrade. See `docs/PHASE3_SEMANTIC_INTELLIGENCE.md`.

The bot uses an advanced context engine for intelligent replies:

### Features

- **Thread Context Analysis** - Walks reply chains to understand conversation history
- **Keyword Extraction** - Identifies tickers, hashtags, and topical keywords
- **Timeline Sampling** - Optional brief from recent relevant tweets
- **Guardrails** - Pre-LLM safety checks for PII and policy violations
- **JSON Contract** - Structured LLM output (reply_text, style_label, tags)

### Data Flow

```
Mention -> ThreadContext -> (TimelineScout) -> Guard -> LLM -> Reply
```

### Safety & Governance

- Rate-limit protection on timeline queries
- Configurable thread depth limits
- PII detection and blocking
- postLLMGuards: reply length ≤280, no identity slurs
- Fail-fast on 401 errors
- No identity-based attacks
- Mentions source toggle: `MENTIONS_SOURCE` (`mentions` or `search`)

### Configuration

| Variable | Description |
|----------|-------------|
| MENTIONS_SOURCE | Fetch mode: `mentions` or `search` |
| BOT_USERNAME | Bot handle (e.g. serGorky) |
| CONTEXT_ENGINE_MODE | `legacy` \| `v2` \| `hybrid` (default: hybrid) |
| USE_ENHANCED_CONTEXT | Enable new context engine (default: false) |
| CONTEXT_MAX_THREAD_DEPTH | Max parent tweets to fetch (default: 3) |
| CONTEXT_ENABLE_TIMELINE_SCOUT | Enable timeline sampling (default: false) |
| CONTEXT_TIMELINE_MAX_QUERIES | Max search queries per mention (default: 2) |
| CONTEXT_TIMELINE_TWEETS_PER_QUERY | Tweets sampled per query (default: 25) |
| CONTEXT_TIMELINE_WINDOW_MINUTES | Time window for timeline scout (default: 360) |
| SEMANTIC_ENABLED | Enable Phase 3 Semantic Intelligence (default: false) |
| SEMANTIC_MODE | `shadow` \| `assist` \| `full` (default: shadow) |
| SEMANTIC_TOPK | Top-K results to consider (default: 20) |
| SEMANTIC_CLUSTER_SIM | Similarity threshold for clustering (default: 0.82) |
| SEMANTIC_INDEX_TTL_DAYS | Index document TTL (default: 7) |
| SEMANTIC_MEMORY_TTL_DAYS | User memory TTL (default: 14) |
| XAI_EMBEDDINGS_MODEL | Enable xAI embeddings instead of hash fallback |

## Documentation

See `docs/` for architecture, workflows, operations, and ADRs.
