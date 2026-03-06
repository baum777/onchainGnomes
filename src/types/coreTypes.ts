import { z } from "zod";

/**
 * Shared primitives
 */
export const HandleSchema = z
  .string()
  .min(1)
  .regex(/^@/i, "handle must start with @");

export type Handle = z.infer<typeof HandleSchema>;

export const IsoTimestampSchema = z
  .string()
  .min(10)
  .describe("ISO 8601 timestamp string");

export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

/**
 * Thread + Timeline raw inputs
 */
export const ThreadMessageSchema = z.object({
  author: HandleSchema,
  text: z.string().min(1),
  ts: IsoTimestampSchema.nullable().optional(),
  tweet_id: z.string().min(1).optional(),
});

export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;

export const TimelineTweetSchema = z.object({
  tweet_id: z.string().min(1),
  author: HandleSchema,
  text: z.string().min(1),
  ts: IsoTimestampSchema.nullable().optional(),
});

export type TimelineTweet = z.infer<typeof TimelineTweetSchema>;

/**
 * 1) Thread Summarizer output
 */
export const ThreadParticipantSchema = z.object({
  handle: HandleSchema,
  role: z.enum(["author", "replying", "spectator"]),
});

export type ThreadParticipant = z.infer<typeof ThreadParticipantSchema>;

export const StanceSchema = z.enum(["bullish", "bearish", "neutral", "trolling", "unknown"]);
export type Stance = z.infer<typeof StanceSchema>;

export const ThreadStanceEntrySchema = z.object({
  handle: HandleSchema,
  stance: StanceSchema,
});

export type ThreadStanceEntry = z.infer<typeof ThreadStanceEntrySchema>;

export const ToxicityLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type ToxicityLevel = z.infer<typeof ToxicityLevelSchema>;

export const ThreadSummarySchema = z.object({
  thread_summary: z.string().min(1).max(800), // ~80–120 words budget
  participants: z.array(ThreadParticipantSchema).default([]),
  stance_map: z.array(ThreadStanceEntrySchema).default([]),
  open_questions: z.array(z.string().min(1)).default([]),
  toxicity_level: ToxicityLevelSchema,
});

export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

/**
 * 2) Timeline-X Summarizer output
 */
export const DominantMoodSchema = z.enum(["hype", "fear", "boredom", "rage", "hope", "mixed"]);
export type DominantMood = z.infer<typeof DominantMoodSchema>;

export const NotableAssetSchema = z.object({
  symbol_or_name: z.string().min(1).max(48),
  reason: z.string().min(1).max(80),
});

export type NotableAsset = z.infer<typeof NotableAssetSchema>;

export const TimelineSummarySchema = z.object({
  narrative_summary: z.string().min(1).max(900), // ~90–130 words budget
  dominant_mood: DominantMoodSchema,
  recurring_memes: z.array(z.string().min(1).max(48)).default([]),
  notable_assets: z.array(NotableAssetSchema).default([]),
  risk_signals: z.array(z.string().min(1).max(64)).default([]),
});

export type TimelineSummary = z.infer<typeof TimelineSummarySchema>;

/**
 * 3) Topic Extractor output
 */
export const TopicSchema = z.object({
  name: z.string().min(1).max(24),
  weight: z.number().min(0).max(1),
});

export type Topic = z.infer<typeof TopicSchema>;

export const TopicsSchema = z.object({
  topics: z
    .array(TopicSchema)
    .min(3)
    .max(6)
    .refine(
      (arr) => {
        const sum = arr.reduce((a, t) => a + t.weight, 0);
        return Math.abs(sum - 1.0) < 1e-6;
      },
      { message: "topic weights must sum to 1.0 exactly" }
    ),
});

export type Topics = z.infer<typeof TopicsSchema>;

/**
 * 4) Intent + Entity Detector output
 */
export const IntentSchema = z.enum([
  "question",
  "insult",
  "debate",
  "market_request",
  "meme_play",
  "prompt_attack",
  "lore_query",
  "coin_query",
]);
export type Intent = z.infer<typeof IntentSchema>;

export const EntityTopicSchema = z.enum(["liquidity", "volume", "rug", "dev", "narrative", "macro", "unknown"]);
export type EntityTopic = z.infer<typeof EntityTopicSchema>;

export const ToneSchema = z.enum(["friendly", "hostile", "curious", "hype", "confused", "mocking"]);
export type Tone = z.infer<typeof ToneSchema>;

export const NeedsTruthSchema = z.enum(["high", "medium", "low"]);
export type NeedsTruth = z.infer<typeof NeedsTruthSchema>;

export const EntitiesSchema = z.object({
  ticker: z.string().min(1).max(16).nullable(),
  coin_address: z.string().min(5).max(128).nullable(),
  topic: EntityTopicSchema,
});

export type Entities = z.infer<typeof EntitiesSchema>;

export const IntentResultSchema = z.object({
  intent: IntentSchema,
  targets: z.array(z.string().min(1).max(64)).default([]),
  entities: EntitiesSchema,
  tone: ToneSchema,
  needs_truth: NeedsTruthSchema,
});

export type IntentResult = z.infer<typeof IntentResultSchema>;

/**
 * 5) Truth Gate output
 */
export const TruthLevelSchema = z.enum(["FACT", "LORE", "OPINION"]);
export type TruthLevel = z.infer<typeof TruthLevelSchema>;

export const TruthGateSchema = z.object({
  truth_level: TruthLevelSchema,
  constraints: z.array(z.string().min(1).max(120)).default([]),
});

export type TruthGate = z.infer<typeof TruthGateSchema>;

export const FactsAvailableSchema = z.object({
  has_coin_facts: z.boolean(),
  has_address: z.boolean(),
  has_thread_facts: z.boolean(),
});

export type FactsAvailable = z.infer<typeof FactsAvailableSchema>;

/**
 * 6) Persona Router output
 */
export const PersonaModeSchema = z.enum(["analyst", "goblin", "scientist", "prophet", "referee"]);
export type PersonaMode = z.infer<typeof PersonaModeSchema>;

export const EnergySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export type Energy = z.infer<typeof EnergySchema>;

export const UserRelationshipSchema = z.enum(["new", "regular", "enemy", "vip", "dev"]);
export type UserRelationship = z.infer<typeof UserRelationshipSchema>;

export const PersonaRouteSchema = z.object({
  mode: PersonaModeSchema,
  energy: EnergySchema,
  style_rules: z.array(z.string().min(1).max(60)).min(1).max(8),
});

export type PersonaRoute = z.infer<typeof PersonaRouteSchema>;

/**
 * Memory types
 */
export const FactsContextSchema = z.object({
  // Keep this intentionally flexible; facts are provider/adapter dependent.
  // You can extend with strict fields later (liquidity, volume, holders, etc).
  source: z.string().min(1).max(64).optional(),
  as_of: IsoTimestampSchema.optional(),
  data: z.record(z.any()).default({}),
});

export type FactsContext = z.infer<typeof FactsContextSchema>;

export const LoreEntrySchema = z.object({
  key: z.string().min(1).max(64),
  canon: z.string().min(1).max(280).optional(),
  headcanon: z.array(z.string().min(1).max(280)).default([]),
  last_updated: IsoTimestampSchema.optional(),
  source: z.string().min(1).max(64).optional(),
  thread_id: z.string().min(1).optional(),
});

export type LoreEntry = z.infer<typeof LoreEntrySchema>;

export const LoreMemorySchema = z.object({
  entries: z.array(LoreEntrySchema).default([]),
});

export type LoreMemory = z.infer<typeof LoreMemorySchema>;

export const UserGraphEntrySchema = z.object({
  handle: HandleSchema,
  relationship: UserRelationshipSchema,
  interaction_count: z.number().int().min(0).default(0),
  sentiment_history: z.array(z.enum(["friendly", "neutral", "hostile"])).default([]),
  notes: z.array(z.string().min(1).max(120)).default([]),
  last_interaction: IsoTimestampSchema.optional(),
});

export type UserGraphEntry = z.infer<typeof UserGraphEntrySchema>;

export const RecentReplySchema = z.object({
  text: z.string().min(1).max(280),
  ts: IsoTimestampSchema.optional(),
});

export type RecentReply = z.infer<typeof RecentReplySchema>;

export const RecentRepliesSchema = z.object({
  recent_replies: z.array(RecentReplySchema).max(50).default([]),
});

export type RecentReplies = z.infer<typeof RecentRepliesSchema>;

/**
 * 7) Candidate Generator output
 */
export const CandidateSchema = z.object({
  candidate_id: z.string().min(1).max(12),
  reply_text: z.string().min(1).max(280),
  mode: PersonaModeSchema,
  truth_level: TruthLevelSchema,
});

export type Candidate = z.infer<typeof CandidateSchema>;

export const CandidatesSchema = z.object({
  candidates: z.array(CandidateSchema).min(1).max(9),
});

export type Candidates = z.infer<typeof CandidatesSchema>;

/**
 * 8) Candidate Selector output
 */
export const CandidateSelectionSchema = z.object({
  selected_candidate_id: z.string().min(1).max(12),
  why: z.array(z.string().min(1).max(40)).min(1).max(3),
});

export type CandidateSelection = z.infer<typeof CandidateSelectionSchema>;

/**
 * 9) Safety Rewriter output
 */
export const SafetyActionSchema = z.enum(["post", "refuse"]);
export type SafetyAction = z.infer<typeof SafetyActionSchema>;

export const SafetyRewriteSchema = z.object({
  action: SafetyActionSchema,
  final_reply_text: z.string().min(1).max(280),
});

export type SafetyRewrite = z.infer<typeof SafetyRewriteSchema>;

/**
 * 10) Lore Delta Extractor output
 */
export const LoreDeltaSchema = z.object({
  key: z.string().min(1).max(64),
  canon_or_headcanon: z.enum(["canon", "headcanon"]),
  text: z.string().min(1).max(280),
});

export type LoreDelta = z.infer<typeof LoreDeltaSchema>;

export const LoreDeltaResultSchema = z.object({
  should_write: z.boolean(),
  lore_deltas: z.array(LoreDeltaSchema).default([]),
});

export type LoreDeltaResult = z.infer<typeof LoreDeltaResultSchema>;

/**
 * Context bundle (merged)
 */
export const ContextBundleSchema = z.object({
  thread: z.object({
    root_tweet_id: z.string().min(1),
    messages: z.array(ThreadMessageSchema).default([]),
    summary: ThreadSummarySchema.optional(),
  }),
  timeline: z.object({
    window: z.number().int().min(1).max(200).default(60),
    tweets: z.array(TimelineTweetSchema).default([]),
    summary: TimelineSummarySchema.optional(),
  }),
  user_profile: z.object({
    handle: HandleSchema,
    relationship: UserRelationshipSchema,
    language: z.enum(["de", "en", "mixed"]).default("mixed"),
  }),
});

export type ContextBundle = z.infer<typeof ContextBundleSchema>;

/**
 * Safety flags + forbidden terms (inputs for safety rewriter)
 */
export const SafetyFlagsSchema = z.object({
  meta_leak: z.boolean().default(false),
  unverified_facts: z.boolean().default(false),
  toxicity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  pii_risk: z.boolean().default(false),
});

export type SafetyFlags = z.infer<typeof SafetyFlagsSchema>;

export const ForbiddenTermsSchema = z.object({
  terms: z.array(z.string().min(1).max(32)).default([]),
});

export type ForbiddenTerms = z.infer<typeof ForbiddenTermsSchema>;

// =============================================================================
// Legacy types for existing Social Persona Engine pipeline compatibility
// =============================================================================

import type { ThreadContext, TimelineBrief, AdaptiveSignals } from "../context/types.js";

/** @deprecated Use Intent - alias for pipeline compatibility */
export type IntentCategory = Intent;

/** @deprecated Use IntentResult - extended for pipeline with confidence/aggression */
export interface IntentDetectionResult {
  intent: Intent;
  confidence: number;
  entities: ExtractedEntities;
  aggression_level: "low" | "medium" | "high";
  topics: string[];
  raw_classification: string;
}

export interface ExtractedEntities {
  coins: string[];
  cashtags: string[];
  users: string[];
  urls: string[];
  contract_addresses: string[];
}

/** @deprecated Use TruthLevel - alias */
export type TruthCategory = TruthLevel;

export interface TruthClassification {
  category: TruthLevel;
  confidence: number;
  requires_verification: boolean;
  sources?: string[];
  reasoning: string;
}

export interface FactVerification {
  verified: boolean;
  source?: string;
  timestamp: string;
  expires_at?: string;
}

export interface PersonaModeConfig {
  mode: PersonaMode;
  description: string;
  tone: "analytical" | "sarcastic" | "playful" | "serious" | "mystical" | "neutral";
  meme_density: "none" | "low" | "medium" | "high";
  style_anchor: string;
  system_prompt_prefix: string;
}

export interface PersonaSelectionCriteria {
  intent: Intent;
  aggression_level: "low" | "medium" | "high";
  topic_seriousness: "low" | "medium" | "high";
  timeline_sentiment: "negative" | "neutral" | "positive";
}

export type SentimentLabel = "friendly" | "neutral" | "hostile" | "playful" | "suspicious";

export interface UserProfile {
  handle: string;
  user_id: string;
  relationship: "new" | "regular" | "enemy" | "vip" | "dev";
  first_seen: string;
  last_interaction: string;
  interaction_count: number;
  sentiment_history: SentimentLabel[];
  topics_discussed: string[];
  metadata?: Record<string, unknown>;
}

export interface LegacyLoreEntry {
  id: string;
  topic: string;
  content: string;
  created_at: string;
  last_accessed: string;
  access_count: number;
  tags: string[];
}

export interface FactEntry {
  id: string;
  topic: string;
  content: string;
  category: "token" | "chain" | "market" | "general";
  verification: FactVerification;
  created_at: string;
  updated_at: string;
}

export interface UserInteraction {
  id: string;
  user_handle: string;
  tweet_id: string;
  our_reply_id?: string;
  interaction_type: Intent;
  sentiment: SentimentLabel;
  timestamp: string;
  topic?: string;
  lore_generated?: string;
}

export interface MemoryRetrievalResult {
  relevant_lore: LegacyLoreEntry[];
  relevant_facts: FactEntry[];
  user_context?: UserProfile;
  previous_interactions: UserInteraction[];
  suggested_topics: string[];
}

export interface MemoryWriteback {
  new_lore?: Omit<LegacyLoreEntry, "id" | "created_at" | "access_count">;
  updated_facts?: Partial<FactEntry>[];
  new_interaction: Omit<UserInteraction, "id">;
}

export interface ReplyCandidate {
  candidate_id: string;
  reply_text: string;
  mode: PersonaMode;
  risk: "low" | "medium" | "high";
  truth_category: TruthLevel;
  estimated_length: number;
  generation_metadata?: {
    seed?: string;
    temperature?: number;
    model?: string;
  };
}

export interface CandidateScore {
  candidate_id: string;
  scores: {
    context_relevance: number;
    persona_fit: number;
    topic_alignment: number;
    anti_repetition: number;
    safety: number;
    overall: number;
  };
  penalties: string[];
  selection_reason: string;
}

export interface GenerationRequest {
  context: ThreadContext;
  timeline?: TimelineBrief | null;
  intent: IntentDetectionResult;
  persona_mode: PersonaMode;
  memory: MemoryRetrievalResult;
  adaptive_signals?: AdaptiveSignals | null;
  candidate_count: number;
}

export interface GenerationResult {
  candidates: ReplyCandidate[];
  generation_time_ms: number;
  model_used: string;
  prompt_tokens?: number;
}

export type PipelineStage =
  | "context_build"
  | "intent_detect"
  | "truth_gate"
  | "persona_route"
  | "memory_retrieve"
  | "generation"
  | "selection"
  | "safety_check"
  | "memory_writeback"
  | "publish";

export interface PipelineStageResult<T> {
  stage: PipelineStage;
  success: boolean;
  data?: T;
  error?: string;
  duration_ms: number;
  timestamp: string;
}

export interface PipelineTrace {
  request_id: string;
  started_at: string;
  completed_at?: string;
  stages: PipelineStageResult<unknown>[];
  final_reply?: string;
  selected_candidate?: ReplyCandidate;
  errors: string[];
  warnings: string[];
}

export interface ReplyEngineInput {
  mention: {
    tweet_id: string;
    text: string;
    author_id: string;
    author_username: string;
    created_at: string;
  };
  controls: {
    max_thread_depth: number;
    enable_timeline_scout: boolean;
    max_timeline_queries: number;
    candidate_count: number;
  };
}

export interface ReplyEngineOutput {
  reply_text: string;
  reply_id?: string;
  selected_candidate: ReplyCandidate;
  trace: PipelineTrace;
}

export type SafetyViolation =
  | "SYSTEM_PROMPT_LEAK"
  | "ARCHITECTURE_DISCLOSURE"
  | "UNVERIFIED_FACT"
  | "EXTREME_TOXICITY"
  | "FINANCIAL_ADVICE"
  | "PERSONA_DRIFT"
  | "META_LEAK"
  | "LENGTH_EXCEEDED";

export interface SafetyCheckResult {
  passed: boolean;
  violations: SafetyViolation[];
  corrected_reply?: string;
  fallback_used: boolean;
}

export interface RepetitionCheckResult {
  is_repetitive: boolean;
  similarity_score: number;
  recent_matches: string[];
  penalty_factor: number;
}
