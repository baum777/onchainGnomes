/**
 * E2E: RateLimiter — token bucket enforcement
 */

import { describe, it, expect } from "vitest";
import { rateLimitTake } from "../../src/ops/rateLimiter.js";

describe("RateLimiter", () => {
  it("rate limits when capacity exceeded", async () => {
    const id = "bot_test_" + Date.now();
    const a = await rateLimitTake({
      scope: "global",
      id,
      capacity: 2,
      refillPerMinute: 2,
    });
    const b = await rateLimitTake({
      scope: "global",
      id,
      capacity: 2,
      refillPerMinute: 2,
    });
    const c = await rateLimitTake({
      scope: "global",
      id,
      capacity: 2,
      refillPerMinute: 2,
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.retryAfterMs).toBeGreaterThan(0);
  });
});
