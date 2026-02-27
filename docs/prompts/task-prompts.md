# Task Prompts

## Location

`prompts/tasks/`

## Available Tasks

### summarize.yaml
Summarizes conversation - input: conversation_history, max_length.

### generate_image.yaml
Creates image generation prompt from user request - input: user_request, style.

## Usage

Task prompts are loaded for specific workflows:
```python
prompt_loader.get("summarize", category="tasks", variables={...})
```
