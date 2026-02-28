/**
 * Context Builder — Full-spectrum context for serGorky replies
 *
 * Builds reply context from:
 * - mention tweet text
 * - parent tweet (if reply)
 * - conversation thread (best-effort last N tweets)
 * - user profile (best-effort)
 * - recent command history from DB
 *
 * Summary is compact (<=1200 chars) and safe for prompt input.
 * Never includes internal tokens (score, xp, threshold, trace_id).
 */

import type { TwitterApi } from "twitter-api-v2";

export type BuiltContext = {
  mentionText: string;
  author: {
    id: string;
    username?: string;
    name?: string;
    description?: string;
    verified?: boolean;
    created_at?: string;
    public_metrics?: Record<string, unknown>;
  };
  parentTweet?: { id: string; text: string };
  thread?: Array<{ id: string; text: string; author_id?: string }>;
  recentUserBotHistory?: Array<{ cmd: string; args: unknown; created_at: string }>;
  summary: string;
  raw: Record<string, unknown>;
};

export type MentionEventLike = {
  tweet_id: string;
  user_id: string;
  user_handle?: string;
  text: string;
  created_at?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
};

export type StateRepoLike = {
  getRecentCommands?(userId: string): Promise<
    Array<{ cmd: string; args: unknown; created_at: string }>
  >;
};

export type BuildContextOptions = {
  /** Max tweets to fetch in conversation thread (default 5) */
  threadLimit?: number;
  /** Max recent commands from history (default 5) */
  historyLimit?: number;
};

const SUMMARY_MAX_CHARS = 1200;

// Tokens that must NEVER appear in summary (internal leakage)
const FORBIDDEN_SUMMARY_TOKENS = [
  "score",
  "xp",
  "threshold",
  "trace_id",
  "cooldown",
  "flag",
  "telemetry",
];

function sanitizeForSummary(text: string): string {
  let out = text;
  for (const tok of FORBIDDEN_SUMMARY_TOKENS) {
    if (out.toLowerCase().includes(tok)) {
      out = out.replace(new RegExp(tok, "gi"), "[redacted]");
    }
  }
  return out;
}

/**
 * Build full-spectrum context from a mention event.
 * All fetches are best-effort; failures are graceful (no crash).
 */
export async function buildContext(
  event: MentionEventLike,
  twitterClient: TwitterApi,
  stateRepo?: StateRepoLike | null,
  options?: BuildContextOptions | null
): Promise<BuiltContext> {
  const threadLimit = options?.threadLimit ?? 5;
  const historyLimit = options?.historyLimit ?? 5;
  const raw: Record<string, unknown> = { event_id: event.tweet_id };
  const author: BuiltContext["author"] = {
    id: event.user_id,
    username: event.user_handle,
    name: undefined,
    description: undefined,
    verified: undefined,
    created_at: undefined,
    public_metrics: undefined,
  };

  // 1) Fetch author info (best-effort)
  try {
    const userRes = await twitterClient.v2.user(event.user_id, {
      "user.fields": "description,name,username,verified,created_at,public_metrics",
    });
    if (userRes.data) {
      author.username = userRes.data.username;
      author.name = userRes.data.name;
      author.description = userRes.data.description;
      author.verified = userRes.data.verified;
      author.created_at = userRes.data.created_at;
      author.public_metrics = userRes.data.public_metrics as Record<string, unknown>;
    }
  } catch {
    // Continue with what we have
  }

  // 2) Parent tweet (if reply)
  let parentTweet: BuiltContext["parentTweet"] = undefined;
  const replyRef = event.referenced_tweets?.find((r) => r.type === "replied_to");
  if (replyRef) {
    try {
      const tweetRes = await twitterClient.v2.singleTweet(replyRef.id, {
        "tweet.fields": "text,author_id",
      });
      if (tweetRes.data) {
        parentTweet = {
          id: tweetRes.data.id,
          text: tweetRes.data.text ?? "",
        };
      }
    } catch {
      // Continue
    }
  }

  // 3) Conversation thread (best-effort, last N tweets)
  // Search requires elevated access; skip gracefully if unavailable
  const thread: BuiltContext["thread"] = [];
  const conversationId = event.conversation_id ?? event.tweet_id;
  try {
    const searchPaginator = await twitterClient.v2.search(
      `conversation_id:${conversationId}`,
      {
        "tweet.fields": "text,author_id",
        max_results: Math.min(threadLimit, 100),
        sort_order: "recency",
      }
    );
    const tweets = searchPaginator.tweets ?? [];
    for (const t of tweets.slice(0, threadLimit)) {
      thread.push({
        id: t.id,
        text: t.text ?? "",
        author_id: t.author_id,
      });
    }
  } catch {
    // Search may not be available on Basic tier; skip gracefully
  }

  // 4) Recent command history from DB
  let recentUserBotHistory: BuiltContext["recentUserBotHistory"] = undefined;
  if (stateRepo?.getRecentCommands) {
    try {
      const cmds = await stateRepo.getRecentCommands(event.user_id);
      recentUserBotHistory = cmds.slice(0, historyLimit);
    } catch {
      // Continue
    }
  }

  // 5) Build compact summary (<=1200 chars)
  const parts: string[] = [];
  parts.push(`User asked: ${sanitizeForSummary(event.text)}`);
  if (parentTweet) {
    parts.push(`Replying to: ${sanitizeForSummary(parentTweet.text.slice(0, 200))}`);
  }
  if (thread.length > 0) {
    const snippets = thread
      .slice(0, 3)
      .map((t) => t.text.slice(0, 80))
      .join(" | ");
    parts.push(`Thread: ${sanitizeForSummary(snippets)}`);
  }
  if (author.description && author.description.length > 0) {
    parts.push(`User vibe: ${sanitizeForSummary(author.description.slice(0, 100))}`);
  }

  let summary = parts.join("\n");
  if (summary.length > SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, SUMMARY_MAX_CHARS - 3) + "...";
  }

  return {
    mentionText: event.text,
    author,
    parentTweet,
    thread: thread.length > 0 ? thread : undefined,
    recentUserBotHistory,
    summary,
    raw: {
      ...raw,
      trace_id: `ctx_${event.tweet_id}`,
    },
  };
}
