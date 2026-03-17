# Phase 1 - Launch Safety

## Zusammenfassung

Phase 1 implementiert grundlegende Laufzeitsicherheit für den xAi Bot:

- **Per-Event Failure Isolation**: Fehler bei einzelnen Mentions crashen nicht den Poll-Loop
- **Async Audit Logging**: Buffer-basiertes, nicht-blockierendes Audit-Logging
- **LLM Budget Gate**: Sliding-Window Rate-Limiting für LLM-Calls
- **Publish Retry + Idempotency**: Exponentieller Backoff, verhindert Doppelposts

## Environment Variables

```bash
# LLM Budget Gate
MAX_LLM_CALLS_PER_MINUTE=30        # Max gewichtete Calls pro Minute
COST_WEIGHT_THREAD=2               # Gewichtung für Thread-Calls
COST_WEIGHT_REPLY=1                # Gewichtung für Reply-Calls

# Publish Retry
PUBLISH_RETRY_DELAYS_MS=1000,5000,15000  # Retry-Delays
MAX_PUBLISH_RETRIES=3              # Max Retries
```

## Retry-Delays

| Attempt | Delay | Beschreibung |
|---------|-------|--------------|
| 1 | 0ms | Initialer Versuch |
| 2 | 5000ms | Erster Retry |
| 3 | 15000ms | Zweiter Retry |

## Test-Status

Alle 29 Phase-1-Tests passieren:
- `tests/safety/budgetGate.test.ts`: 8 Tests
- `tests/state/eventStateStore.test.ts`: State transitions, idempotency (eventState removed, use eventStateStore)  
- `tests/canonical/auditLog.async.test.ts`: 6 Tests

```bash
pnpm test -- tests/safety/budgetGate.test.ts tests/state/eventStateStore.test.ts tests/canonical/auditLog.async.test.ts
```

## Implementierungsdetails

### Per-Event Failure Isolation
- Global error handlers für `unhandledRejection`, `uncaughtException`
- Per-mention error counting (max 3 failures → terminal skip)
- Graceful shutdown mit SIGTERM/SIGINT Handlern

### Async Audit Logging
- In-memory Buffer (max 100 Einträge)
- Zeit-basierter Flush (alle 5 Sekunden)
- Retry bei Flush-Fehlern

### LLM Budget Gate
- Sliding Window (60 Sekunden)
- Gewichtung: Thread=2, Reply=1
- Fail-closed: Blockiert wenn Budget überschritten

### Publish Retry
- State Tracking: event_seen → processed_ok → publish_attempted → publish_succeeded
- Idempotency-Check vor jedem Publish
- Exponentieller Backoff mit konfigurierbaren Delays
