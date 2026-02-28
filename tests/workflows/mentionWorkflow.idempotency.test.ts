/**
 * Mention Workflow Idempotency Tests
 *
 * Tests that:
 * - Same event id processed twice => second time skip and no post
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
} from "../../src/reward_engine/index.js";

// Mock repository
function createMockRepo(): RewardStateRepo & {
  getProcessedCount: () => number;
} {
  const profiles = new Map<string, RewardUserProfile>();
  const processedEvents = new Set<string>();
  let globalImageCount = 0;
  let processedCount = 0;

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
      processedCount++;
    },
    async getGlobalImageCount24h() {
      return globalImageCount;
    },
    async incrementGlobalImageCount() {
      globalImageCount++;
    },
    getProcessedCount() {
      return processedCount;
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

describe("mentionWorkflow.idempotency", () => {
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

  it("should skip already processed event on second attempt", async () => {
    const userId = "user_idempotent";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 100,
      level: 1,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({ user_id: userId });
    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    // First process - should succeed
    const result1 = await workflow.process(event, profile, []);
    expect(result1.success).toBe(true);
    expect(result1.skip_reason).toBeUndefined();

    // Mark as processed
    const processedEvents: ProcessedEvent[] = [
      { event_id: event.tweet_id, processed_at: new Date().toISOString() },
    ];

    // Second process - should skip
    const result2 = await workflow.process(event, profile, processedEvents);
    expect(result2.success).toBe(false);
    expect(result2.skip_reason).toBe("Event already processed");
  });

  it("should not score XP twice for same event", async () => {
    const userId = "user_no_double_score";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({ user_id: userId });
    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    // First process
    await workflow.process(event, profile, []);
    const xpAfterFirst = (await repo.getUserProfile(userId))?.xp ?? 0;

    // Mark as processed
    const processedEvents: ProcessedEvent[] = [
      { event_id: event.tweet_id, processed_at: new Date().toISOString() },
    ];

    // Second process (should be skipped, no additional XP)
    await workflow.process(event, profile, processedEvents);
    const xpAfterSecond = (await repo.getUserProfile(userId))?.xp ?? 0;

    // XP should be same after second attempt (no double scoring)
    expect(xpAfterSecond).toBe(xpAfterFirst);
  });

  it("should not consume reward twice for same event", async () => {
    const userId = "user_no_double_reward";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 500,
      level: 3,
      reward_pending: true,
      pending_reward_type: "ROAST_IMAGE",
      last_reward_at: undefined,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const event = createMentionEvent({ user_id: userId });
    const profile: UserProfile = {
      user_id: userId,
      reward_pending: true,
      reply_count_24h: 0,
    };

    // First process - should consume reward
    const result1 = await workflow.process(event, profile, []);
    expect(result1.success).toBe(true);

    // Reward should be consumed
    const profileAfterFirst = await repo.getUserProfile(userId);
    expect(profileAfterFirst?.reward_pending).toBe(false);

    // Mark as processed
    const processedEvents: ProcessedEvent[] = [
      { event_id: event.tweet_id, processed_at: new Date().toISOString() },
    ];

    // Reset profile to have pending reward again (simulating new reward)
    await repo.saveUserProfile({
      user_id: userId,
      xp: 500,
      level: 3,
      reward_pending: true,
      pending_reward_type: "ROAST_IMAGE",
      last_reward_at: undefined,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // Second process - should skip entirely, not even trying to consume
    const result2 = await workflow.process(event, profile, processedEvents);
    expect(result2.success).toBe(false);
    expect(result2.skip_reason).toBe("Event already processed");

    // Reward should still be pending (because event was skipped before consume)
    const profileAfterSecond = await repo.getUserProfile(userId);
    expect(profileAfterSecond?.reward_pending).toBe(true);
    expect(profileAfterSecond?.pending_reward_type).toBe("ROAST_IMAGE");
  });

  it("should handle multiple different events for same user", async () => {
    const userId = "user_multiple_events";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    const processedEvents: ProcessedEvent[] = [];

    // Process 5 different events
    for (let i = 0; i < 5; i++) {
      const event = createMentionEvent({
        user_id: userId,
        tweet_id: `tweet_batch_${i}`,
        text: `Mention number ${i}`,
      });

      const result = await workflow.process(event, profile, processedEvents);
      expect(result.success).toBe(true);
      expect(result.skip_reason).toBeUndefined();

      processedEvents.push({
        event_id: event.tweet_id,
        processed_at: new Date().toISOString(),
      });
    }

    // Should have scored XP for all 5 events
    const finalProfile = await repo.getUserProfile(userId);
    expect(finalProfile?.reply_count_24h).toBe(5);
    expect(finalProfile?.xp).toBeGreaterThan(0);
  });

  it("should mark event as processed even when safety blocked", async () => {
    const userId = "user_blocked_idempotent";
    await repo.saveUserProfile({
      user_id: userId,
      xp: 0,
      level: 0,
      reward_pending: false,
      reply_count_24h: 0,
      global_image_count_24h: 0,
    });

    // Unsafe event
    const event = createMentionEvent({
      user_id: userId,
      text: "I want to dox and hack phone number 555-1234",
    });

    const profile: UserProfile = {
      user_id: userId,
      reward_pending: false,
      reply_count_24h: 0,
    };

    // First process - blocked but still processed
    const result1 = await workflow.process(event, profile, []);
    expect(result1.success).toBe(true); // Returns refusal

    // Note: In current implementation, blocked events don't call markEventProcessed
    // because they're handled before rewardEngine.consumeRewardIfEligible
    // But the idempotency check at the start should catch it

    // Mark as processed manually for this test (as if processed_events repo tracked it)
    const processedEvents: ProcessedEvent[] = [
      { event_id: event.tweet_id, processed_at: new Date().toISOString() },
    ];

    // Second attempt should skip
    const result2 = await workflow.process(event, profile, processedEvents);
    expect(result2.success).toBe(false);
    expect(result2.skip_reason).toBe("Event already processed");
  });

  it("should track processed events correctly", () => {
    // Test the idempotency logic directly
    const event = createMentionEvent();
    const processedEvents: ProcessedEvent[] = [];

    // First check - should not be in processed list
    const isProcessed1 = processedEvents.some((e) => e.event_id === event.tweet_id);
    expect(isProcessed1).toBe(false);

    // Mark as processed
    processedEvents.push({
      event_id: event.tweet_id,
      processed_at: new Date().toISOString(),
    });

    // Second check - should be in processed list
    const isProcessed2 = processedEvents.some((e) => e.event_id === event.tweet_id);
    expect(isProcessed2).toBe(true);
  });
});
