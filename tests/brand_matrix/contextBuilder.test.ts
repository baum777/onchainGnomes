/**
 * Context Builder tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildContext } from "../../src/brand_matrix/contextBuilder.js";
import type { TwitterApi } from "twitter-api-v2";

describe("contextBuilder", () => {
  let mockTwitterClient: TwitterApi;

  beforeEach(() => {
    mockTwitterClient = {
      v2: {
        user: vi.fn().mockRejectedValue(new Error("skip")),
        singleTweet: vi.fn().mockRejectedValue(new Error("skip")),
        search: vi.fn().mockRejectedValue(new Error("skip")),
      },
    } as unknown as TwitterApi;
  });

  it("builds summary with graceful fallbacks", async () => {
    const event = {
      tweet_id: "123",
      user_id: "user1",
      user_handle: "testuser",
      text: "Hello @serGorky what do you think?",
    };

    const ctx = await buildContext(event, mockTwitterClient, null);

    expect(ctx.mentionText).toBe(event.text);
    expect(ctx.author.id).toBe("user1");
    expect(ctx.summary).toContain("Hello");
    expect(ctx.summary.length).toBeLessThanOrEqual(1200);
    expect(ctx.raw.event_id).toBe("123");
  });

  it("does not include forbidden tokens in summary", async () => {
    const event = {
      tweet_id: "456",
      user_id: "user2",
      text: "What's my score?",
    };

    const ctx = await buildContext(event, mockTwitterClient, null);

    expect(ctx.summary.toLowerCase()).not.toContain("score");
    expect(ctx.summary.toLowerCase()).not.toContain("xp");
    expect(ctx.summary.toLowerCase()).not.toContain("threshold");
  });

  it("continues when user fetch fails", async () => {
    const event = {
      tweet_id: "789",
      user_id: "user3",
      text: "Test",
    };

    const ctx = await buildContext(event, mockTwitterClient, null);

    expect(ctx.author.id).toBe("user3");
    expect(ctx.author.username).toBeUndefined();
  });
});
