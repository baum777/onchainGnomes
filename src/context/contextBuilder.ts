/**
 * Context Builder — Build ThreadContext by walking reply chain
 *
 * Fetches mention tweet and walks parent chain up to max_thread_depth.
 * Extracts keywords, infers intent/tone, generates summary and claims.
 */

import type { XReadClient } from "../clients/xReadClient.js";
import type {
  MentionInput,
  ThreadContext,
  TweetRef,
  ReplyControls,
} from "./types.js";
import { extractKeywords } from "./keywordExtractor.js";

export interface ContextBuilderDeps {
  xread: XReadClient;
}

export async function buildThreadContext(
  deps: ContextBuilderDeps,
  mention: MentionInput,
  controls: ReplyControls
): Promise<ThreadContext> {
  const chain: TweetRef[] = [];

  const t0 = await deps.xread.getTweet(mention.tweet_id);
  const parsed0 = mapTweet(t0);
  if (parsed0) chain.push(parsed0);

  let cursor: TweetRef | undefined = parsed0 ?? undefined;
  for (let i = 0; i < controls.max_thread_depth; i++) {
    const parentId = cursor?.referenced_tweets?.find((r) => r.type === "replied_to")?.id;
    if (!parentId) break;

    const parent = await deps.xread.getTweet(parentId);
    const parsed = mapTweet(parent);
    if (!parsed) break;

    chain.unshift(parsed);
    cursor = parsed;
  }

  const combinedText = chain.map((t) => t.text ?? "").join("\n");
  const intent = inferIntent(combinedText);
  const tone = inferTone(combinedText);

  const { entities, keywords } = extractKeywords(chain);

  const claims = extractClaimsHeuristic(combinedText);
  const summary = summarizeHeuristic(chain);

  const constraints = [
    "No identity-based insults.",
    "No doxxing / PII.",
    "No explicit instructions for wrongdoing.",
    "Keep reply <= 280 chars.",
  ];

  return {
    root_tweet_id: chain[0]?.id ?? null,
    chain,
    summary,
    intent,
    tone,
    entities,
    keywords,
    claims,
    constraints,
  };
}

function mapTweet(apiResp: unknown): TweetRef | null {
  const data = (apiResp as { data?: unknown })?.data as Record<string, unknown> | undefined;
  if (!data?.id) return null;

  const includes = (apiResp as { includes?: { users?: Array<{ id?: string; username?: string }> } })
    ?.includes;
  const includesUsers = includes?.users ?? [];
  const author = includesUsers.find((u) => u.id === data.author_id);

  return {
    id: String(data.id),
    text: data.text as string | undefined,
    author_id: data.author_id as string | undefined,
    author_username: author?.username,
    created_at: data.created_at as string | undefined,
    conversation_id: data.conversation_id as string | undefined,
    referenced_tweets: data.referenced_tweets as TweetRef["referenced_tweets"],
  };
}

function inferIntent(text: string): ThreadContext["intent"] {
  if (/\?$/.test(text.trim()) || /\bhow|why|what|wen\b/i.test(text)) return "question";
  if (/\bplease|can you|could you\b/i.test(text)) return "request";
  if (/\blol|lmao|haha\b/i.test(text)) return "joke";
  if (/\bscam|rug|fraud\b/i.test(text)) return "complaint";
  if (/\bf\*|idiot|moron\b/i.test(text)) return "attack";
  return "unknown";
}

function inferTone(text: string): ThreadContext["tone"] {
  if (/\bf\*|idiot|moron\b/i.test(text)) return "aggressive";
  if (/\bplease|thanks\b/i.test(text)) return "friendly";
  if (/\bsure buddy|cope\b/i.test(text)) return "sarcastic";
  return "neutral";
}

function summarizeHeuristic(chain: TweetRef[]): string {
  const last = chain[chain.length - 1]?.text ?? "";
  const prev = chain[chain.length - 2]?.text ?? "";
  const s = [prev, last].filter(Boolean).join(" / ");
  return s.slice(0, 240);
}

function extractClaimsHeuristic(text: string): string[] {
  const sentences = text.split(/[.!?\n]/).map((s) => s.trim()).filter(Boolean);
  return sentences.filter((s) => /\b(is|are|was|will|means)\b/i.test(s)).slice(0, 5);
}
