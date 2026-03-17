# Component Overview

## Core Components

### Orchestrator
Central coordination - routes events to workflows, coordinates execution.

### Scheduler
Time-based tick loop - polls for events at configurable intervals.

### Event Router
Classifies events and routes to appropriate workflow handlers.

### Workflow Engine
Executes step chains: Normalize → Classify → Decide → Validate → Execute → Persist → Observe.

### State Manager
StateStore-backed persistence (Redis or filesystem) for cursor, processed/published event state, locks, and worker heartbeat. Multi-worker deployments are Redis-only.

### X Client
OAuth 1.0a authenticated X API client for tweets, mentions, media.

### xAI Client
Grok API client with retry logic for chat completions.

### Prompt Loader
Loads and caches prompts from YAML files with variable injection.

### Context Builder
Assembles conversation history and context for AI decisions.
