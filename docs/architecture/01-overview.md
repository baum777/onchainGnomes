# System Overview

## Goals

- Autonomous posting on X (Twitter)
- Handling mentions with AI-generated replies
- Command and preset parsing
- Image generation workflows (future)
- Multi-agent extension (future)

## High-Level Architecture

The system follows a layered architecture:

1. **Input Layer** - X API polling, webhooks, scheduler
2. **Orchestration Layer** - Event router, workflow engine, scheduler
3. **Agent Layer** - Prompts, context builder, xAI client
4. **Action Layer** - X client, media handler, command parser
5. **Persistence Layer** - SQLite state manager
6. **Observability Layer** - Structured logging, metrics

## Key Design Principles

- Prompts are external (YAML) - editable without code changes
- Context is injectable and versionable
- Workflows are observable and debuggable
- State persistence prevents duplicate actions
- Dry-run mode for safe testing
