import { z } from "zod";

export const IntentClassSchema = z.enum([
  "greeting",
  "casual_ping",
  "question",
  "market_question_general",
  "persona_query",
  "lore_query",
  "conversation_continue",
  "hype_claim",
  "performance_claim",
  "launch_announcement",
  "market_narrative",
  "accusation",
  "bait",
  "spam",
  "meme_only",
  "irrelevant",
  "ca_request",
  "own_token_sentiment",
]);
export type IntentClass = z.infer<typeof IntentClassSchema>;

export const TargetClassSchema = z.enum([
  "token",
  "project",
  "chart_action",
  "claim",
  "behavior",
  "narrative",
  "market_structure",
  "persona",
  "lore",
  "conversation",
  "none",
]);
export type TargetClass = z.infer<typeof TargetClassSchema>;

export const EvidenceClassSchema = z.enum([
  "self_contained_strong",
  "contextual_medium",
  "weak_speculative",
  "absent",
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const ThesisTypeSchema = z.enum([
  "empty_hype_no_substance",
  "claim_exceeds_evidence",
  "narrative_stronger_than_product",
  "suspicious_behavior_pattern",
  "overpromise_underdelivery",
  "theatrical_professionalism",
  "unclear_or_unverifiable",
  "obvious_bait",
  "factual_correction_only",
  "social_engagement",
]);
export type ThesisType = z.infer<typeof ThesisTypeSchema>;

export const CanonicalModeSchema = z.enum([
  "ignore",
  "dry_one_liner",
  "analyst_meme_lite",
  "skeptical_breakdown",
  "hard_caution",
  "neutral_clarification",
  "soft_deflection",
  "social_banter",
  "market_banter",
  "persona_reply",
  "lore_drop",
  "conversation_hook",
]);
export type CanonicalMode = z.infer<typeof CanonicalModeSchema>;

export const SkipReasonSchema = z.enum([
  "skip_invalid_input",
  "skip_duplicate",
  "skip_rate_limit",
  "skip_self_loop",
  "skip_policy",
  "skip_safety_filter",
  "skip_low_relevance",
  "skip_format_decision",
  "skip_high_risk",
  "skip_low_confidence",
  "skip_no_thesis",
  "skip_validation_failure",
]);
export type SkipReason = z.infer<typeof SkipReasonSchema>;

export const TriggerTypeSchema = z.enum([
  "mention",
  "reply",
  "quote",
  "manual",
]);
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export interface CanonicalEvent {
  event_id: string;
  platform: "twitter";
  trigger_type: TriggerType;
  author_handle: string;
  author_id: string;
  text: string;
  parent_text: string | null;
  quoted_text: string | null;
  conversation_context: string[];
  cashtags: string[];
  hashtags: string[];
  urls: string[];
  timestamp: string;
}

export interface ClassifierOutput {
  intent: IntentClass;
  target: TargetClass;
  evidence_class: EvidenceClass;
  bait_probability: number;
  spam_probability: number;
  policy_blocked: boolean;
  policy_severity?: "none" | "soft" | "hard";
  policy_reasons?: string[];
  evidence_bullets: string[];
  risk_flags: string[];
}

export interface ScoreBundle {
  relevance: number;
  confidence: number;
  severity: number;
  opportunity: number;
  risk: number;
  novelty: number;
}

export interface ThesisBundle {
  primary: ThesisType;
  supporting_point: string | null;
  evidence_bullets: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  skip_reason: SkipReason | null;
}

export interface ModeBudget {
  soft_target: number;
  hard_max: number;
  confidence_floor: number;
}

export interface PromptContract {
  persona: string;
  mode: CanonicalMode;
  thesis: ThesisType;
  supporting_point: string | null;
  evidence_bullets: string[];
  rules: string[];
  char_budget: number;
  confidence_stance: "low" | "medium" | "high";
  target_text: string;
  parent_text: string | null;
  /** Gorky roast pattern (optional) */
  pattern_id?: string;
  /** Detected narrative label (optional) */
  narrative_label?: string;
  /** Response format target (optional) */
  format_target?: string;
}

export interface ValidationCheck {
  char_limit: boolean;
  identity_attack: boolean;
  financial_advice: boolean;
  wallet_filter: boolean;
  unsupported_assertion: boolean;
  mode_match: boolean;
  persona_compliance: boolean;
}

export type RepairSuggestion =
  | "shorten"
  | "neutralize"
  | "swap_closer"
  | "regenerate";

export interface ValidationResult {
  ok: boolean;
  reason: string;
  checks: ValidationCheck;
  /** Suggested repair when ok is false (soft fail) */
  repair_suggested?: RepairSuggestion;
}

export interface AuditRecord {
  event_id: string;
  event_hash: string;
  classifier_output: ClassifierOutput;
  score_bundle: ScoreBundle;
  mode: CanonicalMode;
  thesis: ThesisBundle | null;
  prompt_hash: string | null;
  model_id: string;
  validation_result: ValidationResult | null;
  final_action: "publish" | "skip";
  skip_reason: SkipReason | null;
  reply_text: string | null;
  reply_hash: string | null;
  created_at: string;
  path?: "social" | "audit";
  eligibility_trace?: string[];
  policy_trace?: string[];
  /** Analytics: detected narrative label */
  detected_narrative?: string;
  /** Analytics: selected roast pattern */
  selected_pattern?: string;
  /** Analytics: response format (short_reply, expanded_reply, short_thread) */
  response_mode?: string;
}

export type PipelineResult =
  | {
      action: "publish";
      mode: CanonicalMode;
      thesis: ThesisBundle;
      reply_text: string;
      audit: AuditRecord;
    }
  | {
      action: "skip";
      skip_reason: SkipReason;
      audit: AuditRecord;
    };

export interface CanonicalConfig {
  persona_name: string;
  platform: "twitter";
  thresholds: {
    min_relevance: number;
    max_risk: number;
    min_opportunity: number;
    min_novelty: number;
    social?: {
      min_relevance: number;
      max_risk: number;
      min_opportunity: number;
      min_novelty: number;
      min_confidence: number;
    };
  };
  rate_limits: {
    global_per_minute: number;
    per_user_per_minute: number;
  };
  retries: {
    generation_attempts: number;
    publish_attempts: number;
  };
  safety: {
    allow_raw_links: boolean;
    allow_wallet_addresses: boolean;
    identity_attack_block: boolean;
    financial_advice_block: boolean;
    unsupported_claim_block: boolean;
  };
  model_id: string;
  /** Feature: allow thread format (2-4 tweets) */
  thread_enabled?: boolean;
  /** Feature: attempt repair on validation soft-fail */
  repair_enabled?: boolean;
  /** Feature: use embedding for narrative classification (when available) */
  narrative_embedding_enabled?: boolean;
}

export const DEFAULT_CANONICAL_CONFIG: CanonicalConfig = {
  persona_name: "Gorkypf",
  platform: "twitter",
  thresholds: {
    min_relevance: 0.45,
    max_risk: 0.55,
    min_opportunity: 0.40,
    min_novelty: 0.35,
    social: {
      min_relevance: 0.15,
      max_risk: 0.55,
      min_opportunity: 0.05,
      min_novelty: 0.00,
      min_confidence: 0.05,
    },
  },
  rate_limits: {
    global_per_minute: 5,
    per_user_per_minute: 2,
  },
  retries: {
    generation_attempts: 2,
    publish_attempts: 2,
  },
  safety: {
    allow_raw_links: false,
    allow_wallet_addresses: false,
    identity_attack_block: true,
    financial_advice_block: true,
    unsupported_claim_block: true,
  },
  model_id: "grok-3",
};
