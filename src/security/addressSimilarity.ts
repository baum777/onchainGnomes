/**
 * Address Similarity Detection - Protects against address poisoning
 * 
 * Uses Levenshtein distance and prefix collision detection to find
 * look-alike addresses that might be malicious.
 */

import { validateCA } from "../adapters/policy/caValidator.js";

/**
 * Calculates the Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    if (matrix[0]) matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      if (prevRow && currRow) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          currRow[j] = prevRow[j - 1] ?? 0;
        } else {
          currRow[j] = Math.min(
            (prevRow[j - 1] ?? 0) + 1, // substitution
            Math.min(
              (currRow[j - 1] ?? 0) + 1, // insertion
              (prevRow[j] ?? 0) + 1 // deletion
            )
          );
        }
      }
    }
  }

  const finalRow = matrix[b.length];
  return finalRow ? (finalRow[a.length] ?? 0) : 0;
}

/**
 * Detects if an address is suspiciously similar to a target (known) address
 */
export function detectAddressPoisoning(
  candidate: string,
  knownAddresses: string[],
  threshold: number = 3
): { suspicious: boolean; match?: string; distance?: number } {
  // First, basic format validation
  const validation = validateCA(candidate);
  if (!validation.valid) return { suspicious: false };

  for (const known of knownAddresses) {
    if (candidate === known) continue; // Exact match is okay (if on allowlist)

    const distance = levenshtein(candidate, known);
    
    // Check for Levenshtein proximity
    if (distance <= threshold) {
      return { suspicious: true, match: known, distance };
    }

    // Check for prefix/suffix collision (common in poisoning)
    const prefixLen = 4;
    const suffixLen = 4;
    if (
      candidate.slice(0, prefixLen) === known.slice(0, prefixLen) &&
      candidate.slice(-suffixLen) === known.slice(-suffixLen)
    ) {
      const match = known;
      return { suspicious: true, match, distance };
    }
  }

  return { suspicious: false };
}
