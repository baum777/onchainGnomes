import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  publishWithRetry,
  isPublished,
  getEventState,
  recordEventSeen,
  recordPublishAttempt,
  recordPublishSuccess,
  resetEventStates,
} from "../../src/state/eventStateStore.js";
import { checkLLMBudget, recordLLMCall, getBudgetStatus, resetBudget } from "../../src/state/sharedBudgetGate.js";
import { resetStoreCache } from "../../src/state/storeFactory.js";

/**
 * Phase 3 State Integrity integration tests:
 * two workers / one event, only one publish; shared budget; restart after publish_attempted.
 */

beforeEach(() => {
  delete process.env.USE_REDIS;
  resetStoreCache();
});

describe("phase3 state integrity", () => {
  beforeEach(async () => {
    await resetEventStates();
    await resetBudget();
  });

  function uniqueEventId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  describe("two workers one event", () => {
    it("only one publish path succeeds; second worker sees published state and skips", async () => {
      const eventId = uniqueEventId("int");
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "tweet_int1" });

      const result1 = await publishWithRetry(eventId, publishFn);
      expect(result1.success).toBe(true);
      expect(result1.tweetId).toBe("tweet_int1");
      expect(publishFn).toHaveBeenCalledTimes(1);

      const result2 = await publishWithRetry(eventId, publishFn);
      expect(result2.success).toBe(true);
      expect(result2.tweetId).toBe("tweet_int1");
      expect(publishFn).toHaveBeenCalledTimes(1);
    });

    it("second worker sees published state via isPublished", async () => {
      const eventId = uniqueEventId("int2");
      await recordEventSeen(eventId);
      await recordPublishSuccess(eventId, "tweet_int2");
      const r = await isPublished(eventId);
      expect(r.published).toBe(true);
      expect(r.tweetId).toBe("tweet_int2");
    });
  });

  describe("shared budget across workers", () => {
    it("worker A consumes budget, worker B sees updated usage", async () => {
      const before = await getBudgetStatus();
      await recordLLMCall(false);
      await recordLLMCall(false);
      const after = await getBudgetStatus();
      expect(after.used).toBeGreaterThanOrEqual(before.used + 2);
      const check = await checkLLMBudget(false);
      expect(check.used).toBe(after.used);
      expect(check.remaining).toBeLessThanOrEqual(30);
    });

    it("when at limit, checkLLMBudget returns allowed false", async () => {
      const status = await getBudgetStatus();
      const toFill = Math.max(0, 30 - status.used);
      for (let i = 0; i < toFill; i++) {
        const r = await checkLLMBudget(false);
        if (r.allowed) await recordLLMCall(false);
      }
      const blocked = await checkLLMBudget(false);
      expect(blocked.allowed).toBe(false);
    });
  });

  describe("restart after publish_attempted", () => {
    it("after publish_attempted state is persisted, re-read sees it", async () => {
      const eventId = uniqueEventId("restart");
      await recordEventSeen(eventId);
      await recordPublishAttempt(eventId);
      await resetEventStates();
      const state = await getEventState(eventId);
      expect(state?.state).toBe("publish_attempted");
      expect(state?.attempts).toBe(1);
    });
  });

  describe("publish_succeeded prevents duplicate publish", () => {
    it("publishWithRetry returns success with existing tweetId without calling publishFn again", async () => {
      const eventId = uniqueEventId("dup");
      await recordEventSeen(eventId);
      await recordPublishSuccess(eventId, "tweet_existing");
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "tweet_never" });
      const result = await publishWithRetry(eventId, publishFn);
      expect(result.success).toBe(true);
      expect(result.tweetId).toBe("tweet_existing");
      expect(publishFn).not.toHaveBeenCalled();
    });
  });
});
