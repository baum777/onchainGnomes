import { describe, it, expect } from "vitest";
import {
  assertPublicSafe,
  isPublicSafe,
  sanitizeForPublic,
  PublicGuardError,
} from "../../src/boundary/publicGuard.js";

describe("assertPublicSafe", () => {
  it("allows safe public text", () => {
    expect(() =>
      assertPublicSafe("You have been certified as exit liquidity.")
    ).not.toThrow();
  });

  it("blocks forbidden tokens like 'score'", () => {
    expect(() => assertPublicSafe("Your score is 100")).toThrow(PublicGuardError);
  });

  it("blocks forbidden tokens case-insensitively", () => {
    expect(() => assertPublicSafe("Your SCORE is high")).toThrow(PublicGuardError);
    expect(() => assertPublicSafe("Your Score is high")).toThrow(PublicGuardError);
  });

  it("blocks 'xp' token", () => {
    expect(() => assertPublicSafe("You gained 50 xp today")).toThrow(PublicGuardError);
  });

  it("blocks 'cooldown' token", () => {
    expect(() => assertPublicSafe("Cooldown active")).toThrow(PublicGuardError);
  });

  it("blocks 'threshold' token", () => {
    expect(() => assertPublicSafe("Threshold reached")).toThrow(PublicGuardError);
  });

  it("blocks 'trace' token", () => {
    expect(() => assertPublicSafe("Trace ID: abc123")).toThrow(PublicGuardError);
  });

  it("blocks 'risk' token", () => {
    expect(() => assertPublicSafe("Risk level low")).toThrow(PublicGuardError);
  });

  it("blocks 'telemetry' token", () => {
    expect(() => assertPublicSafe("Telemetry recorded")).toThrow(PublicGuardError);
  });

  it("blocks 'flag' token", () => {
    expect(() => assertPublicSafe("Flag set")).toThrow(PublicGuardError);
  });

  it("blocks 'level' token", () => {
    expect(() => assertPublicSafe("Level up!")).toThrow(PublicGuardError);
  });
});

describe("assertPublicSafe for /badge route", () => {
  it("blocks any digits for /badge route", () => {
    expect(() =>
      assertPublicSafe("Rank 5 achieved", { route: "/badge" })
    ).toThrow(PublicGuardError);
  });

  it("blocks 'rank' token for /badge route", () => {
    expect(() =>
      assertPublicSafe("Your rank is high", { route: "/badge" })
    ).toThrow(PublicGuardError);
  });

  it("allows badge text without digits or forbidden tokens", () => {
    expect(() =>
      assertPublicSafe("Certified Exit Liquidity", { route: "/badge" })
    ).not.toThrow();
  });

  it("allows playful badge labels", () => {
    expect(() =>
      assertPublicSafe("Market Trauma Survivor", { route: "/badge" })
    ).not.toThrow();
  });
});

describe("isPublicSafe", () => {
  it("returns true for safe text", () => {
    expect(isPublicSafe("Safe text here")).toBe(true);
  });

  it("returns false for unsafe text", () => {
    expect(isPublicSafe("Your score is high")).toBe(false);
  });

  it("returns false for badge with digits", () => {
    expect(isPublicSafe("Level 5", { route: "/badge" })).toBe(false);
  });
});

describe("sanitizeForPublic", () => {
  it("removes forbidden tokens", () => {
    const sanitized = sanitizeForPublic("Your score is high and xp is low");
    expect(sanitized).not.toContain("score");
    expect(sanitized).not.toContain("xp");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("preserves safe text structure", () => {
    const sanitized = sanitizeForPublic("You are certified");
    expect(sanitized).toBe("You are certified");
  });
});

describe("PublicGuardError", () => {
  it("includes violations in error", () => {
    try {
      assertPublicSafe("Your score and xp are high");
    } catch (err) {
      expect(err).toBeInstanceOf(PublicGuardError);
      expect((err as PublicGuardError).violations).toContain("score");
      expect((err as PublicGuardError).violations).toContain("xp");
    }
  });
});
