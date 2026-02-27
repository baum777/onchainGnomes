# ADR-002: Prompt YAML Format

## Status

Accepted

## Context

Prompts must be editable without touching code. Need format that supports:
- Versioning
- Variable injection
- Multiple prompt types (system, task, command)
- Future preset inheritance

## Decision

Store prompts as YAML files in `prompts/` directory with structure:

```yaml
name: base
version: "1.0.0"
description: Base personality
content: |
  Prompt text with {variables}
input_schema: []
output_schema: []
```

## Consequences

**Positive**
- Human-readable, diff-friendly
- Version control integration
- No code deploy for prompt updates
- Clear separation of concerns

**Negative**
- YAML parsing adds dependency
- Variable typos only caught at runtime
