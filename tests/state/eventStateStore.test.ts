import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  resetEventStates,
} from "../../src/state/eventStateStore.js";
import { resetStoreCache } from "../../src/state/storeFactory.js";

/**
 * EventStateStore (store-backed): state transitions, persistence across instances,
 * hot-cache correctness, cache eviction, publish lock + idempotency.
 */

beforeEach(() => {
  delete process.env.USE_REDIS;
  resetStoreCache();
});

afterEach(async () => {
  await resetEventStates();
});

function uniqueEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

describe("eventStateStore", () => {

  describe("state transitions", () => {
    it("event_seen -> processed_ok -> publish_attempted -> publish_succeeded", async () => {
      const eventId = uniqueEventId("trans");

      await recordEventSeen(eventId);
      let state = await getEventState(eventId);
      expect(state?.state).toBe("event_seen");
      expect(state?.attempts).toBe(0);

      await recordEventProcessed(eventId);
      state = await getEventState(eventId);
      expect(state?.state).toBe("processed_ok");

      await recordPublishAttempt(eventId);
      state = await getEventState(eventId);
      expect(state?.state).toBe("publish_attempted");
      expect(state?.attempts).toBe(1);

      await recordPublishSuccess(eventId, "tweet_123");
      state = await getEventState(eventId);
      expect(state?.state).toBe("publish_succeeded");
      expect(state?.tweetId).toBe("tweet_123");
    });

    it("success path: recordEventSeen then recordPublishSuccess", async () => {
      const eventId = uniqueEventId("success");
      await recordEventSeen(eventId);
      await recordEventProcessed(eventId);
      await recordPublishAttempt(eventId);
      await recordPublishSuccess(eventId, "tweet_456");
      const published = await isPublished(eventId);
      expect(published.published).toBe(true);
      expect(published.tweetId).toBe("tweet_456");
    });

    it("records error on recordPublishFailure", async () => {
      const eventId = uniqueEventId("fail");
      await recordPublishAttempt(eventId);
      await recordPublishFailure(eventId, "Network timeout");
      const state = await getEventState(eventId);
      expect(state?.error).toBe("Network timeout");
    });
  });

  describe("duplicate event and idempotency", () => {
    it("isPublished returns false for unpublished event", async () => {
      const r = await isPublished("never_published");
      expect(r.published).toBe(false);
    });

    it("isPublished returns true with tweetId after publish_succeeded", async () => {
      const eventId = uniqueEventId("idem");
      await recordEventSeen(eventId);
      await recordPublishSuccess(eventId, "tweet_idem");
      const r = await isPublished(eventId);
      expect(r.published).toBe(true);
      expect(r.tweetId).toBe("tweet_idem");
    });

    it("publishWithRetry prevents duplicate publish", async () => {
      const eventId = uniqueEventId("dup");
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "tweet_dup" });
      const first = await publishWithRetry(eventId, publishFn);
      expect(first.success).toBe(true);
      expect(first.tweetId).toBe("tweet_dup");
      const result = await publishWithRetry(eventId, publishFn);
      expect(result.success).toBe(true);
      expect(result.tweetId).toBe("tweet_dup");
      expect(publishFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("persisted state survives new manager instance", () => {
    it("re-read after resetEventStates (cache clear) still sees persisted state", async () => {
      const eventId = uniqueEventId("persist");
      await recordEventSeen(eventId);
      await recordPublishSuccess(eventId, "tweet_persist");
      await resetEventStates();
      const r = await isPublished(eventId);
      expect(r.published).toBe(true);
      expect(r.tweetId).toBe("tweet_persist");
    });

    it("getEventState after cache clear reloads from backend", async () => {
      const eventId = uniqueEventId("reload");
      await recordEventSeen(eventId);
      await recordEventProcessed(eventId);
      await resetEventStates();
      const state = await getEventState(eventId);
      expect(state?.state).toBe("processed_ok");
    });
  });

  describe("shouldRetryPublish and publish lock flow", () => {
    it("shouldRetryPublish blocks retry after publish_succeeded", async () => {
      const eventId = uniqueEventId("retry_done");
      await recordEventSeen(eventId);
      await recordPublishSuccess(eventId, "tweet_done");
      const r = await shouldRetryPublish(eventId);
      expect(r.shouldRetry).toBe(false);
    });

    it("shouldRetryPublish allows retry with delay for publish_attempted", async () => {
      const eventId = uniqueEventId("retry_attempted");
      await recordPublishAttempt(eventId);
      const r = await shouldRetryPublish(eventId);
      expect(r.shouldRetry).toBe(true);
      expect(r.delayMs).toBeGreaterThan(0);
    });
  });
});
