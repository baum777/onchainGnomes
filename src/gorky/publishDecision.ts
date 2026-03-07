/**
 * Gorky Publish Decision — Consolidates pre/post publish checks.
 *
 * Called by pipeline (pre) and worker (post). Does NOT replace existing
 * dedupeGuard, rateLimiter, or launchGate — wraps them for Gorky semantics.
 *
 * Integration: pipeline.ts calls prePublishChecks before handleEvent (or uses
 * dedupe+rateLimit inline). pollMentions.ts calls postPublishCheck after
 * handleEvent, before xClient.reply.
 */

import { dedupeCheckAndMark } from "../ops/dedupeGuard.js";
import { enforceLaunchRateLimits } from "../ops/rateLimiter.js";
import { shouldPost as launchGateShouldPost } from "../ops/launchGate.js";

// --- Types ---

export type PublishSkipReason =
  | "duplicate"
  | "rate_limit"
  | "launch_gate"
  | "validation_failed"
  | "blocked";

export type PublishDecision =
  | { allow: true }
  | { allow: false; reason: PublishSkipReason; details?: string };

export interface PrePublishParams {
  eventId: string;
  authorHandle: string;
}

export interface PostPublishParams {
  authorHandle: string | undefined;
}

// --- Pre-publish checks (before handleEvent) ---

/**
 * Runs dedupe + rate limit. Call before handleEvent.
 * Pipeline already does this inline; this is the consolidated Gorky entry point.
 */
export async function prePublishChecks(
  params: PrePublishParams
): Promise<PublishDecision> {
  // Logging hook: prePublishChecks.enter
  const dedupe = await dedupeCheckAndMark(params.eventId);
  if (!dedupe.ok) {
    // Logging hook: prePublishChecks.skip.reason=duplicate
    return { allow: false, reason: "duplicate" };
  }

  const rateLimit = await enforceLaunchRateLimits({
    authorHandle: params.authorHandle,
    globalId: "canonical_global",
  });
  if (!rateLimit.ok) {
    // Logging hook: prePublishChecks.skip.reason=rate_limit
    return {
      allow: false,
      reason: "rate_limit",
      details: "retryAfterMs" in rateLimit ? String(rateLimit.retryAfterMs) : undefined,
    };
  }

  return { allow: true };
}

// --- Post-publish check (after handleEvent, before xClient.reply) ---

/**
 * Runs launch gate (off/dry_run/staging/prod).
 * staging = restricted = allowlist only.
 * prod = full = publish all eligible.
 */
export function postPublishCheck(params: PostPublishParams): PublishDecision {
  const decision = launchGateShouldPost(params.authorHandle);

  if (decision.action === "post") {
    return { allow: true };
  }

  // Logging hook: postPublishCheck.skip.reason=launch_gate, details=decision.reason
  return {
    allow: false,
    reason: "launch_gate",
    details: decision.reason,
  };
}

// --- Validation gate handoff ---

/**
 * Maps pipeline skip_reason to PublishSkipReason for analytics.
 * Used when pipeline returns action=skip.
 */
export function mapSkipReasonToPublishReason(
  skipReason: string
): PublishSkipReason {
  if (skipReason === "skip_duplicate") return "duplicate";
  if (skipReason === "skip_rate_limit") return "rate_limit";
  if (skipReason === "skip_safety_filter" || skipReason === "skip_policy")
    return "blocked";
  if (skipReason === "skip_validation_failure") return "validation_failed";
  return "launch_gate";
}
