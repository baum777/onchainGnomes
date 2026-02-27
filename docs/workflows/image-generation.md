# Image Generation Workflow

## Status

Placeholder - media client stub exists.

## Planned Flow

1. User requests image (mention or command)
2. Parse image request from content
3. Use generate_image.yaml task prompt
4. Call xAI image API (when available)
5. Upload media to X
6. Post tweet with image attachment

## Dependencies

- xAI image generation API
- X media upload (v1.1 endpoint)
