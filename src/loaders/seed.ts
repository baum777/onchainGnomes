import { createHash } from "crypto";

export type SeedableRNG = () => number;

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(seedKey: string): number {
  const hash = createHash("sha256").update(seedKey).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

export function createSeededRNG(seedKey: string): SeedableRNG {
  const seed = seedFromString(seedKey);
  return mulberry32(seed);
}
