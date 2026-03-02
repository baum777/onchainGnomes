import fs from "node:fs";
import path from "node:path";
import { buildMemeText } from "../src/memes/buildMemeText.js";
import { renderMemeSharp } from "../src/memes/render/renderMemeSharp.js";

const outDir = process.env.DEMO_OUTPUT_DIR || "out";
const baseImage = process.env.DEMO_INPUT_IMAGE || "assets/demo_base.png";

fs.mkdirSync(outDir, { recursive: true });

async function main() {
  for (let i = 0; i < 5; i++) {
    const meme = buildMemeText({
      userId: "demo-user",
      eligibleForHighRarity: true
    });

    // overlays (optional)
    const overlays = [
      "memes/overlays/glitch_frame.png",
      "memes/overlays/verdict_stamp.png",
      "memes/overlays/warning_label.png",
      "memes/overlays/horns_overlay.png"
    ].filter((p) => fs.existsSync(p));

    const outPath = path.join(outDir, `demo_${i + 1}_${meme.template}.png`);
    await renderMemeSharp({
      template: meme.template,
      baseImagePath: baseImage,
      overlayImagePaths: overlays,
      textByZone: meme.textByZone,
      outPath
    });

    console.log("Rendered:", outPath, "(rarity internal:", meme.rarity + ")");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
