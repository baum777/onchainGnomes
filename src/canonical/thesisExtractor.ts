import type {
  CanonicalEvent,
  ClassifierOutput,
  ScoreBundle,
  ThesisBundle,
  ThesisType,
} from "./types.js";

const HYPE_NO_SUBSTANCE = /\b(?:moon|mooning|100x|1000x|gem|alpha|lfg|wagmi|guaranteed|easy\s+money)\b/i;
const PERFORMANCE_LANGUAGE = /\b(?:\d+[%xX]\s*(?:gain|profit|return|up|pump)|ath|all.time.high|breaking\s+out)\b/i;
const PRODUCT_PROOF = /\b(?:audit|github|testnet|mainnet|tvl|dau|mau|revenue|users|smart\s+contract|verified|open.source)\b/i;
const NARRATIVE_LANGUAGE = /\b(?:narrative|cycle|rotation|thesis|play|meta|trend|momentum)\b/i;
const SUSPICIOUS_BEHAVIOR = /\b(?:wash\s+trading|bot\s+volume|fake\s+volume|same\s+wallet|suspicious|insider)\b/i;
const PROMISE_LANGUAGE = /\b(?:promise|roadmap|soon|coming|will\s+be|going\s+to|next\s+week|next\s+month|launching)\b/i;
const THEATER_LANGUAGE = /\b(?:professional|team|backed|partner|advisor|institutional|series\s+[a-c])\b/i;
const BAIT_LANGUAGE = /\b(?:bet\s+you|prove\s+me|come\s+at|ratio|you\s+won't|coward)\b/i;
const CORRECTION_LANGUAGE = /\b(?:actually|incorrect|wrong|false|misleading|not\s+true)\b/i;

function hasProductProof(text: string, parentText: string | null): boolean {
  if (PRODUCT_PROOF.test(text)) return true;
  if (parentText && PRODUCT_PROOF.test(parentText)) return true;
  return false;
}

function deriveThesisType(
  event: CanonicalEvent,
  cls: ClassifierOutput,
  scores: ScoreBundle,
): ThesisType | null {
  const text = event.text;
  const parentText = event.parent_text;
  const combined = parentText ? `${text} ${parentText}` : text;
  const proof = hasProductProof(text, parentText);

  if (BAIT_LANGUAGE.test(text) && cls.bait_probability > 0.4) {
    return "obvious_bait";
  }

  if (CORRECTION_LANGUAGE.test(text) && cls.intent === "question") {
    return "factual_correction_only";
  }

  if (SUSPICIOUS_BEHAVIOR.test(combined)) {
    return "suspicious_behavior_pattern";
  }

  if (PERFORMANCE_LANGUAGE.test(combined) && !proof) {
    return "claim_exceeds_evidence";
  }

  if (HYPE_NO_SUBSTANCE.test(combined) && !proof) {
    return "empty_hype_no_substance";
  }

  if (NARRATIVE_LANGUAGE.test(combined) && !proof) {
    return "narrative_stronger_than_product";
  }

  if (PROMISE_LANGUAGE.test(combined) && !proof) {
    return "overpromise_underdelivery";
  }

  if (THEATER_LANGUAGE.test(combined) && !proof && scores.severity >= 0.4) {
    return "theatrical_professionalism";
  }

  if (cls.evidence_class === "absent" || cls.evidence_class === "weak_speculative") {
    return "unclear_or_unverifiable";
  }

  if (cls.intent === "hype_claim" || cls.intent === "performance_claim") {
    return "claim_exceeds_evidence";
  }

  if (cls.intent === "accusation") {
    return "suspicious_behavior_pattern";
  }

  return null;
}

function deriveSupportingPoint(
  event: CanonicalEvent,
  cls: ClassifierOutput,
  thesis: ThesisType,
): string | null {
  if (thesis === "obvious_bait") return null;
  if (thesis === "factual_correction_only") return null;

  if (cls.evidence_bullets.length >= 2) {
    return cls.evidence_bullets[1];
  }

  if (event.parent_text && event.parent_text.length > 20) {
    return "parent context provides additional signal";
  }

  return null;
}

export function extractThesis(
  event: CanonicalEvent,
  cls: ClassifierOutput,
  scores: ScoreBundle,
): ThesisBundle | null {
  const primary = deriveThesisType(event, cls, scores);
  if (!primary) return null;

  const supporting_point = deriveSupportingPoint(event, cls, primary);
  const evidence_bullets = cls.evidence_bullets.slice(0, 2);

  return { primary, supporting_point, evidence_bullets };
}
