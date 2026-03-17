# Mini Command DSL Documentation

## Overview

The Mini Command DSL provides deterministic, structured command handling for the autonomous X (Twitter) AI agent. It enables extensible bot interactions through a simple command syntax.

## Architecture

```
Mention → Parser → ParsedCommand → Router → ActionPlan → Brand Matrix → Workflow Execution
```

### Components

| Component | Purpose |
|-----------|---------|
| `Parser` | Deterministic command parsing |
| `Router` | Maps commands to action plans |
| `ActionPlan` | Defines what to execute |
| `Brand Matrix` | Content generation contract |
| `Executor` | Workflow execution |

## Supported Commands

### /ask
Ask a question and get a text response.

```
@bot /ask <question>
```

**Examples:**
```
@bot /ask What is DePIN?
@bot /ask Explain quantum computing
```

### /img
Generate an image with optional preset.

```
@bot /img preset=<name> prompt="<description>"
@bot /img <description>
```

**Examples:**
```
@bot /img preset=cyberpunk prompt="robot trader"
@bot /img preset=vaporwave prompt="sunset city"
@bot /img "a beautiful landscape"
```

**Available Presets:**
- `cyberpunk` - Futuristic, neon aesthetic
- `vaporwave` - Retro 80s style
- `abstract` - Abstract art
- `photorealistic` - Photo-like quality
- `glitch` - Digital distortion

### /remix
Remix existing content with energy and flavor.

```
@bot /remix energy=1..5 flavor=<flavor>
```

**Examples:**
```
@bot /remix energy=5 flavor=chaos
@bot /remix energy=3 flavor=zen
@bot /remix energy=4 flavor=neon
```

**Energy Levels:**
- `1-2` - Subtle, conservative
- `3` - Balanced (default)
- `4-5` - High intensity, creative

**Flavors:**
- `chaos` - Unpredictable, transformative
- `zen` - Harmonious, balanced
- `glitch` - Distorted, digital
- `ether` - Dreamy, ethereal
- `neon` - Futuristic, bright
- `vapor` - Nostalgic, retro

### /badge
Check your badge status and stats.

```
@bot /badge me
```

**Output:**
```
🏅 Level 3 | 42 Interactions | Badges: 🚀 ⚡
```

### /help
Get help information.

```
@bot /help
@bot /help <topic>
```

**Examples:**
```
@bot /help
@bot /help img
@bot /help remix
```

## Implementation

### File Structure

```
src/
├── commands/
│   ├── __init__.py
│   ├── parser.py       # Command parsing
│   ├── router.py       # Route to ActionPlan
│   ├── schemas.py      # Data models
│   ├── errors.py       # Error handling
│   └── executor.py     # Workflow execution
├── brand_matrix/
│   ├── __init__.py
│   ├── contract.py     # v2 contract
│   ├── classifier.py   # Classification logic
│   └── templates.py    # Template registry
└── prompts/
    └── image_presets.py  # Preset loader
```

### Adding New Commands

1. **Add to CommandName enum** (`schemas.py`):
```python
class CommandName(str, Enum):
    ASK = "ask"
    NEW_CMD = "new_cmd"  # Add here
```

2. **Add parser** (`parser.py`):
```python
def _parse_new_cmd_args(self, args_text: str) -> Tuple[Dict, Optional[Error]]:
    # Parse logic here
    return {"key": "value"}, None
```

3. **Add router handler** (`router.py`):
```python
def _route_new_cmd(self, parsed: ParsedCommand, context: Context) -> RouteResult:
    action_plan = ActionPlan(
        action_type=ActionType.NEW_TYPE,
        template_key="new_template",
        ...
    )
    return RouteResult(success=True, action_plan=action_plan)
```

4. **Add executor** (`executor.py`):
```python
async def _execute_new_cmd(self, plan, context, dry_run):
    # Execution logic
    return CommandResult(success=True, content="Result")
```

## Brand Matrix Integration

### v2 Contract Format

```json
{
  "user_prompt": "The user's prompt",
  "energy": 3,
  "flavor": "zen",
  "template_key": "text_default",
  "remix_of": null,
  "preview_request_id": null,
  "metadata": {}
}
```

### Template Mapping

| Action Type | Template Key |
|-------------|--------------|
| text_generation | text_default |
| image_generation | image_generation |
| remix_generation | remix_dynamic_{flavor} |
| badge_status | badge_status |
| help | help_system |

## State Extensions

### Tables Added

**user_profiles**
- Tracks user stats, badges, levels
- Updated on every interaction

**remix_chain**
- Tracks remix chains and originals
- Enables chain following

**command_history**
- Records all commands executed
- Enables analytics and debugging

### Usage

```python
# Get user stats
stats = await state_manager.get_user_stats(user_id)

# Record command
command_id = await state_manager.record_command(
    user_id=user_id,
    command_type="ask",
    metadata={...}
)

# Get original for remix
original = await state_manager.get_original_for_remix(tweet_id)
```

## Error Handling

All errors produce user-friendly messages:

| Error | Message |
|-------|---------|
| Unknown command | "Unbekanntes Command: /xyz. Verwende /help für verfügbare Commands." |
| Invalid energy | "Ungültiger Energie-Wert. Verwende einen Wert zwischen 1 und 5." |
| Invalid flavor | "Unbekannter Flavor: xyz. Verfügbare Flavors: chaos, zen, glitch, ether, neon, vapor" |
| Unknown preset | "Unbekanntes Preset: xyz. Verwende /help für verfügbare Presets." |

## Testing

Run tests:
```bash
pytest tests/test_command_parser.py
pytest tests/test_router.py
pytest tests/test_presets.py
```

## Examples

### Full Flow Example

```python
from src.commands.parser import CommandParser
from src.commands.router import CommandRouter
from src.brand_matrix.classifier import MatrixClassifier

# Parse
parser = CommandParser(bot_handles=["@mybot"])
result = parser.parse("@mybot /ask What is DePIN?", user_id="123")

# Route
router = CommandRouter()
route_result = router.route(result.parsed)

# Classify for Brand Matrix
classifier = MatrixClassifier()
matrix_result = classifier.classify(route_result.action_plan)

# Execute
# ... workflow execution
```

### Remix Chain Example

```python
# Original tweet
tweet_id = "tweet_abc123"

# First remix
result = parser.parse(
    "/remix energy=4 flavor=chaos",
    user_id="user1",
    remix_of=tweet_id
)

# Second remix (chain)
result2 = parser.parse(
    "/remix energy=5 flavor=glitch",
    user_id="user2",
    remix_of=tweet_id
)

# State tracks both as part of same chain
```

## Configuration

### Image Presets

Presets are defined in `prompts/presets/images/*.yaml`:

```yaml
name: cyberpunk
style_prompt: "cyberpunk style, neon lights..."
negative_prompt: "blurry, low quality..."
caption_template: "⚡ {prompt} | #Cyberpunk"
size: "1024x1024"
brand_rules:
  colors: ["neon blue", "purple"]
parameters:
  guidance_scale: 7.5
```

## Dry Run Mode

All commands support dry-run mode for testing:

```python
result = await executor.execute(action_plan, context, dry_run=True)
# Returns mock results without API calls
```

## Future Extensions

The DSL is designed for easy extension:
- New commands: Add parser + router + executor
- New flavors: Add to Flavor enum
- New presets: Add YAML files
- New templates: Add to TemplateRegistry
