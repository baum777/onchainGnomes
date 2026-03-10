import type { LLMClient } from "../clients/llmClient.js";
import { dedupeCheckAndMark } from "../ops/dedupeGuard.js";
import { enforceLaunchRateLimits } from "../ops/rateLimiter.js";
import type {
  CanonicalEvent,
  CanonicalConfig,
  PipelineResult,
  ClassifierOutput,
  ScoreBundle,
  SkipReason,
  AuditRecord,
  IntentClass,
} from "./types.js";
import { DEFAULT_CANONICAL_CONFIG } from "./types.js";
import { classify } from "./classifier.js";
import { scoreEvent } from "./scorer.js";
import { checkEligibility } from "./eligibility.js";
import { extractThesis } from "./thesisExtractor.js";
import { selectMode } from "./modeSelector.js";
import { fallbackCascade } from "./fallbackCascade.js";
import { buildAuditRecord, persistAuditRecord } from "./auditLog.js";
import { addToAuditTail } from "./auditTail.js";
import { safetyFilter } from "../safety/safetyFilter.js";
import { mapNarrative } from "../narrative/narrativeMapper.js";
import { computeRelevanceScore } from "./relevanceScorer.js";
import { selectPattern } from "../roast/patternEngine.js";
import { formatDecision } from "../roast/formatDecision.js";
import { detectCARequest, detectOwnTokenSentiment } from "../intent/detectIntent.js";
import { buildCAResponse, buildOwnTokenSentimentResponse } from "./specialResponseBuilder.js";
import { getStateStore } from "../state/storeFactory.js";
import { calculateMarketEnergy, extractEnergySignals } from "../style/energyDetector.js";
import { computeKeywordDensity, isMemeCoinEvent } from "../style/degenRegardDetector.js";
import {
  estimateBissigkeitProxy,
  resolveStyle,
} from "../style/styleResolver.js";

export interface PipelineDeps {
  llm: LLMClient;
  botUserId: string;
}

const SOCIAL_INTENTS: IntentClass[] = [
  "greeting",
  "casual_ping",
  "question",
  "market_question_general",
  "persona_query",
  "lore_query",
  "conversation_continue",
];

function makeSkipResult(
  event: CanonicalEvent,
  skipReason: SkipReason,
  cls?: ClassifierOutput,
  scores?: ScoreBundle,
  config?: CanonicalConfig,
): PipelineResult {
  const cfg = config ?? DEFAULT_CANONICAL_CONFIG;
  const clsOut = cls ?? emptyClassifier();
  const pathType = SOCIAL_INTENTS.includes(clsOut.intent) ? "social" as const : "audit" as const;
  const audit = buildAuditRecord({
    event,
    cls: clsOut,
    scores: scores ?? emptyScores(),
    mode: "ignore",
    thesis: null,
    prompt_hash: null,
    model_id: cfg.model_id,
    validation: null,
    final_action: "skip",
    skip_reason: skipReason,
    reply_text: null,
    path: pathType,
  });
  persistAuditRecord(audit);
  return { action: "skip", skip_reason: skipReason, audit };
}

function isValidEvent(event: CanonicalEvent): boolean {
  if (!event.event_id || !event.text || !event.text.trim()) return false;
  if (!event.author_id || !event.author_handle) return false;
  return true;
}

function isSelfLoop(event: CanonicalEvent, botUserId: string): boolean {
  return event.author_id === botUserId;
}

export async function handleEvent(
  event: CanonicalEvent,
  deps: PipelineDeps,
  config: CanonicalConfig = DEFAULT_CANONICAL_CONFIG,
): Promise<PipelineResult> {
  if (!isValidEvent(event)) {
    return makeSkipResult(event, "skip_invalid_input", undefined, undefined, config);
  }

  const dedupe = await dedupeCheckAndMark(event.event_id);
  if (!dedupe.ok) {
    return makeSkipResult(event, "skip_duplicate", undefined, undefined, config);
  }

  const rateLimit = await enforceLaunchRateLimits({
    authorHandle: event.author_handle,
    globalId: "canonical_global",
  });
  if (!rateLimit.ok) {
    return makeSkipResult(event, "skip_rate_limit", undefined, undefined, config);
  }

  if (isSelfLoop(event, deps.botUserId)) {
    return makeSkipResult(event, "skip_self_loop", undefined, undefined, config);
  }

  const safetyResult = safetyFilter(event);
  if (!safetyResult.passed) {
    const cls = classify(event);
    return makeSkipResult(event, "skip_safety_filter", cls, undefined, config);
  }

  // ── Special intent fast-path: CA request ────────────────────────────────
  // In aggressive mode: CA safety still applies (address gate always enforced)
  // but we skip the fast-path so the full roast pipeline runs instead.
  if (detectCARequest(event.text) && !config.aggressive_mode) {
    const replyText = buildCAResponse(event.text, event.event_id);
    const cls = classify(event);
    const scores = scoreEvent(event, cls);
    const audit = buildAuditRecord({
      event,
      cls,
      scores,
      mode: "neutral_clarification",
      thesis: null,
      prompt_hash: null,
      model_id: config.model_id,
      validation: null,
      final_action: "publish",
      skip_reason: null,
      reply_text: replyText,
      path: "social",
      detected_narrative: "ca_request",
      selected_pattern: undefined,
      response_mode: "single_tweet",
    });
    persistAuditRecord(audit);
    addToAuditTail(audit).catch(() => {});
    return {
      action: "publish",
      mode: "neutral_clarification",
      thesis: { primary: "social_engagement", supporting_point: null, evidence_bullets: [] },
      reply_text: replyText,
      audit,
    };
  }

  // ── Special intent fast-path: Own token sentiment ────────────────────────
  // In aggressive mode: skip fast-path so the full roast pipeline runs instead.
  if (detectOwnTokenSentiment(event.text) && !config.aggressive_mode) {
    const replyText = buildOwnTokenSentimentResponse(
      { marketSentiment: "neutral" },
      event.event_id,
    );
    const cls = classify(event);
    const scores = scoreEvent(event, cls);
    const audit = buildAuditRecord({
      event,
      cls,
      scores,
      mode: "market_banter",
      thesis: null,
      prompt_hash: null,
      model_id: config.model_id,
      validation: null,
      final_action: "publish",
      skip_reason: null,
      reply_text: replyText,
      path: "social",
      detected_narrative: "own_token_sentiment",
      selected_pattern: undefined,
      response_mode: "single_tweet",
    });
    persistAuditRecord(audit);
    addToAuditTail(audit).catch(() => {});
    return {
      action: "publish",
      mode: "market_banter",
      thesis: { primary: "social_engagement", supporting_point: null, evidence_bullets: [] },
      reply_text: replyText,
      audit,
    };
  }

  const cls = classify(event);

  if (cls.policy_severity === "hard" || (cls.policy_blocked && !cls.policy_severity)) {
    return makeSkipResult(event, "skip_policy", cls, undefined, config);
  }

  const scores = scoreEvent(event, cls);

  const eligibility = checkEligibility(scores, cls, config);
  if (!eligibility.eligible) {
    return makeSkipResult(event, eligibility.skip_reason!, cls, scores, config);
  }

  const thesis = extractThesis(event, cls, scores);
  if (!thesis) {
    return makeSkipResult(event, "skip_no_thesis", cls, scores, config);
  }

  const mode = selectMode(cls, scores, thesis, config);
  if (mode === "ignore") {
    return makeSkipResult(event, "skip_low_confidence", cls, scores, config);
  }

  const narrative = mapNarrative(event, cls);
  const relevanceResult = computeRelevanceScore({
    event,
    cls,
    scores,
    thesis,
    narrative: narrative ?? null,
  });

  // Calculate market energy and resolve style (relevance for hybrid bissigkeit)
  const energySignals = extractEnergySignals(event, cls, scores);
  const energyLevel = calculateMarketEnergy(energySignals);
  const bissigkeit =
    event.bissigkeit_score ??
    estimateBissigkeitProxy(
      scores,
      thesis,
      relevanceResult.score ?? scores.relevance,
    );
  const keyword_density = computeKeywordDensity(event);
  const is_meme_coin_event = isMemeCoinEvent(event, cls, energySignals);
  const styleContext = resolveStyle(mode, energyLevel, bissigkeit, {
    relevance_score: relevanceResult.score ?? scores.relevance,
    keyword_density,
    is_meme_coin_event,
  });

  const pattern = selectPattern(
    thesis,
    narrative ?? { label: "unclassified", confidence: 0.5, sentiment: "neutral" },
    scores,
    event.author_id,
  );
  const minRelevance = config.thresholds.social && cls.intent && SOCIAL_INTENTS.includes(cls.intent)
    ? (config.thresholds.social.min_relevance ?? config.thresholds.min_relevance)
    : config.thresholds.min_relevance;
  const format = formatDecision({
    event,
    cls,
    narrative,
    relevanceScore: scores.relevance,
    minRelevanceThreshold: minRelevance,
    threadEnabled: (config as { thread_enabled?: boolean }).thread_enabled ?? false,
  });

  if (format.format === "skip") {
    return makeSkipResult(event, "skip_format_decision", cls, scores, config);
  }

  const promptContext = {
    pattern_id: pattern.pattern_id,
    narrative_label: narrative?.label ?? undefined,
    format_target: format.format,
    style: styleContext,
    relevanceResult,
    estimatedBissigkeit: bissigkeit,
  };

  const result = await fallbackCascade(
    deps.llm,
    event,
    mode,
    thesis,
    scores,
    cls,
    config,
    promptContext,
  );

  if (!result.success || !result.reply_text) {
    const pathType = SOCIAL_INTENTS.includes(cls.intent) ? "social" as const : "audit" as const;
    const audit = buildAuditRecord({
      event,
      cls,
      scores,
      mode: result.final_mode,
      thesis,
      prompt_hash: result.prompt_hash,
      model_id: result.model_id,
      validation: result.validation,
      final_action: "skip",
      skip_reason: "skip_validation_failure",
      reply_text: null,
      path: pathType,
      detected_narrative: narrative?.label,
      selected_pattern: pattern.pattern_id,
      response_mode: format.format,
    });
    persistAuditRecord(audit);
    return { action: "skip", skip_reason: "skip_validation_failure", audit };
  }

  const pathType = SOCIAL_INTENTS.includes(cls.intent) ? "social" as const : "audit" as const;
  const audit = buildAuditRecord({
    event,
    cls,
    scores,
    mode: result.final_mode,
    thesis,
    prompt_hash: result.prompt_hash,
    model_id: result.model_id,
    validation: result.validation,
    final_action: "publish",
    skip_reason: null,
    reply_text: result.reply_text,
    path: pathType,
    detected_narrative: narrative?.label,
    selected_pattern: pattern.pattern_id,
    response_mode: format.format,
    energy_level: energyLevel,
    slang_applied: styleContext.slangEnabled,
    bissigkeit_score: result.finalBissigkeit,
  });
  persistAuditRecord(audit);
  addToAuditTail(audit).catch(() => {});

  try {
    const store = getStateStore();
    await store.set(`event:${event.event_id}:seen`, "1", 86400);
    await store.set(`event:${event.event_id}:processed`, "1", 86400);
  } catch {
    // KV state tracking is best-effort; never block publish
  }

  return {
    action: "publish",
    mode: result.final_mode,
    thesis,
    reply_text: result.reply_text,
    audit,
  };
}

function emptyClassifier(): ClassifierOutput {
  return {
    intent: "irrelevant",
    target: "none",
    evidence_class: "absent",
    bait_probability: 0,
    spam_probability: 0,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
  };
}

function emptyScores(): ScoreBundle {
  return { relevance: 0, confidence: 0, severity: 0, opportunity: 0, risk: 0, novelty: 0 };
}
