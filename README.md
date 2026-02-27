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

## Documentation

See `docs/` for architecture, workflows, operations, and ADRs.
