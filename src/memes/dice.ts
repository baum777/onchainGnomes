export type RNG = () => number; // returns [0,1)

export const cryptoRng: RNG = () => {
  // Node 20+: crypto randomness
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require("crypto");
  const buf: Buffer = randomBytes(4);
  const n = buf.readUInt32BE(0);
  return n / 0xffffffff;
};

export function rollInt(min: number, max: number, rng: RNG = Math.random): number {
  if (max < min) throw new Error("rollInt: max < min");
  const r = rng();
  return min + Math.floor(r * (max - min + 1));
}

export function pickOne<T>(arr: T[], rng: RNG = Math.random): T {
  if (!arr.length) throw new Error("pickOne: empty array");
  return arr[rollInt(0, arr.length - 1, rng)];
}

export function weightedPick<T extends string>(
  weights: Record<T, number>,
  rng: RNG = Math.random
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((a, [, w]) => a + Math.max(0, w), 0);
  if (total <= 0) throw new Error("weightedPick: total weight <= 0");

  let t = rng() * total;
  for (const [k, w0] of entries) {
    const w = Math.max(0, w0);
    t -= w;
    if (t <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
