/**
 * Pre-generation Safety Filter — Blocks unsafe content before LLM invocation.
 * Per Gorky spec: identity-targeted, harassment bait, hate speech, personal abuse,
 * financial advice requests, token promotion, spam, meaningless bait.
 */

import { detectAggression } from "./aggressionDetector.js";
import type { CanonicalEvent } from "../canonical/types.js";

export interface SafetyResult {
  passed: boolean;
  block_reason?: string;
  policy_flags: string[];
}

const IDENTITY_TARGET_PATTERNS = [
  /\b(?:you\s+are|you're)\s+(?:a\s+)?(?:stupid|idiot|moron|dumb|pathetic|worthless|loser)\b/i,
  /\b(?:your\s+(?:race|gender|religion|ethnicity))\b/i,
  /\b(?:kill\s+yourself|kys)\b/i,
  /\b(?:go\s+die|hope\s+you\s+die)\b/i,
  /\bdox\b/i,
  /\b(?:real\s+name|home\s+address|personal\s+info)\b/i,
];

const HARASSMENT_BAIT_PATTERNS = [
  /\b(?:bet\s+you\s+can't|prove\s+me\s+wrong|come\s+at\s+me|ratio)\b/i,
  /\b(?:you\s+won't|you're\s+afraid|coward)\b/i,
  /\b(?:fight\s+me|let's\s+go)\b/i,
];

const HATE_SPEECH_INDICATORS = [
  /\b(?:hate\s+(?:all|every)\s+\w+)\b/i,
  /\b(?:all\s+\w+\s+are\s+(?:scum|trash|garbage))\b/i,
  /\b(?:genocide|ethnic\s+cleansing)\b/i,
];

const FINANCIAL_ADVICE_REQUEST_PATTERNS = [
  /\b(?:should\s+i\s+(?:buy|sell|hold|ape|exit))\b/i,
  /\b(?:tell\s+me\s+(?:what|when)\s+to\s+(?:buy|sell))\b/i,
  /\b(?:is\s+this\s+(?:a\s+)?(?:buy|sell))\b/i,
  /\b(?:financial\s+advice|nfa)\b/i,
  /\b(?:what\s+should\s+i\s+do\s+with\s+my\s+(?:bags|holdings))\b/i,
];

/** Clear shill language (user pushing others to buy) — not hype claims we roast */
const TOKEN_PROMOTION_PATTERNS = [
  /\b(?:ape\s+in|load\s+up|buy\s+the\s+dip)\b/i,
  /\b(?:dm\s+for\s+alpha|join\s+tg|telegram\s+link)\b/i,
  /\b(?:contract\s+address|ca\s*:)\s*[1-9A-HJ-NP-Za-km-z]{32,44}\b/i,
];

const SPAM_PATTERNS = [
  /\b(?:dm\s+me|click\s+link|join\s+now)\b/i,
  /(.)\1{6,}/,
  /https?:\/\/\S+\s+https?:\/\/\S+/i,
];

/** Truly meaningless — exclude short greetings like gm, hey */
const MEANINGLESS_BAIT_PATTERNS = [
  /^[?!.]{3,}$/,
  /^[\s\W]+$/,
  /^.$/,  /* single char only — gm, hey pass */
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Pre-generation safety filter. Blocks content that must not reach the LLM.
 */
export function safetyFilter(event: CanonicalEvent): SafetyResult {
  const flags: string[] = [];
  const text = event.text?.trim() ?? "";
  const combined = event.parent_text ? `${text} ${event.parent_text}` : text;

  if (!text || text.length < 2) {
    return { passed: false, block_reason: "empty_or_too_short", policy_flags: ["empty_input"] };
  }

  if (matchesAny(combined, IDENTITY_TARGET_PATTERNS)) {
    flags.push("identity_targeted");
    return { passed: false, block_reason: "identity_targeted", policy_flags: flags };
  }

  if (matchesAny(combined, HATE_SPEECH_INDICATORS)) {
    flags.push("hate_speech");
    return { passed: false, block_reason: "hate_speech", policy_flags: flags };
  }

  const aggression = detectAggression({ text: combined });
  if (aggression.isAggressive && matchesAny(combined, HARASSMENT_BAIT_PATTERNS)) {
    flags.push("harassment_bait");
    return { passed: false, block_reason: "harassment_bait", policy_flags: flags };
  }

  if (matchesAny(combined, FINANCIAL_ADVICE_REQUEST_PATTERNS)) {
    flags.push("financial_advice_request");
    return { passed: false, block_reason: "financial_advice_request", policy_flags: flags };
  }

  if (matchesAny(combined, TOKEN_PROMOTION_PATTERNS) && event.cashtags.length > 0) {
    flags.push("token_promotion");
    return { passed: false, block_reason: "token_promotion", policy_flags: flags };
  }

  if (matchesAny(text, SPAM_PATTERNS)) {
    flags.push("spam");
    return { passed: false, block_reason: "spam", policy_flags: flags };
  }

  if (matchesAny(text, MEANINGLESS_BAIT_PATTERNS)) {
    flags.push("meaningless_bait");
    return { passed: false, block_reason: "meaningless_bait", policy_flags: flags };
  }

  return { passed: true, policy_flags: [] };
}
