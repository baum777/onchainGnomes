import { detectAggression } from "../safety/aggressionDetector.js";
import type {
  CanonicalEvent,
  ClassifierOutput,
  IntentClass,
  TargetClass,
  EvidenceClass,
} from "./types.js";

const HYPE_PATTERNS = [
  /\b(?:moon|mooning|100x|1000x|10x|50x|gem|alpha|next\s+\w+x)\b/i,
  /\b(?:going\s+parabolic|lfg|wagmi|ngmi|to\s+the\s+moon)\b/i,
  /\b(?:guaranteed|easy\s+money|free\s+money|can't\s+lose)\b/i,
];

const PERFORMANCE_PATTERNS = [
  /\b\d+[%xX]\s*(?:gain|profit|return|up|pump)/i,
  /\b(?:ath|all.time.high|breaking\s+out)\b/i,
  /\b(?:doubled|tripled|10x['\u2019]?d)\b/i,
];

const LAUNCH_PATTERNS = [
  /\b(?:just\s+launched|stealth\s+launch|presale|fair\s+launch|mint\s+live)\b/i,
  /\b(?:contract\s+address|ca:|dex\s+listing)\b/i,
];

const QUESTION_PATTERNS = [
  /\?$/,
  /\b(?:what|how|why|when|where|is\s+this|should\s+i|can\s+you)\b/i,
];

const ACCUSATION_PATTERNS = [
  /\b(?:scam|rug|rugpull|fraud|ponzi|honeypot|fake|steal|stolen)\b/i,
  /\b(?:dev\s+sold|dev\s+dumped|insider)\b/i,
];

const BAIT_PATTERNS = [
  /\b(?:bet\s+you\s+can't|prove\s+me\s+wrong|come\s+at\s+me|ratio)\b/i,
  /\b(?:you\s+won't|you're\s+afraid|coward)\b/i,
];

const SPAM_PATTERNS = [
  /\b(?:dm\s+me|click\s+link|join\s+now|airdrop|giveaway)\b/i,
  /(.)\1{4,}/,
];

const MEME_PATTERNS = [
  /\b(?:lmao|lol|rofl|bruh|cope|seethe|based|fren)\b/i,
  /[\u{1F600}-\u{1F64F}]{3,}/u,
];

const MARKET_NARRATIVE_PATTERNS = [
  /\b(?:bull\s*run|bear\s*market|cycle|narrative|sector\s+rotation)\b/i,
  /\b(?:macro|fed|interest\s+rate|btc\s+dominance)\b/i,
];

const PRODUCT_PROOF_PATTERNS = [
  /\b(?:audit|github|testnet|mainnet|tvl|dau|mau|revenue|users)\b/i,
  /\b(?:smart\s+contract|verified|open.source)\b/i,
];

const VOLUME_BEHAVIOR_PATTERNS = [
  /\b(?:wash\s+trading|bot\s+volume|fake\s+volume|same\s+wallet)\b/i,
  /\b(?:suspicious\s+(?:transfer|activity|wallet))\b/i,
];

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

function classifyIntent(event: CanonicalEvent): IntentClass {
  const text = event.text;

  if (countPatternMatches(text, SPAM_PATTERNS) >= 1) return "spam";
  if (countPatternMatches(text, BAIT_PATTERNS) >= 1) return "bait";
  if (countPatternMatches(text, ACCUSATION_PATTERNS) >= 1) return "accusation";
  if (countPatternMatches(text, LAUNCH_PATTERNS) >= 1) return "launch_announcement";
  if (countPatternMatches(text, PERFORMANCE_PATTERNS) >= 1) return "performance_claim";
  if (countPatternMatches(text, HYPE_PATTERNS) >= 1) return "hype_claim";
  if (countPatternMatches(text, MARKET_NARRATIVE_PATTERNS) >= 1) return "market_narrative";
  if (countPatternMatches(text, QUESTION_PATTERNS) >= 1) return "question";
  if (countPatternMatches(text, MEME_PATTERNS) >= 2) return "meme_only";

  return "irrelevant";
}

function classifyTarget(event: CanonicalEvent, intent: IntentClass): TargetClass {
  if (event.cashtags.length > 0) return "token";
  if (intent === "accusation") return "behavior";
  if (intent === "market_narrative") return "market_structure";
  if (intent === "performance_claim" || intent === "hype_claim") return "claim";
  if (intent === "launch_announcement") return "project";
  if (intent === "question") return "claim";
  return "none";
}

function classifyEvidence(event: CanonicalEvent, intent: IntentClass): EvidenceClass {
  const text = event.text;
  const hasParent = !!event.parent_text;
  const hasContext = event.conversation_context.length > 0;

  const productProof = countPatternMatches(text, PRODUCT_PROOF_PATTERNS);
  const parentProof = event.parent_text
    ? countPatternMatches(event.parent_text, PRODUCT_PROOF_PATTERNS)
    : 0;

  if (productProof >= 2 || (productProof >= 1 && parentProof >= 1)) {
    return "self_contained_strong";
  }
  if (hasParent || hasContext || productProof >= 1) {
    return "contextual_medium";
  }
  if (intent === "hype_claim" || intent === "performance_claim") {
    return "weak_speculative";
  }
  return "absent";
}

function estimateBaitProbability(event: CanonicalEvent): number {
  const text = event.text;
  const aggression = detectAggression({ text });
  let prob = 0;

  prob += countPatternMatches(text, BAIT_PATTERNS) * 0.3;
  if (aggression.isAggressive) prob += 0.25;
  if (aggression.score > 40) prob += 0.1;

  return Math.min(prob, 1);
}

function estimateSpamProbability(event: CanonicalEvent): number {
  const text = event.text;
  let prob = 0;

  prob += countPatternMatches(text, SPAM_PATTERNS) * 0.35;
  if (event.urls.length > 2) prob += 0.2;
  if (text.length < 15 && event.cashtags.length === 0) prob += 0.15;

  return Math.min(prob, 1);
}

function extractEvidenceBullets(event: CanonicalEvent, intent: IntentClass): string[] {
  const bullets: string[] = [];
  const text = event.text;

  if (countPatternMatches(text, HYPE_PATTERNS) > 0) {
    bullets.push("contains strong hype language");
  }
  if (countPatternMatches(text, PERFORMANCE_PATTERNS) > 0) {
    bullets.push("includes unverified performance claims");
  }
  if (countPatternMatches(text, PRODUCT_PROOF_PATTERNS) === 0 && intent !== "question") {
    bullets.push("no concrete product proof in visible text");
  }
  if (countPatternMatches(text, VOLUME_BEHAVIOR_PATTERNS) > 0) {
    bullets.push("suspicious volume or behavior indicators");
  }
  if (countPatternMatches(text, ACCUSATION_PATTERNS) > 0) {
    bullets.push("contains accusatory language");
  }
  if (event.cashtags.length > 0) {
    bullets.push(`references cashtag(s): ${event.cashtags.join(", ")}`);
  }

  return bullets.slice(0, 4);
}

function extractRiskFlags(event: CanonicalEvent, intent: IntentClass): string[] {
  const flags: string[] = [];
  const text = event.text;
  const aggression = detectAggression({ text });

  if (aggression.isAggressive) flags.push("aggressive_input");
  if (intent === "bait") flags.push("bait_detected");
  if (intent === "spam") flags.push("spam_detected");
  if (event.urls.length > 0) flags.push("contains_urls");
  if (countPatternMatches(text, VOLUME_BEHAVIOR_PATTERNS) > 0) {
    flags.push("suspicious_behavior_signals");
  }

  return flags;
}

function isPolicyBlocked(intent: IntentClass, spamProb: number): boolean {
  if (intent === "spam") return true;
  if (intent === "irrelevant") return true;
  return false;
}

export function classify(event: CanonicalEvent): ClassifierOutput {
  const intent = classifyIntent(event);
  const target = classifyTarget(event, intent);
  const evidence_class = classifyEvidence(event, intent);
  const bait_probability = estimateBaitProbability(event);
  const spam_probability = estimateSpamProbability(event);
  const evidence_bullets = extractEvidenceBullets(event, intent);
  const risk_flags = extractRiskFlags(event, intent);
  const policy_blocked = isPolicyBlocked(intent, spam_probability);

  return {
    intent,
    target,
    evidence_class,
    bait_probability,
    spam_probability,
    policy_blocked,
    evidence_bullets,
    risk_flags,
  };
}
