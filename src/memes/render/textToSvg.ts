import { PlacementResult } from "../typography/types.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SvgTextStyle = {
  fill?: string;          // default white
  stroke?: string;        // default black
  strokeWidth?: number;   // default 6
  paintOrder?: "stroke fill" | "fill stroke";
  shadow?: { dx: number; dy: number; blur: number; color: string };
};

export function placementsToSvg(args: {
  canvasW: number;
  canvasH: number;
  placements: PlacementResult;
  style?: SvgTextStyle;
}): Buffer {
  const fill = args.style?.fill ?? "#ffffff";
  const stroke = args.style?.stroke ?? "#000000";
  const strokeWidth = args.style?.strokeWidth ?? 6;
  const paintOrder = args.style?.paintOrder ?? "stroke fill";
  const shadow = args.style?.shadow;

  const filterDef = shadow
    ? `<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
         <feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur}" flood-color="${shadow.color}" />
       </filter>`
    : "";

  const filterAttr = shadow ? ` filter="url(#shadow)"` : "";

  const lines: string[] = [];
  for (const z of args.placements.placements) {
    for (const ln of z.lines) {
      // baseline tweaks: SVG uses y as baseline; we nudge by fontSize
      const y = ln.y + z.fontSize;
      const x = ln.x;

      lines.push(
        `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}"
          font-family="${esc(z.fontFamily)}"
          font-size="${z.fontSize}"
          font-weight="${z.fontWeight}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="${strokeWidth}"
          paint-order="${paintOrder}"${filterAttr}>${esc(ln.text)}</text>`
      );
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${args.canvasW}" height="${args.canvasH}" viewBox="0 0 ${args.canvasW} ${args.canvasH}">
  <defs>
    ${filterDef}
  </defs>
  ${lines.join("\n")}
</svg>`;

  return Buffer.from(svg);
}
