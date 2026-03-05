/**
 * Core Types - Context-Aware Social Persona Engine
 *
 * Central type definitions for the entire system including:
 * - User profiles and relationships
 * - Intent categories and truth classification
 * - Persona modes and reply candidates
 * - Memory system types (lore, facts, user graph)
 */

import type { ThreadContext, TimelineBrief, AdaptiveSignals } from "../context/types.js";

// =============================================================================
// USER SYSTEM
// =============================================================================

/** User relationship categories for interaction tracking */
export type UserRelationship = "new" | "regular" | "enemy" | "vip";

/** User profile with relationship metadata */
export interface UserProfile {
  handle: string;
  user_id: string;
  relationship: UserRelationship;
  first_seen: string;
  last_interaction: string;
  interaction_count: number;
  sentiment_history: SentimentLabel[];
  topics_discussed: string[];
  metadata?: Record<string, unknown>;
}

/** Sentiment labels for interaction history */
export type SentimentLabel = "friendly" | "neutral" | "hostile" | "playful" | "suspicious";

// =============================================================================
// INTENT SYSTEM
// =============================================================================

/** Intent categories for LLM-based classification */
export type IntentCategory =
  | "question"
  | "insult"
  | "debate"
  | "market_request"
  | "meme_play"
  | "prompt_attack"
  | "lore_query"
  | "coin_query";

/** Entity types extracted from user messages */
export interface ExtractedEntities {
  coins: string[];
  cashtags: string[];
  users: string[];
  urls: string[];
  contract_addresses: string[];
}

/** Complete intent detection result */
export interface IntentDetectionResult {
  intent: IntentCategory;
  confidence: number;
  entities: ExtractedEntities;
  aggression_level: "low" | "medium" | "high";
  topics: string[];
  raw_classification: string;
}

// =============================================================================
// TRUTH GATE SYSTEM
// =============================================================================

/** Truth categories for response classification */
export type TruthCategory = "FACT" | "LORE" | "OPINION";

/** Truth gate classification result */
export interface TruthClassification {
  category: TruthCategory;
  confidence: number;
  requires_verification: boolean;
  sources?: string[];
  reasoning: string;
}

/** Verification status for facts */
export interface FactVerification {
  verified: boolean;
  source?: string;
  timestamp: string;
  expires_at?: string;
}

// =============================================================================
// PERSONA SYSTEM
// =============================================================================

/** Persona modes for the crypto-native sarcastic analyst */
export type PersonaMode = "analyst" | "goblin" | "scientist" | "prophet" | "referee";

/** Persona selection criteria */
export interface PersonaSelectionCriteria {
  intent: IntentCategory;
  aggression_level: "low" | "medium" | "high";
  topic_seriousness: "low" | "medium" | "high";
  timeline_sentiment: "negative" | "neutral" | "positive";
}

/** Persona mode with metadata */
export interface PersonaModeConfig {
  mode: PersonaMode;
  description: string;
  tone: "analytical" | "sarcastic" | "playful" | "serious" | "mystical" | "neutral";
  meme_density: "none" | "low" | "medium" | "high";
  style_anchor: string;
  system_prompt_prefix: string;
}

// =============================================================================
// MEMORY SYSTEM
// =============================================================================

/** Lore entry - narrative memory (creative but stored) */
export interface LoreEntry {
  id: string;
  topic: string;
  content: string;
  created_at: string;
  last_accessed: string;
  access_count: number;
  tags: string[];
}

/** Fact entry - verified on-chain or market data */
export interface FactEntry {
  id: string;
  topic: string;
  content: string;
  category: "token" | "chain" | "market" | "general";
  verification: FactVerification;
  created_at: string;
  updated_at: string;
}

/** User interaction record for the user graph */
export interface UserInteraction {
  id: string;
  user_handle: string;
  tweet_id: string;
  our_reply_id?: string;
  interaction_type: IntentCategory;
  sentiment: SentimentLabel;
  timestamp: string;
  topic?: string;
  lore_generated?: string;
}

/** Memory retrieval result combining all layers */
export interface MemoryRetrievalResult {
  relevant_lore: LoreEntry[];
  relevant_facts: FactEntry[];
  user_context?: UserProfile;
  previous_interactions: UserInteraction[];
  suggested_topics: string[];
}

/** Memory writeback operation */
export interface MemoryWriteback {
  new_lore?: Omit<LoreEntry, "id" | "created_at" | "access_count">;
  updated_facts?: Partial<FactEntry>[];
  new_interaction: Omit<UserInteraction, "id">;
}

// =============================================================================
// GENERATION SYSTEM
// =============================================================================

/** Individual reply candidate */
export interface ReplyCandidate {
  candidate_id: string;
  reply_text: string;
  mode: PersonaMode;
  risk: "low" | "medium" | "high";
  truth_category: TruthCategory;
  estimated_length: number;
  generation_metadata?: {
    seed?: string;
    temperature?: number;
    model?: string;
  };
}

/** Candidate scoring result */
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

/** Generation request parameters */
export interface GenerationRequest {
  context: ThreadContext;
  timeline?: TimelineBrief | null;
  intent: IntentDetectionResult;
  persona_mode: PersonaMode;
  memory: MemoryRetrievalResult;
  adaptive_signals?: AdaptiveSignals | null;
  candidate_count: number;
}

/** Generation response with candidates */
export interface GenerationResult {
  candidates: ReplyCandidate[];
  generation_time_ms: number;
  model_used: string;
  prompt_tokens?: number;
}

// =============================================================================
// PIPELINE SYSTEM
// =============================================================================

/** Pipeline stage status */
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

/** Pipeline stage result */
export interface PipelineStageResult<T> {
  stage: PipelineStage;
  success: boolean;
  data?: T;
  error?: string;
  duration_ms: number;
  timestamp: string;
}

/** Complete pipeline trace */
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

/** Reply engine input */
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

/** Reply engine output */
export interface ReplyEngineOutput {
  reply_text: string;
  reply_id?: string;
  selected_candidate: ReplyCandidate;
  trace: PipelineTrace;
}

// =============================================================================
// SAFETY & GUARDRAILS
// =============================================================================

/** Safety check categories */
export type SafetyViolation =
  | "SYSTEM_PROMPT_LEAK"
  | "ARCHITECTURE_DISCLOSURE"
  | "UNVERIFIED_FACT"
  | "EXTREME_TOXICITY"
  | "FINANCIAL_ADVICE"
  | "PERSONA_DRIFT"
  | "META_LEAK"
  | "LENGTH_EXCEEDED";

/** Safety check result */
export interface SafetyCheckResult {
  passed: boolean;
  violations: SafetyViolation[];
  corrected_reply?: string;
  fallback_used: boolean;
}

/** Repetition guard check result */
export interface RepetitionCheckResult {
  is_repetitive: boolean;
  similarity_score: number;
  recent_matches: string[];
  penalty_factor: number;
}

// =============================================================================
// ZOD SCHEMAS (for runtime validation)
// =============================================================================

export const UserRelationshipSchema = {
  enum: ["new", "regular", "enemy", "vip"] as const,
};

export const IntentCategorySchema = {
  enum: [
    "question",
    "insult",
    "debate",
    "market_request",
    "meme_play",
    "prompt_attack",
    "lore_query",
    "coin_query",
  ] as const,
};

export const TruthCategorySchema = {
  enum: ["FACT", "LORE", "OPINION"] as const,
};

export const PersonaModeSchema = {
  enum: ["analyst", "goblin", "scientist", "prophet", "referee"] as const,
};

export const SentimentLabelSchema = {
  enum: ["friendly", "neutral", "hostile", "playful", "suspicious"] as const,
};
