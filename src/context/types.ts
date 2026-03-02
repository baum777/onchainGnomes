export type MentionsSource = "mentions" | "search";

export type ContextEngineMode = "legacy" | "v2" | "hybrid";

export type IntentLabel =
  | "question"
  | "request"
  | "joke"
  | "provocation"
  | "complaint"
  | "shill"
  | "support"
  | "attack"
  | "unknown";

export type ToneLabel =
  | "friendly"
  | "neutral"
  | "sarcastic"
  | "spicy"
  | "aggressive"
  | "deescalate";

export interface MentionInput {
  tweet_id: string;
  text: string;
  author_id: string;
  author_username?: string | null;
  created_at?: string | null;
  conversation_id?: string | null;
}

export interface TweetRef {
  id: string;
  text?: string;
  author_id?: string;
  author_username?: string;
  created_at?: string;
  conversation_id?: string;
  referenced_tweets?: Array<{ type: "replied_to" | "quoted" | "retweeted"; id: string }>;
}

export interface ThreadContext {
  root_tweet_id?: string | null;
  chain: TweetRef[];
  summary: string;
  intent: IntentLabel;
  tone: ToneLabel;
  entities: string[];
  keywords: string[];
  claims: string[];
  constraints: string[];
}

export interface SemanticBriefData {
  enabled: boolean;
  mode: "shadow" | "assist" | "full";
  seed_hash: string;
  top_topic?: string;
  top_results?: Array<{ id: string; sim: number; snippet: string }>;
  clusters?: Array<{ label: string; size: number }>;
  avg_top5_sim?: number;
}

export interface TimelineBrief {
  query_keywords: string[];
  window_minutes: number;
  bullets: string[];
  hot_phrases: string[];
  counterpoints: string[];
  sources_sampled: number;
  semantic?: SemanticBriefData;
}

export interface ReplyControls {
  roast_level: "mild" | "medium" | "spicy" | "deescalate";
  deny_reply_mode: "silent" | "label_only" | "reply" | "tease";
  activation_mode: "global" | "whitelist" | "optin";
  mentions_source?: MentionsSource;
  max_thread_depth: number;
  enable_timeline_scout: boolean;
  max_timeline_queries: number;
}

export interface AdaptiveSignals {
  sentiment: "negative" | "neutral" | "positive";
  toxicity: "low" | "med" | "high";
  urgency: "low" | "med" | "high";
  novelty: "low" | "med" | "high";
  confidence: number;
  roast_level: "mild" | "medium" | "spicy" | "deescalate";
}

export interface SemanticSignals {
  avg_top5_sim?: number;
  top_topic?: string;
  mode?: "shadow" | "assist" | "full";
}

export interface ContextBundle {
  mention: MentionInput;
  thread: ThreadContext;
  timeline?: TimelineBrief | null;
  adaptiveSignals?: AdaptiveSignals | null;
  controls: ReplyControls;
  trace: {
    request_id: string;
    started_at: string;
    cache_hits: string[];
    api_calls: Array<{ name: string; ok: boolean; ms: number; meta?: Record<string, unknown> }>;
    warnings: string[];
    semantic?: SemanticSignals;
  };
}
