import type { TimelineCandidate, TimelineScoutTweet } from "./types.js";

export function normalizeTimelineCandidate(
  tweet: TimelineScoutTweet,
  username: string,
  sourceAccount: string
): TimelineCandidate {
  const text = tweet.text?.trim() ?? "";
  const referencedTweetIds = (tweet.referenced_tweets ?? []).map((ref) => ref.id);
  const isReply = (tweet.referenced_tweets ?? []).some((ref) => ref.type === "replied_to");
  const isThreadRoot = tweet.conversation_id === tweet.id;

  return {
    tweetId: tweet.id,
    conversationId: tweet.conversation_id,
    authorId: tweet.author_id,
    authorUsername: username,
    text,
    createdAt: tweet.created_at,
    isReply,
    isThreadRoot,
    threadDepth: isReply ? 1 : 0,
    replyCount: tweet.public_metrics?.reply_count ?? 0,
    likeCount: tweet.public_metrics?.like_count ?? 0,
    quoteCount: tweet.public_metrics?.quote_count ?? 0,
    referencedTweetIds,
    sourceAccount,
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
  };
}
