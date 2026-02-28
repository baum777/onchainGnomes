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

  it("whitelist mode + not whitelisted => skip, no scoring", async () => {
    const whitelistConfig: ActivationConfig = {
      mode: "whitelist",
      whitelistUsernames: ["@twimsalot", "@nirapump_"],
      whitelistUserIds: [],
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
});
