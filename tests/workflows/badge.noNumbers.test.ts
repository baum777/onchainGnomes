/**
 * Badge Workflow No Numbers Tests
 *
 * Tests that:
 * - /badge me reply contains NO digits
 * - Only rank_title labels are output
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MentionWorkflow,
  MentionEvent,
  UserProfile,
  WorkflowConfig,
  generateBadgeText,
  parseMention,
} from "../../src/workflows/mentionWorkflow.js";
import {
  RewardEngine,
  RewardStateRepo,
  RewardUserProfile,
} from "../../src/reward_engine/index.js";
import { assertPublicSafe } from "../../src/boundary/publicGuard.js";

// Mock repository
function createMockRepo(): RewardStateRepo {
  const profiles = new Map<string, RewardUserProfile>();
  const processedEvents = new Set<string>();
  let globalImageCount = 0;

  return {
    async getUserProfile(userId: string) {
      return profiles.get(userId) ?? null;
    },
    async saveUserProfile(profile: RewardUserProfile) {
      profiles.set(profile.user_id, { ...profile });
    },
    async isEventProcessed(eventId: string) {
      return processedEvents.has(eventId);
    },
    async markEventProcessed(eventId: string) {
      processedEvents.add(eventId);
    },
    async getGlobalImageCount24h() {
      return globalImageCount;
    },
    async incrementGlobalImageCount() {
      globalImageCount++;
    },
  };
}

const mockConfig: WorkflowConfig = {
  presetsDir: "./memes/presets",
  templatesDir: "./memes/templates",
  datasetsRoot: "./data/datasets",
  cooldownMinutes: 60,
  dryRun: true,
};

function createMentionEvent(overrides?: Partial<MentionEvent>): MentionEvent {
  return {
    tweet_id: `tweet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: "user_123",
    user_handle: "testuser",
    text: "Hello @gorky",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("badge.noNumbers", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let rewardEngine: RewardEngine;
  let workflow: MentionWorkflow;

  beforeEach(() => {
    repo = createMockRepo();
    rewardEngine = new RewardEngine(repo, {
      cooldownHours: 0.001,
      globalImageCap24h: 100,
    });
    workflow = new MentionWorkflow(mockConfig, rewardEngine);
  });

  it("generateBadgeText should never output digits", () => {
    // Test many different seeds to ensure no digits slip through
    for (let i = 0; i < 50; i++) {
      const seedKey = `test_seed_${i}_${Date.now()}`;
      const badgeText = generateBadgeText(seedKey);

      // Should NOT contain any digits
      expect(badgeText).not.toMatch(/\d/);

      // Should contain only letters, spaces, punctuation
      expect(badgeText.length).toBeGreaterThan(0);
    }
  });

  it("/badge me command should return reply without numbers", async () => {
    const userId = "user_badge_test";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 100,
      level: 1,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({
      user_id: userId,
      text: "/badge me",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await workflow.process(event, profile, []);

    expect(result.success).toBe(true);
    expect(result.mode).toBe("TEXT");

    // CRITICAL: Reply must contain NO digits
    expect(result.reply_text).not.toMatch(/\d/);

    // Should contain a rank title
    const rankTitles = [
      "Certified Exit Liquidity",
      "Liquidity Ghost",
      "Market Trauma Survivor",
      "Chart Graveyard Wanderer",
      "Bag Holder Supreme",
      "Rekt Academy Graduate",
      "Wash Trade Detector",
      "Dead Coin Reviver",
      "FOMO Felon",
      "Rug Pull Survivor",
    ];

    const hasRankTitle = rankTitles.some((title) =>
      result.reply_text.includes(title)
    );
    expect(hasRankTitle).toBe(true);
  });

  it("badge text should pass publicGuard with /badge route", () => {
    for (let i = 0; i < 30; i++) {
      const seedKey = `guard_test_${i}_${Date.now()}`;
      const badgeText = generateBadgeText(seedKey);

      // Should NOT throw - meaning it passes the guard
      expect(() => {
        assertPublicSafe(badgeText, { route: "/badge" });
      }).not.toThrow();
    }
  });

  it("badge reply should never contain forbidden tokens", async () => {
    const userId = "user_badge_forbidden";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 200,
      level: 2,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({
      user_id: userId,
      text: "badge me please!",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await workflow.process(event, profile, []);

    const forbiddenTokens = [
      "score",
      "xp",
      "threshold",
      "cooldown",
      "trace",
      "flag",
      "level",
      "internal",
      "meta",
      "rank", // rank is blocked for badge route
      "points",
      "tier",
      "grade",
      "rating",
    ];

    const lowerText = result.reply_text.toLowerCase();
    for (const token of forbiddenTokens) {
      expect(lowerText).not.toContain(token);
    }
  });

  it("parseMention should correctly identify badge command", () => {
    const tests = [
      { text: "/badge me", expectedCommand: "badge" },
      { text: "badge me", expectedCommand: "badge" },
      { text: "/badge", expectedCommand: "badge" },
    ];

    for (const test of tests) {
      const parsed = parseMention(test.text);
      expect(parsed.command).toBe(test.expectedCommand);
      expect(parsed.args.target).toBe("self");
    }
  });

  it("badge output should be deterministic for same seed", () => {
    const seedKey = "deterministic_test_seed";
    const run1 = generateBadgeText(seedKey);
    const run2 = generateBadgeText(seedKey);
    const run3 = generateBadgeText(seedKey);

    expect(run1).toBe(run2);
    expect(run2).toBe(run3);
  });

  it("badge output should vary with different seeds", () => {
    // Not strictly required but good to verify
    const outputs = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const seedKey = `variance_test_${i}`;
      outputs.add(generateBadgeText(seedKey));
    }

    // Should have at least some variation
    expect(outputs.size).toBeGreaterThan(1);
  });

  it("badge should work via workflow with different users", async () => {
    // Use more users to reduce collision chance (10 badges, 3 users = 27% collision chance)
    const userIds = ["user_a", "user_b", "user_c", "user_d", "user_e"];
    const replies: string[] = [];

    for (const userId of userIds) {
      await repo.saveUserProfile({
        user_id: userId,
        xp: 100,
        level: 1,
        reward_pending: false,
        reply_count_24h: 0,
        global_image_count_24h: 0,
      });

      const event = createMentionEvent({
        user_id: userId,
        tweet_id: `badge_test_${userId}_${Date.now()}`, // Unique tweet_id for each
        text: "/badge me",
      });

      const profile: UserProfile = {
        user_id: userId,
        reward_pending: false,
        reply_count_24h: 0,
      };

      const result = await workflow.process(event, profile, []);
      expect(result.success).toBe(true);

      // CRITICAL: No digits in any reply
      expect(result.reply_text).not.toMatch(/\d/);
      replies.push(result.reply_text);
    }

    // Most should be different (statistically unlikely all 5 are same)
    const uniqueReplies = new Set(replies);
    expect(uniqueReplies.size).toBeGreaterThanOrEqual(2); // At least 2 different badges
  });
});
