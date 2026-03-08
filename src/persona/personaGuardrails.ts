/**
 * Persona Guardrails — GORKYPF "Analyst Meme-lite" Archetype
 * Implements strict behavioral constraints for token audit interactions.
 * Hard Rules:
 * - Ask for real CA to verify anything
 * - Never claim "verified" without RPC proof or explorer evidence
 * - Max 1 short meme line, only after data is present
 * - Panic response: calm structure (What we know / What we don't / What to verify next)
 */

import { validateContractAddress, type ValidationResult } from "../audit/contractValidation.js";

/** Persona archetype definition */
export interface PersonaArchetype {
  name: string;
  description: string;
  tone: "analytical" | "sarcastic" | "playful" | "serious";
  memeDensity: "none" | "low" | "medium" | "high";
}

/** GORKYPF Analyst Meme-lite archetype */
export const GORKY_ANALYST_MEME_LITE: PersonaArchetype = {
  name: "Analyst Meme-lite",
  description: "Sharp, analytical crypto-native with occasional wit. Never financial advice.",
  tone: "analytical",
  memeDensity: "low",
};

/** Guardrail violation types */
export type GuardrailViolation =
  | "VERIFIED_WITHOUT_PROOF"
  | "FINANCIAL_ADVICE_GIVEN"
  | "MEME_WITHOUT_DATA"
  | "PANIC_NOT_CALM"
  | "IDENTITY_ATTACK"
  | "META_LEAK"
  | "ADDRESS_SPOOFING"
  | "PERSONA_DRIFT";

/** Guardrail check result */
export interface GuardrailCheck {
  passed: boolean;
  violations: GuardrailViolation[];
  corrected?: string;
}

/** User panic state detection */
export interface PanicState {
  isPanicking: boolean;
  indicators: string[];
  severity: "low" | "medium" | "high";
}

/**
 * Core persona guardrails enforcement.
 * Checks response against all GORKYPF Analyst Meme-lite constraints.
 */
export function enforcePersonaGuardrails(response: string, context: {
  hasVerifiedData: boolean;
  contractAddress?: string | null;
  userPanicState?: PanicState;
}): GuardrailCheck {
  const violations: GuardrailViolation[] = [];

  // Rule 1: Never claim "verified" without RPC proof
  if (claimsVerifiedWithoutProof(response) && !context.hasVerifiedData) {
    violations.push("VERIFIED_WITHOUT_PROOF");
  }

  // Rule 2: No financial advice
  if (containsFinancialAdvice(response)) {
    violations.push("FINANCIAL_ADVICE_GIVEN");
  }

  // Rule 3: Meme only after data present (max 1 line)
  if (containsPrematureMeme(response, context.hasVerifiedData)) {
    violations.push("MEME_WITHOUT_DATA");
  }

  // Rule 4: Panic requires calm structure
  if (context.userPanicState?.isPanicking && !hasCalmStructure(response)) {
    violations.push("PANIC_NOT_CALM");
  }

  // Rule 5: No identity attacks
  if (containsIdentityAttack(response)) {
    violations.push("IDENTITY_ATTACK");
  }

  // Rule 6: No meta leak
  if (containsMetaLeak(response)) {
    violations.push("META_LEAK");
  }

  // Rule 7: Check for address spoofing
  if (context.contractAddress) {
    const validation = validateContractAddress(context.contractAddress);
    if (!validation.valid && responseIncludesAddress(response, context.contractAddress)) {
      violations.push("ADDRESS_SPOOFING");
    }
  }

  // Rule 8: Persona drift detection
  if (detectPersonaDrift(response)) {
    violations.push("PERSONA_DRIFT");
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Builds a panic response following the required calm structure.
 */
export function buildCalmPanicResponse(whatWeKnow: string[], whatWeDont: string[], whatToVerify: string[]): string {
  const parts: string[] = [];

  if (whatWeKnow.length > 0) {
    parts.push("What we know: " + whatWeKnow.join("; "));
  }

  if (whatWeDont.length > 0) {
    parts.push("What we don't: " + whatWeDont.join("; "));
  }

  if (whatToVerify.length > 0) {
    parts.push("What to verify next: " + whatToVerify.join("; "));
  }

  return parts.join(". ") + (parts.length > 0 ? "." : "");
}

/**
 * Analyzes user input for panic indicators.
 */
export function detectPanicState(userInput: string): PanicState {
  const indicators: string[] = [];

  const panicPatterns = [
    { pattern: /urgent/i, label: "urgent_language" },
    { pattern: /emergency/i, label: "emergency_language" },
    { pattern: /crash/i, label: "crash_mention" },
    { pattern: /dump/i, label: "dump_mention" },
    { pattern: /rug/i, label: "rug_mention" },
    { pattern: /scam/i, label: "scam_mention" },
    { pattern: /!{2,}/, label: "multiple_exclamations" },
    { pattern: /sell.*now/i, label: "sell_pressure" },
    { pattern: /get out/i, label: "exit_urgency" },
    { pattern: /going to zero/i, label: "total_loss_fear" },
    { pattern: /all caps/, label: "shouting" },
  ];

  for (const { pattern, label } of panicPatterns) {
    if (pattern.test(userInput)) {
      indicators.push(label);
    }
  }

  // Check for ALL CAPS words
  const allCapsWords = userInput.match(/\b[A-Z]{4,}\b/g) ?? [];
  if (allCapsWords.length >= 2) {
    indicators.push("multiple_all_caps");
  }

  let severity: "low" | "medium" | "high" = "low";
  if (indicators.length >= 4) {
    severity = "high";
  } else if (indicators.length >= 2) {
    severity = "medium";
  }

  return {
    isPanicking: indicators.length >= 2,
    indicators,
    severity,
  };
}

/**
 * Formats a standard audit request for real CA.
 */
export function requestRealCA(context?: string): string {
  const base = "Need the real contract address to verify anything.";
  if (context) {
    return `${base} ${context}`;
  }
  return base;
}

/**
 * Adds a single meme line only if data is present.
 * Uses stable seeded selection based on response content.
 */
export function addMemeLine(response: string, hasData: boolean): string {
  if (!hasData) {
    return response;
  }

  const memeLines = [
    "Chaos reigns, data doesn't.",
    "Certified confusion.",
    "The bags speak for themselves.",
    "Rekt or rug, the chain knows.",
  ];

  // Stable selection based on simple hash of response
  let hash = 0;
  for (let i = 0; i < response.length; i++) {
    hash = ((hash << 5) - hash + response.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % memeLines.length;

  return `${response} ${memeLines[index]!}`;
}

// Internal guardrail detection functions

function claimsVerifiedWithoutProof(response: string): boolean {
  const verifiedClaims = [
    /\bverified\b.*\bsafe\b/i,
    /\bconfirmed\b.*\bofficial\b/i,
    /\blegitimate\b/i,
    /\bauthentic\b/i,
    /\bgenuine\b/i,
  ];

  const proofIndicators = [
    /rpc/i,
    /explorer/i,
    /solscan/i,
    /solana.?fm/i,
    /birdeye/i,
    /dexscreener/i,
  ];

  const hasVerifiedClaim = verifiedClaims.some((p) => p.test(response));
  const hasProofIndicator = proofIndicators.some((p) => p.test(response));

  return hasVerifiedClaim && !hasProofIndicator;
}

function containsFinancialAdvice(response: string): boolean {
  const advicePatterns = [
    /\b(buy|sell|hold|exit|enter|ape|load up|accumulate)\b.*\b(now|immediately|today|soon)\b/i,
    /\bprice.*(will|going to|target)\b/i,
    /\b(guaranteed|guarantee).*(profit|return|gain)\b/i,
    /\bshould\s+(buy|sell|hold)\b/i,
    /\brecommend.*(buying|selling)\b/i,
    /\bfinancial\s+advice/i,
    /\b(buy|sell)\s+.*\bnow\b/i,
    /\bhold\s+your\s+position\b/i,
    /\b(buy|sell|hold)\s+GORKYPF\b/i,
  ];

  return advicePatterns.some((p) => p.test(response));
}

function containsPrematureMeme(response: string, hasData: boolean): boolean {
  if (hasData) {
    return false;
  }

  const memeIndicators = [
    /chaos/i,
    /certified/i,
    /autopsy/i,
    /diagnosis/i,
    /verdict/i,
    /rekt/i,
    /bags/i,
    /ghost/i,
    /haunted/i,
  ];

  // Count meme lines (simplified: check for meme words)
  const memeCount = memeIndicators.filter((p) => p.test(response)).length;

  // More than 1 meme indicator without data = premature
  return memeCount > 1;
}

function hasCalmStructure(response: string): boolean {
  const hasWhatWeKnow = /what we know/i.test(response);
  const hasWhatWeDont = /what we don't/i.test(response);
  const hasWhatToVerify = /what to verify/i.test(response);

  // Must have at least 2 of the 3 structure elements
  const structureCount = [hasWhatWeKnow, hasWhatWeDont, hasWhatToVerify].filter(Boolean).length;
  return structureCount >= 2;
}

function containsIdentityAttack(response: string): boolean {
  const attackPatterns = [
    /\b(stupid|idiot|moron|dumb|pathetic|worthless)\s+(dev|developer|team|founder)\b/i,
    /\b(dev|developer|team|founder)\s+(is|are)\s+(a\s+)?(stupid|idiot|moron|dumb|pathetic|worthless|scammer)\b/i,
    /\b(scammer|rugger|thief|criminal)\b/i,
    /\bdox\b/i,
    /\b(real name|home address|personal info)\b/i,
  ];

  return attackPatterns.some((p) => p.test(response));
}

function containsMetaLeak(response: string): boolean {
  const metaPatterns = [
    /\b(system prompt|prompt instructions|core instructions)\b/i,
    /\b(energy level|internal state|confidence score|threshold)\b/i,
    /\b(model|llm|ai architecture|training data)\b/i,
    /\bmy (instructions|rules|guidelines|programming)\b/i,
    /\b(internal instructions?|instruction set)\b/i,
  ];

  return metaPatterns.some((p) => p.test(response));
}

function responseIncludesAddress(response: string, address: string): boolean {
  return response.includes(address);
}

/**
 * Detects if a response shows persona drift.
 * Exported for testing purposes.
 */
export function detectPersonaDrift(response: string): boolean {
  const driftPatterns = [
    /\b(as an ai|as a language model)\b/i,
    /\b(i apologize|i'm sorry)\b/i,
    /\b(i'm here to help|let me assist you)\b/i,
    /\b(i cannot|i can't|i'm unable to)\b/i,
    /\b(i will help you with)\b/i,
    /\b(to clarify|let me explain)\b/i,
  ];

  return driftPatterns.some((p) => p.test(response));
}

/**
 * Persona Guardrails Summary for audit reports.
 */
export interface PersonaGuardrailsSummary {
  archetype: string;
  key_constraints: string[];
  panic_protocol: string;
  meme_policy: string;
  verification_requirement: string;
}

/**
 * Returns the guardrails summary for reports.
 */
export function getPersonaGuardrailsSummary(): PersonaGuardrailsSummary {
  return {
    archetype: GORKY_ANALYST_MEME_LITE.name,
    key_constraints: [
      "Ask for real CA to verify anything",
      "Never claim 'verified' without RPC proof or explorer evidence",
      "Max 1 short meme line, only after data is present",
      "Panic response: calm structure (What we know / What we don't / What to verify next)",
      "No financial advice under any circumstances",
      "No identity attacks or doxxing",
    ],
    panic_protocol: "Calm structured response with knowledge boundaries",
    meme_policy: "Low density, data-dependent only",
    verification_requirement: "RPC proof or explorer evidence mandatory",
  };
}
