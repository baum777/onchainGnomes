# System Prompts

## Location

`prompts/system/`

## Available Prompts

### base.yaml
Base personality - identity, tone guidelines, safety rules.

### mentions.yaml
Reply to mentions - helpful, concise, matches conversation tone.

### posting.yaml
Autonomous posting - engaging, relevant content.

### commands.yaml
Command handling - responds to /help, /status, etc.

## Variables

Prompts use `{variable}` syntax for injection:

- `{context}` - Formatted conversation/context
- `{message}` - User's message
- `{available_commands}` - For help/commands prompt

## Versioning

Prompts include `version` field (semantic versioning).
Loader supports `prompt_loader.get("base", version="1.2.0")`.
