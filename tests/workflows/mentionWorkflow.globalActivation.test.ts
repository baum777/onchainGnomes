/**
 * Global Activation + Self-Mention + Aggression tests
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
    user_id: "user_abc",
    user_handle: "human",
    text: "hey @serGorky",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("mentionWorkflow.globalActivation", () => {
  let repo: RewardStateRepo;
  let rewardEngine: RewardEngine;
  let workflow: MentionWorkflow;

  beforeEach(() => {
    repo = createMockRepo();
    rewardEngine = new RewardEngine(repo, {
      cooldownHours: 0.001,
      globalImageCap24h: 100,
    });
    workflow = new MentionWorkflow(baseConfig, rewardEngine);
  });

  it("processes any mention (no whitelist gating)", async () => {
    await repo.saveUserProfile({
      user_id: "user_abc",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({ text: "random mention no command" });
    const profile: UserProfile = { user_id: "user_abc", reward_pending: false, reply_count_24h: 0 };

    const result = await workflow.process(event, profile, []);
    expect(result.success).toBe(true);
    expect(result.skip_reason).toBeUndefined();
  });

  it("skips self-mention when botUserId set", async () => {
    const botId = "bot_123";
    const configWithBot: WorkflowConfig = { ...baseConfig, botUserId: botId };
    const wf = new MentionWorkflow(configWithBot, rewardEngine);

    await repo.saveUserProfile({
      user_id: botId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({ user_id: botId, text: "self reply" });
    const profile: UserProfile = { user_id: botId, reward_pending: false, reply_count_24h: 0 };

    const result = await wf.process(event, profile, []);
    expect(result.success).toBe(false);
    expect(result.skip_reason).toBe("Self-mention ignored");
  });

  it("idempotency prevents double reply", async () => {
    await repo.saveUserProfile({
      user_id: "user_xyz",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({ user_id: "user_xyz", tweet_id: "dup_1" });
    const profile: UserProfile = { user_id: "user_xyz", reward_pending: false, reply_count_24h: 0 };
    const processed: ProcessedEvent[] = [
      { event_id: "dup_1", processed_at: new Date().toISOString() },
    ];

    const result = await workflow.process(event, profile, processed);
    expect(result.success).toBe(false);
    expect(result.skip_reason).toBe("Event already processed");
  });
});

describe("mentionWorkflow.aggressionRhymeOverride", () => {
  let repo: RewardStateRepo;
  let rewardEngine: RewardEngine;
  let workflow: MentionWorkflow;

  beforeEach(() => {
    repo = createMockRepo();
    rewardEngine = new RewardEngine(repo, {
      cooldownHours: 0.001,
      globalImageCap24h: 100,
    });
    workflow = new MentionWorkflow(baseConfig, rewardEngine);
  });

  it("aggressive text triggers rhyme-style reply", async () => {
    await repo.saveUserProfile({
      user_id: "angry_user",
      xp: 500,
      level: 2,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createEvent({
      user_id: "angry_user",
      text: "You stupid bot shut up",
    });
    const profile: UserProfile = {
      user_id: "angry_user",
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await workflow.process(event, profile, []);
    expect(result.success).toBe(true);
    expect(result.reply_text.length).toBeGreaterThan(0);
  });
});
