/**
 * Repair Strategies — shorten, neutralize, swap_closer
 * Used when validation fails softly.
 */

import type { CanonicalMode } from "../canonical/types.js";
import { getHardMax } from "../canonical/modeBudgets.js";

/** Predefined safe closers for swap_closer strategy */
export const SAFE_CLOSERS: string[] = [
  "The data tells the story.",
  "Standard pattern.",
  "As always.",
  "Nothing new.",
];

/**
 * Shorten text to fit within mode budget.
 * Truncates at sentence boundary when possible.
 */
export function shortenText(text: string, mode: CanonicalMode): string {
  const max = getHardMax(mode);
  if (max === 0 || text.length <= max) return text;

  const truncated = text.slice(0, max - 3);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastPeriod > max * 0.5) {
    return truncated.slice(0, lastPeriod + 1).trim();
  }
  if (lastSpace > max * 0.5) {
    return truncated.slice(0, lastSpace).trim() + "...";
  }
  return truncated.trim() + "...";
}

/**
 * Neutralize potentially aggressive phrasing.
 * Replaces "you are" style phrases with more detached alternatives.
 */
export function neutralizePhrasing(text: string): string {
  let result = text;

  const neutralizations: Array<[RegExp, string]> = [
    [/you are (?:so |such a )?(?:stupid|dumb|wrong|bad)/gi, "The claim doesn't hold."],
    [/your (?:bags|position|trade) (?:are|is) (?:rekt|trash|garbage)/gi, "Position status: unclear."],
    [/you (?:don't|do not) (?:understand|get it)/gi, "Interpretation varies."],
  ];

  for (const [pattern, replacement] of neutralizations) {
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}

/**
 * Swap the last sentence with a safe closer.
 * Used when structure/mode_match fails.
 */
export function swapCloser(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) {
    const hash = simpleHash(text);
    const closer = SAFE_CLOSERS[hash % SAFE_CLOSERS.length]!;
    return `${text.trimEnd().replace(/[.!?]+$/, "")}. ${closer}`;
  }

  const hash = simpleHash(text);
  const closer = SAFE_CLOSERS[hash % SAFE_CLOSERS.length]!;
  const withoutLast = sentences.slice(0, -1).join(" ").trim();
  return `${withoutLast} ${closer}`;
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
