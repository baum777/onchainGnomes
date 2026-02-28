# GORKY Bot — Run Instructions

Node-only production runtime for the GORKY X bot persona.

## Prerequisites

- Node.js >= 20.0.0
- npm oder yarn

## Installation

```bash
# Install dependencies
npm install

# TypeScript build
npm run build
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:

```env
# X API (OAuth 1.0a)
X_API_KEY=your_key
X_API_SECRET=your_secret
X_ACCESS_TOKEN=your_token
X_ACCESS_SECRET=your_access_secret

# xAI API
XAI_API_KEY=your_xai_key

# GORKY Configuration
GORKY_BRAND_NAME=GORKY
GORKY_REPLY_COOLDOWN_MINUTES=5
GORKY_IMAGE_REWARD_COOLDOWN_HOURS=24
```

## Demo Render

Test the meme rendering pipeline:

```bash
# Creates output in out/ directory
npm run demo:render
```

Output:
- `out/demo_*.png` — Rendered meme variations

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run typecheck
```

### Test Coverage

- **Boundary Tests**: `tests/boundary/publicGuard.test.ts`
  - Validates no internal metadata leaks
  - `/badge me` has no digits

- **Command Tests**: `tests/commands/badge.test.ts`
  - Badge generation
  - Safety constraints

- **Determinism Tests**: `tests/golden/determinism.test.ts`
  - Seeded RNG stability
  - Caption/Template picking consistency

- **Loader Tests**: `tests/loaders/`
  - Preset/template loading
  - Dataset parsing

## DRY_RUN Mode

Test without posting:

```env
DRY_RUN=true
```

In DRY_RUN mode:
- No actual tweets posted
- Media rendered to `out/` directory
- Logs show intended actions

## Project Structure

```
src/
├── loaders/           # YAML loaders, resolvers, pickers
│   ├── presetLoader.ts
│   ├── templateLoader.ts
│   ├── resolver.ts
│   ├── datasetLoader.ts
│   ├── captionPicker.ts
│   ├── seed.ts
│   └── index.ts
├── memes/             # Meme rendering pipeline
│   ├── render/
│   ├── typography/
│   ├── templateTextPicker.ts
│   ├── buildMemeText.ts
│   └── ...
├── boundary/          # Public/Private safety
│   └── publicGuard.ts
├── workflows/         # Mention workflow
│   └── mentionWorkflow.ts
└── ...

tests/
├── boundary/          # Safety tests
├── commands/          # Command tests
├── golden/            # Determinism tests
└── loaders/           # Loader tests

memes/
├── templates/         # YAML template definitions
└── overlays/          # PNG overlay assets

prompts/
├── presets/images/    # Image generation presets
├── datasets/          # Caption/reply banks
└── system/            # System prompts
```

## Key Design Principles

1. **Determinism**: Same `tweet_id` → same output
2. **Safety**: `assertPublicSafe()` blocks all internal metadata
3. **Idempotency**: Events tracked in `processed_events`
4. **DRY_RUN**: Safe testing without side effects

## Commands

| Command | Description |
|---------|-------------|
| `/badge me` | Returns rank title + tagline (no numbers) |
| `/img preset=x` | Generates image with preset |
| `/ask ...` | Text-only reply |

## Troubleshooting

**Build fails**: Ensure Node >= 20
```bash
node --version
```

**Sharp native errors**: Rebuild dependencies
```bash
npm rebuild sharp
```

**Missing assets**: Verify paths in `.env`
```env
ASSETS_BASE_PATH=assets/demo_base.png
MEME_OVERLAYS_PATH=memes/overlays
```
