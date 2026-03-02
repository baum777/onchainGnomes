/**
 * Context Router — Migration mode dispatcher (legacy | v2 | hybrid)
 */

import type {
  ContextBundle,
  MentionInput,
  ReplyControls,
  ThreadContext,
} from "./types.js";
import { buildThreadContextV2 } from "./contextBuilderV2.js";
import { buildTimelineBriefV2 } from "./timelineScoutV2.js";
import type { XReadClient } from "../clients/xReadClient.js";
import type { TwitterApi } from "twitter-api-v2";
import { buildContext } from "../brand_matrix/contextBuilder.js";

export interface RouterDeps {
  mode: "legacy" | "v2" | "hybrid";
  xread: XReadClient;
  twitterClient?: TwitterApi | null;
  stateRepo?: { getRecentCommands?(userId: string): Promise<Array<{ cmd: string; args: unknown; created_at: string }>> } | null;
}

const emptyThreadContext = (summary: string): ThreadContext => ({
  root_tweet_id: null,
  chain: [],
  summary,
  intent: "unknown",
  tone: "neutral",
  entities: [],
  keywords: [],
  claims: [],
  constraints: [
    "Keep reply <= 280 chars.",
    "No identity insults.",
    "No doxxing.",
  ],
});

export async function buildContextBundle(
  deps: RouterDeps,
  mention: MentionInput,
  controls: ReplyControls
): Promise<ContextBundle> {
  const trace = {
    request_id: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    cache_hits: [] as string[],
    api_calls: [] as ContextBundle["trace"]["api_calls"],
    warnings: [] as string[],
  };

  if (deps.mode === "legacy" && deps.twitterClient) {
    const built = await buildContext(
      {
        tweet_id: mention.tweet_id,
        text: mention.text,
        user_id: mention.author_id,
        user_handle: mention.author_username ?? undefined,
        created_at: mention.created_at ?? undefined,
      },
      deps.twitterClient,
      deps.stateRepo ?? undefined,
      { threadLimit: controls.max_thread_depth }
    );
    const thread = emptyThreadContext(built.summary);
    return { mention, thread, controls, trace };
  }

  const thread = await buildThreadContextV2(
    { xread: deps.xread },
    mention,
    controls
  );

  let timeline = null;
  if (controls.enable_timeline_scout) {
    try {
      const seedText = `${mention.text}\n${thread.summary}\n${thread.claims.join("\n")}`;
      timeline = await buildTimelineBriefV2(
        { xread: deps.xread },
        thread.keywords,
        {
          windowMinutes: Number(process.env.CONTEXT_TIMELINE_WINDOW_MINUTES ?? 360),
          maxQueries: controls.max_timeline_queries,
          maxTweetsPerQuery: Number(
            process.env.CONTEXT_TIMELINE_TWEETS_PER_QUERY ?? 25
          ),
        },
        seedText
      );
    } catch {
      /* continue */
    }
  }

  if (
    deps.mode === "hybrid" &&
    !thread.summary &&
    deps.twitterClient
  ) {
    try {
      const built = await buildContext(
        {
          tweet_id: mention.tweet_id,
          text: mention.text,
          user_id: mention.author_id,
          user_handle: mention.author_username ?? undefined,
          created_at: mention.created_at ?? undefined,
        },
        deps.twitterClient,
        deps.stateRepo ?? undefined
      );
      thread.summary = built.summary || thread.summary;
    } catch {
      /* continue */
    }
  }

  return { mention, thread, timeline, controls, trace };
}
