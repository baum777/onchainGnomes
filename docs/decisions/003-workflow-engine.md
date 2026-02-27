# ADR-003: Workflow Engine Design

## Status

Accepted

## Context

Need generic, observable workflow execution. Must support:
- Multiple event types
- Step-by-step execution
- Early abort on validation failure
- Debugging of decisions
- Future multi-agent extension

## Decision

Implement pipeline pattern with WorkflowContext passed through steps:

1. Normalize - raw event → NormalizedEvent
2. Classify - determine action type
3. BuildContext - (optional) load from DB
4. Decide - AI generates action
5. Validate - rate limits, duplicates
6. Execute - perform action
7. Persist - save state
8. Observe - metrics, logs

Each step can set `should_abort` to short-circuit.

## Consequences

**Positive**
- Clear execution flow
- Each step testable in isolation
- Decision chain traceable
- Easy to add new steps
- Handlers can share engine

**Negative**
- Fixed order - some flexibility lost
- Context object can grow
