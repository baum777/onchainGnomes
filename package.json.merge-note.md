# Merge Note: package.json

## Source
Incoming file: `package.json.incoming` (from horny-bot-persona-bundle)
Target: Repository root (no existing package.json - this is a Python project)

## Summary
The bundle provides Node.js dependencies for TypeScript meme rendering using Sharp.

## Dependencies Explained

### Runtime Dependencies
- `sharp` (^0.33.5) - High-performance image processing (PNG overlay, SVG composite)
- `js-yaml` (^4.1.0) - YAML parsing for template files

### Dev Dependencies
- `@types/node` (^22.10.2) - TypeScript types for Node.js
- `typescript` (^5.6.3) - TypeScript compiler
- `ts-node` (^10.9.2) - Direct TypeScript execution (added for convenience)

## Merge Instructions

### Option A: Create package.json (Recommended for hybrid setup)
Simply rename the incoming file:
```bash
mv package.json.incoming package.json
npm install
```

This creates a hybrid Python/Node.js repository where:
- Python handles the main bot logic
- TypeScript/Node.js handles meme rendering

### Option B: Skip Node.js setup
If you prefer to implement meme rendering in Python only:
1. Delete `package.json.incoming`
2. Delete `src/memes/` (TypeScript files)
3. Implement Python ports of the rendering logic using Pillow or similar

### Option C: Separate package for rendering
Move all TypeScript files to a subdirectory with its own package.json:
```bash
mkdir -p tools/meme-renderer
mv package.json.incoming tools/meme-renderer/package.json
mv src/memes tools/meme-renderer/src
mv scripts/render_demo.ts tools/meme-renderer/scripts/
```

## Post-Merge Steps

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Verify TypeScript compilation:
   ```bash
   npx tsc --noEmit
   ```

3. Test rendering:
   ```bash
   npm run render:demo
   ```

## CI/CD Considerations

Add to your GitHub Actions or CI pipeline:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '20'

- name: Install meme renderer dependencies
  run: npm ci

- name: Build TypeScript
  run: npm run build
```
