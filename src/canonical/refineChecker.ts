/**
 * Refine Checker — Decides if first LLM reply needs aggressive refine step.
 * Triggers when reply is too short or misses roast-relevant keywords from the claim.
 */

/** Roast-relevant keywords that should ideally appear in the reply when present in claim */
const ROAST_KEYWORDS = new Set([
  "nothing", "sloppy", "inorganic", "slippage", "concentrated", "wallet",
  "volume", "launch", "alpha", "rug", "diluted", "paper", "hands", "cope",
  "ngmi", "diluted", "vibes", "organic", "wash", "trading", "fake", "pump",
  "dump", "ath", "moon", "gem", "tvl", "liquidity", "tokenomics",
]);

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "its", "let", "may", "new", "now", "old", "see", "way", "who",
  "did", "too", "use", "that", "this", "with", "from", "have", "been",
]);

function normalizeWord(w: string): string {
  return w.replace(/[^\p{L}\p{N}_$]/gu, "").toLowerCase();
}

/**
 * Extracts roast-relevant keywords from claim text.
 * Returns: (1) keywords from ROAST_KEYWORDS that appear in text,
 *          (2) significant words (≥4 chars, no stopwords) from text.
 */
export function extractExpectedKeywords(text: string, evidenceBullets: string[] = []): string[] {
  const combined = [text, ...evidenceBullets].join(" ");
  const normalized = combined.toLowerCase();
  const result = new Set<string>();

  // Add roast keywords that appear in the claim
  for (const kw of ROAST_KEYWORDS) {
    if (normalized.includes(kw)) {
      result.add(kw);
    }
  }

  // Add significant words from text (≥4 chars, not stopword)
  const words = (combined.match(/[\p{L}\p{N}_]{4,}/gu) ?? [])
    .map((w) => normalizeWord(w))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  for (const w of words) {
    result.add(w);
  }

  return Array.from(result).slice(0, 15); // cap to avoid noise
}

/**
 * Count how many of the expected keywords appear in the reply.
 */
export function countKeywordsInReply(reply: string, keywords: string[]): number {
  const r = reply.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (r.includes(kw)) count++;
  }
  return count;
}

/**
 * Determines if the first reply should trigger the refine step.
 * @param reply - First LLM reply text
 * @param keywords - Expected keywords from extractExpectedKeywords
 * @param minLength - Minimum reply length (default 80)
 * @param minKeywordCount - Minimum keywords that should appear in reply (default 1)
 */
export function shouldRefine(
  reply: string,
  keywords: string[],
  minLength: number = 80,
  minKeywordCount: number = 1,
): boolean {
  const trimmed = reply.trim();

  // Too short → refine
  if (trimmed.length < minLength) {
    return true;
  }

  // No expected keywords → no refine needed (nothing to mirror)
  if (keywords.length === 0) {
    return false;
  }

  // Too few keywords in reply → refine
  const found = countKeywordsInReply(trimmed, keywords);
  if (found < minKeywordCount) {
    return true;
  }

  return false;
}
