/**
 * Seeded RNG for deterministic stress tests.
 * Uses xorshift32-inspired algorithm from string hash.
 * No Math.random() - fully reproducible.
 */

export function seededRng(seedStr: string): () => number {
  // FNV-1a style hash
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;

  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 0) / 4294967296;
  };
}
