import { PlacementInput, PlacementResult, ZonePlacement, PlacedLine } from "./types.js";
import { fitTextToBox, heuristicMeasure } from "./fitText.js";

export function computePlacements(input: PlacementInput): PlacementResult {
  const placements: ZonePlacement[] = [];

  for (const z of input.zones) {
    const raw = input.textByZone[z.key] ?? "";
    const text = (z.transform === "uppercase" ? raw.toUpperCase() : raw).trim();

    const innerW = Math.max(1, z.rect.w - z.padding * 2);
    const innerH = Math.max(1, z.rect.h - z.padding * 2);

    const { fontSize, lines } = fitTextToBox({
      text,
      maxWidth: innerW,
      maxHeight: innerH,
      maxLines: z.maxLines,
      minFont: z.minFont,
      maxFont: z.maxFont,
      lineHeight: z.lineHeight,
      measure: heuristicMeasure
    });

    const linePx = fontSize * z.lineHeight;
    const totalH = lines.length * linePx;

    let startY = z.rect.y + z.padding;
    if (z.baseline === "middle") startY = z.rect.y + (z.rect.h - totalH) / 2;
    if (z.baseline === "bottom") startY = z.rect.y + z.rect.h - z.padding - totalH;

    const placed: PlacedLine[] = lines.map((ln, i) => {
      const y = startY + i * linePx;

      // x based on alignment (heuristic width)
      const w = heuristicMeasure(ln, fontSize);
      let x = z.rect.x + z.padding;
      if (z.align === "center") x = z.rect.x + (z.rect.w - w) / 2;
      if (z.align === "right") x = z.rect.x + z.rect.w - z.padding - w;

      return { text: ln, x, y };
    });

    placements.push({
      zone: z.key,
      fontSize,
      fontFamily: z.fontFamily,
      fontWeight: z.fontWeight,
      align: z.align,
      lines: placed
    });
  }

  return { placements };
}
