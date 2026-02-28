export type MeasureFn = (text: string, fontSize: number) => number;

// Heuristic: average char width ≈ 0.55 * fontSize
export const heuristicMeasure: MeasureFn = (text, fontSize) => text.length * (0.55 * fontSize);

export function wrapText(text: string, maxWidth: number, fontSize: number, measure: MeasureFn): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (measure(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      if (measure(w, fontSize) > maxWidth) {
        lines.push(breakWord(w, maxWidth, fontSize, measure));
        current = "";
      } else {
        current = w;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function breakWord(word: string, maxWidth: number, fontSize: number, measure: MeasureFn): string {
  let out = "";
  for (const ch of word) {
    const test = out + ch;
    if (measure(test, fontSize) <= maxWidth) out = test;
    else break;
  }
  return out || word;
}

export function fitTextToBox(args: {
  text: string;
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  minFont: number;
  maxFont: number;
  lineHeight: number;
  measure: MeasureFn;
}): { fontSize: number; lines: string[] } {
  const { text, maxWidth, maxHeight, maxLines, minFont, maxFont, lineHeight, measure } = args;
  const clean = text.trim();
  if (!clean) return { fontSize: minFont, lines: [""] };

  for (let fs = maxFont; fs >= minFont; fs--) {
    const lines = wrapText(clean, maxWidth, fs, measure);
    if (lines.length > maxLines) continue;
    const heightNeeded = lines.length * fs * lineHeight;
    if (heightNeeded <= maxHeight) return { fontSize: fs, lines };
  }

  const lines = wrapText(clean, maxWidth, minFont, measure).slice(0, maxLines);
  return { fontSize: minFont, lines };
}
