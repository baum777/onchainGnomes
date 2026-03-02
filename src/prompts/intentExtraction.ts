/**
 * Intent Extraction Service
 *
 * Phase-1: No NLP lib required. Just robust "Topic + keywords" extraction.
 * Cleans mentions, removes URLs/handles, extracts meaningful tokens.
 */

export type ExtractedIntent = {
  intent: string; // short summary
  keywords: string[];
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "at", "by",
  "ich", "du", "und", "oder", "aber", "zu", "von", "in", "im", "am", "auf", "für", "mit",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
  "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can",
  "need", "dare", "ought", "used", "rt", "http", "https", "co", "t", "s", "m", "re",
]);

export function extractIntent(text: string): ExtractedIntent {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, "") // Remove URLs
    .replace(/@\w+/g, "") // Remove mentions
    .replace(/#\w+/g, "") // Remove hashtags
    .replace(/\/\w+/g, "") // Remove commands like /ask, /img
    .replace(/[^\p{L}\p{N}\s\-_/]/gu, " ") // Remove special chars, keep Unicode letters
    .trim();

  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));

  const keywords = Array.from(new Set(tokens)).slice(0, 8);
  const intent = cleaned.length > 0 ? cleaned.slice(0, 120) : "crypto meme reaction";

  return { intent, keywords };
}
