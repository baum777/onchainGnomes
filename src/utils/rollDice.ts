/**
 * Roll-a-Dice — Deterministic PRNG per event
 *
 * Seeded by event_id for idempotency and reproducibility.
 * Same seed => same sequence of "random" values across runs.
 */

import { seedFromString } from "../loaders/seed.js";

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Dice = {
  seed: string;
  float: () => number; // 0..1
  int: (min: number, max: number) => number; // inclusive
  pick: <T>(arr: T[]) => T;
  chance: (p: number) => boolean;
};

/**
 * Create a deterministic Dice instance from a seed string.
 * Typical usage: rollDice(`${event.id}`) or rollDice(`${event.id}:${authorId}`)
 */
export function rollDice(seed: string): Dice {
  const numericSeed = seedFromString(seed);
  const rng = mulberry32(numericSeed);

  return {
    seed,

    float: () => rng(),

    int: (min: number, max: number) => {
      if (max < min) throw new Error("rollDice.int: max < min");
      const r = rng();
      return min + Math.floor(r * (max - min + 1));
    },

    pick: <T>(arr: T[]): T => {
      if (!arr.length) throw new Error("rollDice.pick: empty array");
      const idx = Math.floor(rng() * arr.length);
      return arr[idx]!;
    },

    chance: (p: number) => rng() < p,
  };
}
