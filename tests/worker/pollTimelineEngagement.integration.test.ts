import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStoreCache } from "../../src/state/storeFactory.js";

const replyMock = vi.fn(async () => ({ id: "reply-1", text: "ok" }));
const handleEventMock = vi.fn(async () => ({ action: "publish", reply_text: "gnome says hi" }));
let currentTweetId = `tweet-${Date.now()}`;

vi.mock("../../src/clients/xClient.js", () => ({
  createXClient: () => ({ reply: replyMock }),
}));

vi.mock("../../src/canonical/pipeline.js", () => ({
  handleEvent: handleEventMock,
}));

vi.mock("../../src/clients/xApi.js", () => ({
  invokeXApiRequest: vi.fn(async ({ uri }: { uri: string }) => {
    if (uri.includes("/2/users/me")) return { data: { id: "bot-1" } };
    if (uri.includes("/2/tweets/search/recent")) {
      return {
        data: [
          {
            id: currentTweetId,
            conversation_id: "conv-1",
            author_id: "author-1",
            text: "Market thesis because liquidity and builder architecture are shifting across venues, therefore capital rotates slower and this opens room for structured execution strategies?",
            created_at: new Date().toISOString(),
            public_metrics: { reply_count: 5, like_count: 10, quote_count: 1 },
          },
        ],
        includes: { users: [{ id: "author-1", username: "alice" }] },
      };
    }
    return {};
  }),
}));

describe("timeline engagement worker", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.USE_REDIS = "false";
    process.env.TIMELINE_ENGAGEMENT_ENABLED = "true";
    process.env.TIMELINE_SOURCE_ACCOUNTS = "alice";
    process.env.TIMELINE_ENGAGEMENT_MAX_PER_RUN = "2";
    currentTweetId = `tweet-${Date.now()}`;
    resetStoreCache();
    replyMock.mockClear();
    handleEventMock.mockClear();
  });

  it("runs scout->rank->policy->generate->publish->writeback and dedupes next run", async () => {
    const { runTimelineEngagementIteration } = await import("../../src/worker/pollTimelineEngagement.js");

    await runTimelineEngagementIteration();
    await runTimelineEngagementIteration();

    expect(replyMock).toHaveBeenCalledTimes(1);
  });
});
