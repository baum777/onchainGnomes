import { describe, expect, it } from "vitest";
import { rankTimelineCandidates } from "../../src/engagement/rankTimelineCandidates.js";
import type { TimelineCandidate } from "../../src/engagement/types.js";

function candidate(overrides: Partial<TimelineCandidate>): TimelineCandidate {
  return {
    tweetId: "1",
    conversationId: "c1",
    authorId: "a1",
    authorUsername: "alice",
    text: "Market structure thesis because liquidity is fragmented and builders adapt quickly?",
    createdAt: new Date().toISOString(),
    isReply: false,
    isThreadRoot: true,
    threadDepth: 0,
    replyCount: 4,
    likeCount: 10,
    quoteCount: 1,
    referencedTweetIds: [],
    sourceAccount: "alice",
    contextSignals: [],
    threadSignals: [],
    noveltySignals: [],
    riskSignals: [],
    contextStrengthScore: 0,
    threadPotentialScore: 0,
    voiceFitScore: 0,
    noveltyScore: 0,
    spamRiskScore: 0,
    policyRiskScore: 0,
    repetitionRiskScore: 0,
    finalScore: 0,
    recommendedVoice: "stillhalter",
    recommendedMode: "proactive_timeline_reply",
    recommendedIntent: "proactive_timeline_reply",
    selectedBecause: [],
    rejectedBecause: [],
    scoreBreakdown: {},
    policyDecision: "pending",
    ...overrides,
  };
}

describe("timeline ranking", () => {
  it("ranks high-context thread candidate above noise", () => {
    const ranked = rankTimelineCandidates([
      candidate({ tweetId: "noise", text: "gm moon 100x", replyCount: 0, isThreadRoot: false }),
      candidate({ tweetId: "strong" }),
    ]);

    expect(ranked[0]?.tweetId).toBe("strong");
    expect(ranked[0]!.contextStrengthScore).toBeGreaterThan(ranked[1]!.contextStrengthScore);
  });

  it("penalizes weak thread structure and deep chain", () => {
    const ranked = rankTimelineCandidates([
      candidate({ tweetId: "root", isThreadRoot: true, threadDepth: 0, replyCount: 5 }),
      candidate({ tweetId: "deep", text: "gm moon lfg", isThreadRoot: false, threadDepth: 3, replyCount: 0 }),
    ]);

    const root = ranked.find((c) => c.tweetId === "root")!;
    const deep = ranked.find((c) => c.tweetId === "deep")!;
    expect(root.threadPotentialScore).toBeGreaterThan(deep.threadPotentialScore);
    expect(root.finalScore).toBeGreaterThan(deep.finalScore);
  });
});
