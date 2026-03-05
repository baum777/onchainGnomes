/**
 * Stable hashing for deduplication.
 * Deterministic: same input => same hash (no Math.random).
 */

import { createHash } from "node:crypto";

export function stableHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
