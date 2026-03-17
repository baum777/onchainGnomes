/**
 * Swarm Composer — Multi-gnome reply composition
 *
 * Phase-3: Composes short multi-gnome replies.
 */

export interface SwarmLine {
  gnomeId: string;
  text: string;
}

/** Compose swarm reply lines; total length bounded. */
export function composeSwarmReply(
  lines: SwarmLine[],
  opts?: { maxTotalChars?: number; maxPerLine?: number },
): string {
  const maxTotal = opts?.maxTotalChars ?? 260;
  const maxPer = opts?.maxPerLine ?? 100;
  const trimmed = lines
    .map((l) => ({ ...l, text: l.text.slice(0, maxPer).trim() }))
    .filter((l) => l.text.length > 0);
  let result = trimmed.map((l) => `${l.gnomeId.toUpperCase()}: ${l.text}`).join("\n");
  if (result.length > maxTotal) result = result.slice(0, maxTotal - 3) + "...";
  return result;
}
