/**
 * E2E: DedupeGuard — blocks duplicate mentions
 */

import { describe, it, expect } from "vitest";
import { dedupeCheckAndMark } from "../../src/ops/dedupeGuard.js";

describe("DedupeGuard", () => {
  it("blocks duplicate mentions", async () => {
    const id = "t_dupe_001";
    const a = await dedupeCheckAndMark(id, 60);
    expect(a.ok).toBe(true);

    const b = await dedupeCheckAndMark(id, 60);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe("already_processed");
  });
});
