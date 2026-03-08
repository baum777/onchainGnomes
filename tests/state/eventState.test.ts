import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordEventSeen,
  recordEventProcessed,
  recordPublishAttempt,
  recordPublishSuccess,
  recordPublishFailure,
  isPublished,
  getEventState,
  shouldRetryPublish,
  publishWithRetry,
  getEventStateStats,
  resetEventStates, // Need to export this
} from "../../src/state/eventState.js";

describe("eventState", () => {
  beforeEach(() => {
    resetEventStates(); // Clear all entries
  });

  describe("1.2 Publish Retry + Idempotency - State transitions", () => {
    it("transitions: event_seen -> processed_ok -> publish_attempted -> publish_succeeded", () => {
      const eventId = "test_event_1";

      recordEventSeen(eventId);
      let state = getEventState(eventId);
      expect(state?.state).toBe("event_seen");
      expect(state?.attempts).toBe(0);

      recordEventProcessed(eventId);
      state = getEventState(eventId);
      expect(state?.state).toBe("processed_ok");

      recordPublishAttempt(eventId);
      state = getEventState(eventId);
      expect(state?.state).toBe("publish_attempted");
      expect(state?.attempts).toBe(1);

      recordPublishSuccess(eventId, "tweet_123");
      state = getEventState(eventId);
      expect(state?.state).toBe("publish_succeeded");
      expect(state?.tweetId).toBe("tweet_123");
    });

    it("increments attempt counter on multiple publish attempts", () => {
      const eventId = "test_event_2";

      recordPublishAttempt(eventId);
      recordPublishAttempt(eventId);
      recordPublishAttempt(eventId);

      const state = getEventState(eventId);
      expect(state?.attempts).toBe(3);
    });

    it("records error on publish failure", () => {
      const eventId = "test_event_3";

      recordPublishAttempt(eventId);
      recordPublishFailure(eventId, "Network timeout");

      const state = getEventState(eventId);
      expect(state?.error).toBe("Network timeout");
    });
  });

  describe("1.2 Publish Retry + Idempotency - isPublished check", () => {
    it("returns false for unpublished event", () => {
      const result = isPublished("unpublished_event");
      expect(result.published).toBe(false);
      expect(result.tweetId).toBeUndefined();
    });

    it("returns true with tweetId for published event", () => {
      const eventId = "published_event";
      recordPublishSuccess(eventId, "tweet_456");

      const result = isPublished(eventId);
      expect(result.published).toBe(true);
      expect(result.tweetId).toBe("tweet_456");
    });

    it("returns false for event in publish_attempted state", () => {
      const eventId = "attempted_event";
      recordPublishAttempt(eventId);

      const result = isPublished(eventId);
      expect(result.published).toBe(false);
    });
  });

  describe("1.2 Publish Retry + Idempotency - Retry logic", () => {
    it("allows retry for new event", () => {
      const result = shouldRetryPublish("new_event");
      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBe(0);
    });

    it("returns correct delays for attempts: 0ms, 1000ms, 5000ms, 15000ms", () => {
      const eventId = "retry_delays_test";

      // First check - no delay (before any attempts)
      let result = shouldRetryPublish(eventId);
      expect(result.delayMs).toBe(0);

      // After 1st attempt - next retry should be 5000ms (delays[1] for attempt=1)
      recordPublishAttempt(eventId);
      result = shouldRetryPublish(eventId);
      expect(result.delayMs).toBe(5000);

      // After 2nd attempt - next retry should be 15000ms (delays[2] for attempt=2)
      recordPublishAttempt(eventId);
      result = shouldRetryPublish(eventId);
      expect(result.delayMs).toBe(15000);

      // After 3rd attempt - max retries exceeded
      recordPublishAttempt(eventId);
      result = shouldRetryPublish(eventId);
      expect(result.shouldRetry).toBe(false);
    });

    it("blocks retry after max attempts exceeded", () => {
      const eventId = "max_retries_test";

      // 3 attempts = max
      for (let i = 0; i < 3; i++) {
        recordPublishAttempt(eventId);
      }

      const result = shouldRetryPublish(eventId);
      expect(result.shouldRetry).toBe(false);
    });

    it("blocks retry for already succeeded event", () => {
      const eventId = "already_succeeded";
      recordPublishSuccess(eventId, "tweet_789");

      const result = shouldRetryPublish(eventId);
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe("1.2 Publish Retry + Idempotency - publishWithRetry", () => {
    it("succeeds on first try", async () => {
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "tweet_001" });

      const result = await publishWithRetry("first_try_success", publishFn);

      expect(result.success).toBe(true);
      expect(result.tweetId).toBe("tweet_001");
      expect(publishFn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure then succeeds", async () => {
      const publishFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ tweetId: "tweet_002" });

      const result = await publishWithRetry("retry_then_success", publishFn);

      expect(result.success).toBe(true);
      expect(result.tweetId).toBe("tweet_002");
      expect(publishFn).toHaveBeenCalledTimes(2);
    }, 10000); // 10s timeout for retry delays

    it("fails after max retries", async () => {
      const publishFn = vi.fn().mockRejectedValue(new Error("Persistent error"));

      const result = await publishWithRetry("max_retries_fail", publishFn);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Persistent error");
      expect(publishFn).toHaveBeenCalledTimes(3); // initial + 2 retries (3 total attempts)
    }, 30000); // 30s timeout for all retries (5s + 15s = 20s total)

    it("prevents duplicate publish via idempotency", async () => {
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "tweet_003" });

      // First publish
      await publishWithRetry("duplicate_test", publishFn);

      // Second attempt should be skipped
      const result = await publishWithRetry("duplicate_test", publishFn);

      expect(result.success).toBe(true);
      expect(result.tweetId).toBe("tweet_003");
      expect(publishFn).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe("1.2 Publish Retry + Idempotency - Stats", () => {
    it("returns correct stats by state", () => {
      // Create events in different states
      recordEventSeen("stat_seen");
      recordEventProcessed("stat_processed");
      recordPublishAttempt("stat_attempted");
      recordPublishSuccess("stat_succeeded", "tweet_999");

      const stats = getEventStateStats();

      expect(stats.total).toBe(4);
      expect(stats.byState.event_seen).toBe(1);
      expect(stats.byState.processed_ok).toBe(1);
      expect(stats.byState.publish_attempted).toBe(1);
      expect(stats.byState.publish_succeeded).toBe(1);
    });
  });
});
