import type { TweetRef } from "./types.js";

export interface ExtractedKeywords {
  entities: string[];
  keywords: string[];
}

function normalizeToken(s: string): string {
  return s
    .trim()
    .replace(/^[@#]/, "")
    .replace(/[^\p{L}\p{N}_$]/gu, "")
    .toLowerCase();
}

export function extractKeywords(chain: TweetRef[]): ExtractedKeywords {
  const text = chain.map((t) => t.text ?? "").join("\n");

  const handles = (text.match(/@\w+/g) ?? []).map(normalizeToken).filter(Boolean);
  const hashtags = (text.match(/#\w+/g) ?? []).map(normalizeToken).filter(Boolean);
  const tickers = (text.match(/\$\w+/g) ?? []).map(normalizeToken).filter(Boolean);

  const words =
    (text.match(/[\p{L}\p{N}_]{3,}/gu) ?? [])
      .map(normalizeToken)
      .filter((w) => w.length >= 3);

  const entities = uniq([...tickers, ...hashtags, ...handles]).slice(0, 20);
  const keywords = uniq([...entities, ...words]).slice(0, 40);

  return { entities, keywords };
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}
