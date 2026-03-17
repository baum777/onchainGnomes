import { describe, expect, it } from "vitest";
import { selectTopTimelineCandidates } from "../../src/engagement/rankTimelineCandidates.js";
import type { TimelineCandidate } from "../../src/engagement/types.js";

const base: TimelineCandidate = {
  tweetId: "1",
  conversationId: "c1",
  authorId: "a1",
  authorUsername: "u",
  text: "market architecture thesis because structure",
  createdAt: new Date().toISOString(),
  isReply: false,
  isThreadRoot: true,
  threadDepth: 0,
  replyCount: 4,
  likeCount: 1,
  quoteCount: 0,
  referencedTweetIds: [],
  sourceAccount: "u",
  contextSignals: [],
  threadSignals: [],
  noveltySignals: [],
  riskSignals: [],
  contextStrengthScore: 80,
  threadPotentialScore: 70,
  voiceFitScore: 70,
  noveltyScore: 50,
  spamRiskScore: 10,
  policyRiskScore: 0,
  repetitionRiskScore: 5,
  finalScore: 90,
  recommendedVoice: "pilzarchitekt",
  recommendedMode: "thread_interjection",
  recommendedIntent: "builder_response",
  selectedBecause: [],
  rejectedBecause: [],
  scoreBreakdown: {},
  policyDecision: "allow",
};

describe("selection", () => {
  it("selects top-N and avoids same author/conversation duplicates", () => {
    const result = selectTopTimelineCandidates(
      [
        { ...base, tweetId: "1", finalScore: 90, conversationId: "c1", authorId: "a1" },
        { ...base, tweetId: "2", finalScore: 89, conversationId: "c1", authorId: "a2" },
        { ...base, tweetId: "3", finalScore: 88, conversationId: "c3", authorId: "a1" },
        { ...base, tweetId: "4", finalScore: 87, conversationId: "c4", authorId: "a4" },
      ],
      2
    );

    expect(result.selected).toHaveLength(2);
    expect(result.selected.map((c) => c.tweetId)).toEqual(["1", "4"]);
  });
});
