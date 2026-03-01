/**
 * Timeline Scout — Sample recent tweets by keywords for topical brief
 *
 * Uses extracted keywords to run targeted search queries.
 * Builds bullets, hot_phrases, counterpoints from corpus.
 */

import type { XReadClient } from "../clients/xReadClient.js";
import type { TimelineBrief } from "./types.js";
import { pickTopQueryKeywords } from "./ranker.js";

export interface TimelineScoutDeps {
  xread: XReadClient;
}

export interface TimelineScoutOptions {
  windowMinutes: number;
  maxQueries: number;
  maxTweetsPerQuery: number;
}

export async function buildTimelineBrief(
  deps: TimelineScoutDeps,
  keywords: string[],
  opts: TimelineScoutOptions
): Promise<TimelineBrief> {
  const queryKeywords = pickTopQueryKeywords(keywords, 6);
  const selected = queryKeywords.slice(0, Math.max(1, opts.maxQueries * 2));

  const queries: string[] = [];
  for (let i = 0; i < opts.maxQueries; i++) {
    const chunk = selected.slice(i * 2, i * 2 + 2).filter(Boolean);
    if (!chunk.length) break;
    queries.push(chunk.map((k) => (k.startsWith("$") ? k : `"${k}"`)).join(" OR "));
  }

  let sampled = 0;
  const corpus: string[] = [];

  for (const q of queries) {
    const query = `(${q}) -is:retweet lang:en`;
    const resp = (await deps.xread.searchRecent(query, {
      max_results: Math.min(100, opts.maxTweetsPerQuery),
      "tweet.fields": ["created_at", "author_id", "conversation_id"],
      expansions: ["author_id"],
      "user.fields": ["username"],
    })) as { data?: Array<{ text?: string }> };

    const tweets = resp?.data ?? [];
    sampled += tweets.length;
    for (const t of tweets) corpus.push(String(t.text ?? ""));
  }

  const bullets = summarizeCorpus(corpus, 5);
  const hotPhrases = extractHotPhrases(corpus, 5);
  const counterpoints = extractCounterpoints(corpus, 2);

  return {
    query_keywords: queryKeywords,
    window_minutes: opts.windowMinutes,
    bullets,
    hot_phrases: hotPhrases,
    counterpoints,
    sources_sampled: sampled,
  };
}

function summarizeCorpus(corpus: string[], max: number): string[] {
  const freq = new Map<string, number>();
  for (const t of corpus) {
    const line = t.replace(/\s+/g, " ").trim();
    if (line.length < 40) continue;
    freq.set(line, (freq.get(line) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([line]) => line.slice(0, 140));
}

function extractHotPhrases(corpus: string[], max: number): string[] {
  const joined = corpus.join("\n").toLowerCase();
  const candidates = [
    "liquidity",
    "unlock",
    "airdrop",
    "rug",
    "staking",
    "volume",
    "cto",
    "ct",
    "alpha",
    "fud",
  ];
  const scored = candidates
    .map((p) => ({ p, n: (joined.match(new RegExp(`\\b${p}\\b`, "g")) ?? []).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.p);
  return scored;
}

function extractCounterpoints(corpus: string[], max: number): string[] {
  const counters: string[] = [];
  for (const t of corpus) {
    if (/but|however|actually|counter/i.test(t)) counters.push(t);
    if (counters.length >= max) break;
  }
  return counters.map((t) => t.replace(/\s+/g, " ").trim().slice(0, 140));
}
