import sharp from "sharp";
import { computePlacements } from "../typography/placementEngine.js";
import { ZONE_PRESETS } from "../typography/presets.js";
import { placementsToSvg } from "./textToSvg.js";
import { TemplateKey } from "../rarity.js";

export type RenderMemeArgs = {
  template: TemplateKey;
  baseImagePath: string;             // 1024x1024 recommended
  overlayImagePaths?: string[];      // PNGs (transparent)
  textByZone: Record<string, string>;
  outPath: string;
  canvasSize?: number;              // default 1024
};

export async function renderMemeSharp(args: RenderMemeArgs): Promise<void> {
  const size = args.canvasSize ?? 1024;
  const zones = ZONE_PRESETS[args.template];

  const placements = computePlacements({
    canvasW: size,
    canvasH: size,
    zones,
    textByZone: args.textByZone as any
  });

  const svg = placementsToSvg({
    canvasW: size,
    canvasH: size,
    placements,
    style: {
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 8,
      paintOrder: "stroke fill",
      shadow: { dx: 2, dy: 2, blur: 2, color: "rgba(0,0,0,0.6)" }
    }
  });

  const base = sharp(args.baseImagePath).resize(size, size, { fit: "cover" });

  const composites: sharp.OverlayOptions[] = [];

  for (const p of args.overlayImagePaths ?? []) {
    composites.push({ input: p, top: 0, left: 0 });
  }

  composites.push({ input: svg, top: 0, left: 0 });

  await base
    .composite(composites)
    .png()
    .toFile(args.outPath);
}
