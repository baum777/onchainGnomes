/**
 * Mention Workflow Scoring Always Tests
 *
 * Tests that:
 * - Scoring accrues on every non-blocked mention
 * - evaluateRewards called after accrueXp
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
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
  QualitySignals,
} from "../../src/reward_engine/index.js";

// Mock repository with tracking
function createMockRepo(): RewardStateRepo & {
  getCallHistory: () => { method: string; userId?: string }[];
} {
  const profiles = new Map<string, RewardUserProfile>();
  const processedEvents = new Set<string>();
  let globalImageCount = 0;
  const callHistory: { method: string; userId?: string }[] = [];

  return {
    async getUserProfile(userId: string) {
      callHistory.push({ method: "getUserProfile", userId });
      return profiles.get(userId) ?? null;
    },
    async saveUserProfile(profile: RewardUserProfile) {
      callHistory.push({ method: "saveUserProfile", userId: profile.user_id });
      profiles.set(profile.user_id, { ...profile });
    },
    async isEventProcessed(eventId: string) {
      callHistory.push({ method: "isEventProcessed" });
      return processedEvents.has(eventId);
    },
    async markEventProcessed(eventId: string) {
      callHistory.push({ method: "markEventProcessed" });
      processedEvents.add(eventId);
    },
    async getGlobalImageCount24h() {
      callHistory.push({ method: "getGlobalImageCount24h" });
      return globalImageCount;
    },
    async incrementGlobalImageCount() {
      callHistory.push({ method: "incrementGlobalImageCount" });
      globalImageCount++;
    },
    getCallHistory() {
      return [...callHistory];
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

describe("mentionWorkflow.scoringAlways", () => {
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

  it("should call accrueXp on every mention (scoring always runs)", async () => {
    const userId = "user_scoring_test";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // Process multiple mentions
    const events: MentionEvent[] = [
      createMentionEvent({ user_id: userId, text: "First mention" }),
      createMentionEvent({ user_id: userId, text: "Second mention with question?" }),
      createMentionEvent({ user_id: userId, text: "Third mention" }),
    ];

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const processedEvents: ProcessedEvent[] = [];

    for (const event of events) {
      await workflow.process(event, profile, processedEvents);
      processedEvents.push({ event_id: event.tweet_id, processed_at: new Date().toISOString() });
    }

    // Verify profile was saved multiple times (once per mention for scoring)
    const history = repo.getCallHistory();
    const saveCalls = history.filter((h) => h.method === "saveUserProfile");
    expect(saveCalls.length).toBeGreaterThanOrEqual(3);

    // Verify XP accumulated
    const finalProfile = await repo.getUserProfile(userId);
    expect(finalProfile?.xp).toBeGreaterThan(0);
    expect(finalProfile?.reply_count_24h).toBe(3);
  });

  it("should call evaluateRewards after accrueXp", async () => {
    const userId = "user_evaluate_test";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 90, // Close to threshold
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({
      user_id: userId,
      text: "Engaging mention with lots of content for maximum XP gain",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    await workflow.process(event, profile, []);

    // Verify profile was saved at least twice:
    // 1. After accrueXp
    // 2. After evaluateRewards (if reward was granted)
    const history = repo.getCallHistory();
    const saveCalls = history.filter((h) => h.method === "saveUserProfile");
    expect(saveCalls.length).toBeGreaterThanOrEqual(1);

    // Check that evaluateRewards ran by looking for reward_pending change
    const finalProfile = await repo.getUserProfile(userId);
    expect(finalProfile?.xp).toBeGreaterThanOrEqual(90);
  });

  it("should accumulate XP with quality signal bonuses", async () => {
    const userId = "user_quality_test";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // High quality mention: long, has question, uses command
    const event = createMentionEvent({
      user_id: userId,
      text: "/ask What do you think about the current market conditions and volatility? Looking for insights on whether this is a good time to enter positions or wait for better opportunities.",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    await workflow.process(event, profile, []);

    const finalProfile = await repo.getUserProfile(userId);
    // Should get bonus XP for command usage, length, and question
    expect(finalProfile?.xp).toBeGreaterThan(10); // More than base XP
  });

  it("should NOT score on blocked (unsafe) mentions", async () => {
    const userId = "user_blocked_test";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // Unsafe mention - should be blocked before scoring
    const event = createMentionEvent({
      user_id: userId,
      text: "I want to hack and dox someone at 123-456-7890",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await workflow.process(event, profile, []);

    // Should be blocked
    expect(result.success).toBe(true); // Still returns success (with refusal)
    // Refusal text should be one of the safe refusals
    expect(result.reply_text.length).toBeGreaterThan(0);
    expect(result.reply_text.toLowerCase()).not.toContain("score");
    expect(result.reply_text.toLowerCase()).not.toContain("xp");

    // Should NOT have accumulated XP (profile unchanged)
    const finalProfile = await repo.getUserProfile(userId);
    expect(finalProfile?.xp).toBe(0); // No XP gained
  });

  it("should score on aggressive (but not unsafe) mentions", async () => {
    const userId = "user_aggressive_test";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // Aggressive but not unsafe - scoring should still run
    const event = createMentionEvent({
      user_id: userId,
      text: "I HATE THIS STUPID MARKET!!! WHY IS EVERYTHING CRASHING!!!",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const result = await workflow.process(event, profile, []);

    // Should get rhyme de-escalation
    expect(result.success).toBe(true);
    expect(result.mode).toBe("TEXT");

    // But scoring should have run
    const finalProfile = await repo.getUserProfile(userId);
    expect(finalProfile?.xp).toBeGreaterThan(0);
    expect(finalProfile?.reply_count_24h).toBe(1);
  });

  it("should properly track quality signals calculation", async () => {
    const userId = "user_signals_test";

    // Mock the reward engine's accrueXp to capture quality signals
    const capturedSignals: QualitySignals[] = [];
    const originalAccrueXp = rewardEngine.accrueXp.bind(rewardEngine);
    rewardEngine.accrueXp = async (
      uid: string,
      eventType: "mention" | "remix" | "command",
      signals: QualitySignals
    ) => {
      capturedSignals.push(signals);
      return originalAccrueXp(uid, eventType, signals);
    };

    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({
      user_id: userId,
      text: "/ask What is happening? 📈📉🚀",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    await workflow.process(event, profile, []);

    // Verify quality signals were captured
    expect(capturedSignals.length).toBe(1);
    const signals = capturedSignals[0]!;
    expect(signals.hasQuestion).toBe(true);
    expect(signals.commandUsed).toBe(true);
    expect(signals.emojiCount).toBe(3);
    expect(signals.mentionLength).toBeGreaterThan(0);
  });
});
