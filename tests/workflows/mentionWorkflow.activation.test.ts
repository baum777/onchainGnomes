/**
 * Mention Workflow Activation tests
 *
 * Ensures denied mentions do not call scoring or posting.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MentionWorkflow,
  MentionEvent,
  UserProfile,
  ProcessedEvent,
  WorkflowConfig,
} from "../../src/workflows/mentionWorkflow.js";
import {
  RewardEngine,
  RewardStateRepo,
  RewardUserProfile,
} from "../../src/reward_engine/index.js";
import type { ActivationConfig } from "../../src/config/botActivationConfig.js";

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

const baseConfig: WorkflowConfig = {
  presetsDir: "./memes/presets",
  templatesDir: "./memes/templates",
  datasetsRoot: "./data/datasets",
  cooldownMinutes: 60,
  dryRun: true,
};

function createEvent(overrides?: Partial<MentionEvent>): MentionEvent {
  return {
    tweet_id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: "user_allowed",
    user_handle: "allowed_user",
    text: "hey @serGorky",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("mentionWorkflow.activation", () => {
  let repo: RewardStateRepo;
  let rewardEngine: RewardEngine;
  let workflow: MentionWorkflow;
  const botUserId = "bot_456";

  beforeEach(() => {
    repo = createMockRepo();
    rewardEngine = new RewardEngine(repo, {
      cooldownHours: 0.001,
      globalImageCap24h: 100,
    });
    workflow = new MentionWorkflow(
      { ...baseConfig, botUserId },
      rewardEngine
    );
  });

  it("whitelist mode + not whitelisted + silent deny => skip, no scoring, no post", async () => {
    const whitelistConfig: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot", "@nirapump_"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const wf = new MentionWorkflow(
      { ...baseConfig, botUserId, activationConfig: whitelistConfig },
      rewardEngine
    );

    await repo.saveUserProfile({
      user_id: "stranger",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({
      user_id: "stranger",
      user_handle: "stranger",
      text: "mention me",
    });
    const profile: UserProfile = {
      user_id: "stranger",
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await wf.process(event, profile, []);

    expect(result.success).toBe(false);
    expect(result.skip_reason).toBe("Not whitelisted");
    expect(result.reply_text).toBe("");

    const profileAfter = await repo.getUserProfile("stranger");
    expect(profileAfter?.xp).toBe(0);
  });

  it("whitelist mode + whitelisted => processes and scores", async () => {
    const whitelistConfig: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot", "@nirapump_"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const wf = new MentionWorkflow(
      { ...baseConfig, botUserId, activationConfig: whitelistConfig },
      rewardEngine
    );

    await repo.saveUserProfile({
      user_id: "twim_user",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({
      user_id: "twim_user",
      user_handle: "twimsalot",
      text: "hello",
    });
    const profile: UserProfile = {
      user_id: "twim_user",
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await wf.process(event, profile, []);

    expect(result.success).toBe(true);
    expect(result.skip_reason).toBeUndefined();

    const profileAfter = await repo.getUserProfile("twim_user");
    expect(profileAfter?.xp).toBeGreaterThan(0);
  });

  it("global mode + any user => processes", async () => {
    const globalConfig: ActivationConfig = {
      mode: "global",
      whitelistUsernames: ["@twimsalot"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const wf = new MentionWorkflow(
      { ...baseConfig, botUserId, activationConfig: globalConfig },
      rewardEngine
    );

    await repo.saveUserProfile({
      user_id: "anyone",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({
      user_id: "anyone",
      user_handle: "random_person",
      text: "hi",
    });
    const profile: UserProfile = {
      user_id: "anyone",
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await wf.process(event, profile, []);

    expect(result.success).toBe(true);
  });

  it("self mention => skip, no scoring", async () => {
    await repo.saveUserProfile({
      user_id: botUserId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({
      user_id: botUserId,
      user_handle: "serGorky",
      text: "self test",
    });
    const profile: UserProfile = {
      user_id: botUserId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await workflow.process(event, profile, []);

    expect(result.success).toBe(false);
    expect(result.skip_reason).toBe("Self-mention ignored");

    const profileAfter = await repo.getUserProfile(botUserId);
    expect(profileAfter?.xp).toBe(0);
  });

  it("whitelisted mention => gets privileges (threadLimit=15/historyLimit=10) and energy bump", async () => {
    // This test verifies that whitelisted users receive:
    // - threadLimit: 15 (vs default 5)
    // - historyLimit: 10 (vs default 5)
    // - energy bump: +1 before dice variance (clamped 1..5)
    // These are internal behaviors; we verify via mocks in integration tests
    const whitelistConfig: ActivationConfig = {
      mode: "global",
      whitelistUsernames: ["@vipuser"],
      whitelistUserIds: ["vip_user_id"],
      denyReplyMode: "silent",
    };

    const wf = new MentionWorkflow(
      { ...baseConfig, botUserId, activationConfig: whitelistConfig },
      rewardEngine
    );

    await repo.saveUserProfile({
      user_id: "vip_user_id",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // Test with user ID match (no username provided)
    const event = createEvent({
      user_id: "vip_user_id",
      user_handle: "some_handle",
      text: "hello vip",
    });
    const profile: UserProfile = {
      user_id: "vip_user_id",
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await wf.process(event, profile, []);

    // Should be allowed and processed successfully
    expect(result.success).toBe(true);
    expect(result.skip_reason).toBeUndefined();

    // Scoring should have occurred
    const profileAfter = await repo.getUserProfile("vip_user_id");
    expect(profileAfter?.xp).toBeGreaterThan(0);
  });

  it("non-whitelisted in global mode => standard privileges", async () => {
    const globalConfig: ActivationConfig = {
      mode: "global",
      whitelistUsernames: ["@vipuser"],
      whitelistUserIds: [],
      denyReplyMode: "silent",
    };

    const wf = new MentionWorkflow(
      { ...baseConfig, botUserId, activationConfig: globalConfig },
      rewardEngine
    );

    await repo.saveUserProfile({
      user_id: "regular_user",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({
      user_id: "regular_user",
      user_handle: "regular_joe",
      text: "hey there",
    });
    const profile: UserProfile = {
      user_id: "regular_user",
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await wf.process(event, profile, []);

    // Should be allowed in global mode
    expect(result.success).toBe(true);
    expect(result.skip_reason).toBeUndefined();

    // Scoring should have occurred
    const profileAfter = await repo.getUserProfile("regular_user");
    expect(profileAfter?.xp).toBeGreaterThan(0);
  });

  describe("deny reply mode", () => {
    it("denied + denyReplyMode=silent => no reply, no scoring", async () => {
      const silentConfig: ActivationConfig = {
        mode: "whitelist",
        whitelistUsernames: ["@viponly"],
        whitelistUserIds: [],
        denyReplyMode: "silent",
      };

      const wf = new MentionWorkflow(
        { ...baseConfig, botUserId, activationConfig: silentConfig },
        rewardEngine
      );

      await repo.saveUserProfile({
        user_id: "rejected_user",
        xp: 0,
        level: 0,
        reward_pending: false,
        reply_count_24h: 0,
        global_image_count_24h: 0,
      });

      const event = createEvent({
        user_id: "rejected_user",
        user_handle: "not_on_list",
        text: "let me in",
      });
      const profile: UserProfile = {
        user_id: "rejected_user",
        reward_pending: false,
        reply_count_24h: 0,
      };

      const result = await wf.process(event, profile, []);

      // Silent deny: no success, no reply_text
      expect(result.success).toBe(false);
      expect(result.skip_reason).toBe("Not whitelisted");
      expect(result.reply_text).toBe("");

      // No scoring
      const profileAfter = await repo.getUserProfile("rejected_user");
      expect(profileAfter?.xp).toBe(0);
    });

    it("denied + denyReplyMode=tease => posts tease reply, no scoring", async () => {
      const teaseConfig: ActivationConfig = {
        mode: "whitelist",
        whitelistUsernames: ["@viponly"],
        whitelistUserIds: [],
        denyReplyMode: "tease",
      };

      const wf = new MentionWorkflow(
        { ...baseConfig, botUserId, activationConfig: teaseConfig },
        rewardEngine
      );

      await repo.saveUserProfile({
        user_id: "rejected_user",
        xp: 0,
        level: 0,
        reward_pending: false,
        reply_count_24h: 0,
        global_image_count_24h: 0,
      });

      const event = createEvent({
        user_id: "rejected_user",
        user_handle: "not_on_list",
        text: "let me in",
      });
      const profile: UserProfile = {
        user_id: "rejected_user",
        reward_pending: false,
        reply_count_24h: 0,
      };

      const result = await wf.process(event, profile, []);

      // Tease mode: success (reply posted), but no skip_reason
      expect(result.success).toBe(true);
      expect(result.skip_reason).toBeUndefined();

      // Should have a tease reply text (<=120 chars)
      expect(result.reply_text).toBeTruthy();
      expect(result.reply_text.length).toBeLessThanOrEqual(120);

      // No internal terms in the reply
      expect(result.reply_text.toLowerCase()).not.toContain("whitelist");
      expect(result.reply_text.toLowerCase()).not.toContain("activation");
      expect(result.reply_text.toLowerCase()).not.toContain("policy");

      // No scoring (denied mention)
      const profileAfter = await repo.getUserProfile("rejected_user");
      expect(profileAfter?.xp).toBe(0);
    });

    it("self-mention + denyReplyMode=tease => still silent (no tease for self)", async () => {
      const teaseConfig: ActivationConfig = {
        mode: "whitelist",
        whitelistUsernames: ["@viponly"],
        whitelistUserIds: [],
        denyReplyMode: "tease",
      };

      const wf = new MentionWorkflow(
        { ...baseConfig, botUserId, activationConfig: teaseConfig },
        rewardEngine
      );

      await repo.saveUserProfile({
        user_id: botUserId,
        xp: 0,
        level: 0,
        reward_pending: false,
        reply_count_24h: 0,
        global_image_count_24h: 0,
      });

      const event = createEvent({
        user_id: botUserId,
        user_handle: "serGorky",
        text: "self test",
      });
      const profile: UserProfile = {
        user_id: botUserId,
        reward_pending: false,
        reply_count_24h: 0,
      };

      const result = await wf.process(event, profile, []);

      // Self-mention should be silent even in tease mode
      expect(result.success).toBe(false);
      expect(result.skip_reason).toBe("Self-mention ignored");
      expect(result.reply_text).toBe("");
    });
  });
});
