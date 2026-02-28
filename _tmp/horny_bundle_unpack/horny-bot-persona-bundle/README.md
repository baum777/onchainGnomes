# $HORNY Evil Revival Persona + Meme Rendering Bundle (Sharp + SVG)

This bundle contains:
- Persona / lore / voice docs
- Prompt datasets (tweets, roast replies, captions)
- Image preset YAMLs
- Autopost narrative series
- Meme template YAMLs (zone variants + combos)
- A **Sharp + SVG** typography overlay engine (TypeScript) to render meme cards deterministically.

## Why Sharp + SVG
- **sharp** handles compositing + output fast (good for serverless).
- Text is rendered via **SVG overlays** generated from deterministic placement logic (zones + fit-to-box).

## Quick Start (local)
Requirements: Node 20+

```bash
cd horny-bot-persona-bundle
npm i
npm run build
npm run demo:render
```

Outputs demo images into `out/`.

## Notes
- Overlays in `memes/overlays/` are simple placeholders generated for this bundle.
- Replace them with your real brand assets anytime.
- Internal scoring/telemetry is **not** included in public outputs; keep that boundary in your bot runtime.
