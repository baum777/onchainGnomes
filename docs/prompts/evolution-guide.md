# Prompt Evolution Guide

## Editing Prompts Safely

1. Edit YAML file in `prompts/` directory
2. Update `version` field if making significant changes
3. Test with `python scripts/dry_run.py`
4. Document changes in `docs/changelog/CHANGELOG.md`

## Adding New Prompts

1. Create YAML in appropriate subdirectory (system/tasks/presets/commands)
2. Include: name, version, description, content
3. Define variables with `{variable_name}` in content
4. Document in `docs/prompts/`

## Presets

Presets (witty, technical, casual) modify base behavior.
Loaded from `prompts/presets/`.
Future: modifiers will be injected into system prompt.
