# Data Flow

## Event Processing Flow

```
[Scheduler Tick]
    ↓
[Fetch Events from X API]
    ↓
[Filter Already Processed]
    ↓
[Event Router - Classify Type]
    ↓
[Workflow Engine]
    ├─ Normalize
    ├─ Classify Intent
    ├─ Build Context
    ├─ AI Decide
    ├─ Validate (rate limits, duplicates)
    ├─ Execute Action
    ├─ Persist State
    └─ Observe (metrics, logs)
    ↓
[Next Tick]
```

## Event Types

- **mention** - User @mentions the bot
- **timeline** - Timeline activity (autonomous posting)
- **reply** - Reply in conversation thread
- **dm** - Direct message
- **scheduled** - Scheduled post trigger
- **command** - Parsed command (e.g. /help)
