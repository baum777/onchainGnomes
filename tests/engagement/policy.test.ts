import { beforeEach, describe, expect, it } from "vitest";
import { evaluateProactiveEngagementPolicy } from "../../src/policy/proactiveEngagementPolicy.js";
import { EngagementMemory } from "../../src/engagement/engagementMemory.js";
import { resetStoreCache } from "../../src/state/storeFactory.js";
import type { TimelineCandidate } from "../../src/engagement/types.js";
import type { TimelineEngagementConfig } from "../../src/config/timelineEngagementConfig.js";

function config(): TimelineEngagementConfig {
  return {
    enabled: true,
    intervalMs: 600000,
    maxPerRun: 2,
    maxPerHour: 2,
    maxPerDay: 3,
    minContextScore: 50,
    minFinalScore: 50,
    requireThreadStructure: false,
    sourceAccounts: ["alice"],
    keywordFilters: [],
    authorCooldownMinutes: 60,
    conversationCooldownMinutes: 60,
  };
}

function candidate(): TimelineCandidate {
  return {
    tweetId: "1",
    conversationId: "c1",
    authorId: "a1",
    authorUsername: "alice",
    text: "strong",
    createdAt: new Date().toISOString(),
    isReply: false,
    isThreadRoot: true,
    threadDepth: 0,
    replyCount: 3,
    likeCount: 10,
    quoteCount: 1,
    referencedTweetIds: [],
    sourceAccount: "alice",
    contextSignals: [],
    threadSignals: [],
    noveltySignals: [],
    riskSignals: [],
    contextStrengthScore: 80,
    threadPotentialScore: 60,
    voiceFitScore: 50,
    noveltyScore: 50,
    spamRiskScore: 0,
    policyRiskScore: 0,
    repetitionRiskScore: 0,
    finalScore: 80,
    recommendedVoice: "stillhalter",
    recommendedMode: "proactive_timeline_reply",
    recommendedIntent: "x",
    selectedBecause: [],
    rejectedBecause: [],
    scoreBreakdown: {},
    policyDecision: "pending",
  };
}

describe("proactive policy", () => {
  beforeEach(() => {
    process.env.USE_REDIS = "false";
    resetStoreCache();
  });

  it("blocks low context score", async () => {
    const memory = new EngagementMemory();
    const c = candidate();
    c.contextStrengthScore = 10;
    const result = await evaluateProactiveEngagementPolicy(c, config(), memory);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("low_context_strength");
  });

  it("blocks duplicate tweet and cooldowns", async () => {
    const memory = new EngagementMemory();
    await memory.recordPublish({
      tweetId: "1",
      conversationId: "c1",
      authorId: "a1",
      authorCooldownMinutes: 60,
      conversationCooldownMinutes: 60,
    });

    const duplicate = await evaluateProactiveEngagementPolicy(candidate(), config(), memory);
    expect(duplicate.reason).toBe("duplicate_tweet");

    const otherTweet = candidate();
    otherTweet.tweetId = "2";
    const authorCd = await evaluateProactiveEngagementPolicy(otherTweet, config(), memory);
    expect(authorCd.reason).toBe("author_cooldown");
  });

  it("blocks hourly/day limits", async () => {
    const memory = new EngagementMemory();
    await memory.recordPublish({ tweetId: "x1", conversationId: "cx1", authorId: "ax1", authorCooldownMinutes: 1, conversationCooldownMinutes: 1 });
    await memory.recordPublish({ tweetId: "x2", conversationId: "cx2", authorId: "ax2", authorCooldownMinutes: 1, conversationCooldownMinutes: 1 });

    const limitedCfg = { ...config(), maxPerHour: 2 };
    const result = await evaluateProactiveEngagementPolicy(candidate(), limitedCfg, memory);
    expect(result.reason).toBe("hourly_limit_reached");
  });
});
