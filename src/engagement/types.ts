export type EngagementMode = "proactive_timeline_reply" | "thread_interjection" | "narrative_intercept";

export interface TimelineScoutTweet {
  id: string;
  conversation_id: string;
  author_id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
  referenced_tweets?: Array<{ id: string; type: string }>;
}

export interface TimelineCandidate {
  tweetId: string;
  conversationId: string;
  authorId: string;
  authorUsername: string;
  text: string;
  createdAt: string;
  isReply: boolean;
  isThreadRoot: boolean;
  threadDepth: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  referencedTweetIds: string[];
  sourceAccount: string;
  contextSignals: string[];
  threadSignals: string[];
  noveltySignals: string[];
  riskSignals: string[];
  contextStrengthScore: number;
  threadPotentialScore: number;
  voiceFitScore: number;
  noveltyScore: number;
  spamRiskScore: number;
  policyRiskScore: number;
  repetitionRiskScore: number;
  finalScore: number;
  recommendedVoice: string;
  recommendedMode: EngagementMode;
  recommendedIntent: string;
  selectedBecause: string[];
  rejectedBecause: string[];
  scoreBreakdown: Record<string, number>;
  policyDecision: "pending" | "allow" | "reject";
}

export interface TimelineSelectionResult {
  selected: TimelineCandidate[];
  rejected: TimelineCandidate[];
}
