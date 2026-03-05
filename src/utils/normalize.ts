/**
 * Normalizes strings for stable hashing and deduplication.
 * Deterministic: same semantic content => same normalized output.
 */

export function normalizeForHashing(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/([!?.])\1+/g, "$1")
    .replace(/\s*([!?.])\s*/g, "$1 ");
}
