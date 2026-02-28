/**
 * Public text guard in mentionWorkflow
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MentionWorkflow,
  MentionEvent,
  UserProfile,
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

describe("mentionWorkflow.publicGuard", () => {
  let repo: RewardStateRepo;
  let workflow: MentionWorkflow;

  beforeEach(() => {
    repo = createMockRepo();
    const rewardEngine = new RewardEngine(repo, {
      cooldownHours: 0.001,
      globalImageCap24h: 100,
    });
    workflow = new MentionWorkflow(baseConfig, rewardEngine);
  });

  it("reply never contains internal tokens (score, xp, threshold, trace)", async () => {
    await repo.saveUserProfile({
      user_id: "u1",
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event: MentionEvent = {
      tweet_id: "ev1",
      user_id: "u1",
      user_handle: "u1",
      text: "hello",
      created_at: new Date().toISOString(),
    };
    const profile: UserProfile = { user_id: "u1", reward_pending: false, reply_count_24h: 0 };

    const result = await workflow.process(event, profile, []);

    expect(result.success).toBe(true);
    const lower = result.reply_text.toLowerCase();
    expect(lower).not.toContain("score");
    expect(lower).not.toContain("xp");
    expect(lower).not.toContain("threshold");
    expect(lower).not.toContain("trace_id");
    expect(lower).not.toContain("cooldown");
  });
});
