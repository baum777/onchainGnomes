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
} from "./types.js";
import { DEFAULT_CANONICAL_CONFIG } from "./types.js";
import { classify } from "./classifier.js";
import { scoreEvent } from "./scorer.js";
import { checkEligibility } from "./eligibility.js";
import { extractThesis } from "./thesisExtractor.js";
import { selectMode } from "./modeSelector.js";
import { fallbackCascade } from "./fallbackCascade.js";
import { buildAuditRecord, persistAuditRecord } from "./auditLog.js";

export interface PipelineDeps {
  llm: LLMClient;
  botUserId: string;
}

function makeSkipResult(
  event: CanonicalEvent,
  skipReason: SkipReason,
  cls?: ClassifierOutput,
  scores?: ScoreBundle,
  config?: CanonicalConfig,
): PipelineResult {
  const cfg = config ?? DEFAULT_CANONICAL_CONFIG;
  const audit = buildAuditRecord({
    event,
    cls: cls ?? emptyClassifier(),
    scores: scores ?? emptyScores(),
    mode: "ignore",
    thesis: null,
    prompt_hash: null,
    model_id: cfg.model_id,
    validation: null,
    final_action: "skip",
    skip_reason: skipReason,
    reply_text: null,
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

  const cls = classify(event);

  if (cls.policy_blocked) {
    return makeSkipResult(event, "skip_policy", cls, undefined, config);
  }

  const scores = scoreEvent(event, cls);

  const eligibility = checkEligibility(scores, config);
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

  const result = await fallbackCascade(
    deps.llm,
    event,
    mode,
    thesis,
    scores,
    cls,
    config,
  );

  if (!result.success || !result.reply_text) {
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
    });
    persistAuditRecord(audit);
    return { action: "skip", skip_reason: "skip_validation_failure", audit };
  }

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
  });
  persistAuditRecord(audit);

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
