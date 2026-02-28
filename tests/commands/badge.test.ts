import { describe, it, expect } from "vitest";
import {
  generateBadgeText,
  parseMention,
  RANK_TITLES,
} from "../../src/workflows/mentionWorkflow.js";
import { createSeededRNG } from "../../src/loaders/seed.js";
import { assertPublicSafe, isPublicSafe } from "../../src/boundary/publicGuard.js";

function hasDigits(text: string): boolean {
  return /\d/.test(text);
}

describe("/badge me command", () => {
  it("generates badge text without digits", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);

    expect(hasDigits(badgeText)).toBe(false);
  });

  it("generates badge text <= 280 chars", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);

    expect(badgeText.length).toBeLessThanOrEqual(280);
  });

  it("generates deterministic output for same seed", () => {
    const seedKey = "tweet_12345:user_67890";
    const badge1 = generateBadgeText(seedKey);
    const badge2 = generateBadgeText(seedKey);

    expect(badge1).toBe(badge2);
  });

  it("uses different RNG sequences for different seeds", () => {
    const rng1 = createSeededRNG("tweet_1:user_1");
    const rng2 = createSeededRNG("tweet_2:user_2");
    expect(rng1()).not.toBe(rng2());
  });

  it("contains only rank titles without numbers", () => {
    // Verify all rank titles have no digits
    for (const title of RANK_TITLES) {
      expect(hasDigits(title)).toBe(false);
    }
  });

  it("passes public guard for /badge route", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);

    expect(() =>
      assertPublicSafe(badgeText, { route: "/badge" })
    ).not.toThrow();
  });

  it("has no forbidden tokens", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);

    const forbiddenTokens = [
      "score", "xp", "threshold", "cooldown", "trace", "risk",
      "telemetry", "flag", "level", "rarity", "combo", "mythic", "epic"
    ];

    const lowerBadge = badgeText.toLowerCase();
    for (const token of forbiddenTokens) {
      expect(lowerBadge).not.toContain(token);
    }
  });

  it("isPublicSafe returns true for badge text", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);

    expect(isPublicSafe(badgeText, { route: "/badge" })).toBe(true);
  });
});

describe("parseMention for /badge", () => {
  it("parses '/badge me' command", () => {
    const parsed = parseMention("/badge me");

    expect(parsed.command).toBe("badge");
    expect(parsed.args.target).toBe("self");
  });

  it("parses 'badge me' without slash", () => {
    const parsed = parseMention("Hey bot, badge me");

    expect(parsed.command).toBe("badge");
    expect(parsed.args.target).toBe("self");
  });

  it("parses mixed case 'BADGE ME'", () => {
    const parsed = parseMention("BADGE ME");

    expect(parsed.command).toBe("badge");
  });
});

describe("Badge output format", () => {
  it("includes rank title on first line", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);
    const lines = badgeText.split("\n");

    // First non-empty line should be the rank title
    const firstLine = lines[0]?.trim() ?? "";
    const validTitles = RANK_TITLES;

    expect(validTitles).toContain(firstLine);
  });

  it("includes a tagline after the title", () => {
    const seedKey = "tweet_12345:user_67890";
    const badgeText = generateBadgeText(seedKey);

    // Should have at least 2 parts (title and tagline)
    expect(badgeText.length).toBeGreaterThan(20);
  });
});
