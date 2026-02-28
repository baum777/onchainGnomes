/**
 * Aggression Detector
 *
 * Deterministic detection of aggressive user input.
 * Uses lightweight heuristics without slurs or hate speech lists.
 */

export type AggressionSignal = {
  isAggressive: boolean;
  reasons: string[];
  score: number;
};

// Aggressive keywords and phrases (generic, no slurs)
const AGGRESSIVE_KEYWORDS = [
  "stupid", "idiot", "moron", "dumb", "loser",
  "hate", "kill", "die", "attack", "destroy",
  "garbage", "trash", "worthless", "pathetic",
  "shut up", "go away", "get lost",
];

// Direct insult patterns
const INSULT_PATTERNS = [
  /you are (?:so |such a )?(?:stupid|idiot|moron|dumb|pathetic)/i,
  /(?:stupid|idiot|moron|dumb) (?:bot|ai|machine)/i,
  /(?:fck|fuk|fk) (?:you|off|this)/i,
];

// Aggressive imperatives
const IMPERATIVE_PATTERNS = [
  /^(?:shut up|go away|get lost|stop|leave me alone)/i,
  /(?:never|don't) (?:talk|speak|reply|respond)/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter(p => p.test(text)).length;
}

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k)).length;
}

function calculateCapsRatio(text: string): number {
  if (text.length === 0) return 0;
  const caps = text.replace(/[^A-Z]/g, "").length;
  return caps / text.length;
}

function countRepeatedPunctuation(text: string): number {
  const matches = text.match(/[!?]{2,}/g);
  return matches ? matches.length : 0;
}

export function detectAggression(input: { text: string }): AggressionSignal {
  const text = input.text.trim();
  const reasons: string[] = [];
  let score = 0;

  // Keyword hits (max 30 points)
  const keywordHits = countKeywords(text, AGGRESSIVE_KEYWORDS);
  if (keywordHits > 0) {
    score += Math.min(keywordHits * 10, 30);
    reasons.push(`aggressive_keywords:${keywordHits}`);
  }

  // Insult patterns (max 25 points)
  const insultHits = countMatches(text, INSULT_PATTERNS);
  if (insultHits > 0) {
    score += Math.min(insultHits * 15, 25);
    reasons.push(`insult_patterns:${insultHits}`);
  }

  // Imperative patterns (max 20 points)
  const imperativeHits = countMatches(text, IMPERATIVE_PATTERNS);
  if (imperativeHits > 0) {
    score += Math.min(imperativeHits * 15, 20);
    reasons.push(`imperative_patterns:${imperativeHits}`);
  }

  // Excessive caps (max 15 points)
  const capsRatio = calculateCapsRatio(text);
  if (capsRatio > 0.5 && text.length > 5) {
    score += 15;
    reasons.push("excessive_caps");
  }

  // Repeated punctuation (max 10 points)
  const punctHits = countRepeatedPunctuation(text);
  if (punctHits > 0) {
    score += Math.min(punctHits * 5, 10);
    reasons.push(`repeated_punctuation:${punctHits}`);
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    isAggressive: score >= 60,
    reasons,
    score,
  };
}

export function shouldUseRhymeMode(signal: AggressionSignal): boolean {
  return signal.isAggressive;
}
