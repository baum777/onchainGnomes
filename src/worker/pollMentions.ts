/**
 * serGorky Mention Poller
 *
 * Fetches mentions, processes via canonical pipeline.
 * Uses file-based storage for idempotency.
 * Runs in an infinite loop with configurable sleep.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TwitterApi } from "twitter-api-v2";
import { createXClient } from "../clients/xClient.js";
import { createXReadClient } from "../clients/xReadClient.js";
import { createXAILLMClient } from "../clients/llmClient.xai.js";
import {
  mapMentionsResponse,
  MENTIONS_FETCH_OPTIONS,
  type Mention,
} from "../poller/mentionsMapper.js";
import {
  readActivationConfigFromEnv,
  type ActivationConfig,
} from "../config/botActivationConfig.js";
import { handleEvent, type PipelineDeps } from "../canonical/pipeline.js";
import type { CanonicalConfig, CanonicalEvent, PipelineResult } from "../canonical/types.js";
import { DEFAULT_CANONICAL_CONFIG } from "../canonical/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(process.cwd(), "data/processed_mentions.json");

import { isPostingDisabled, shouldPost } from "../ops/launchGate.js";
import { withCircuitBreaker } from "../ops/llmCircuitBreaker.js";
import { logInfo, logWarn } from "../ops/logger.js";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000;
const DRY_RUN = process.env.DRY_RUN === "true";

const MENTIONS_SOURCE = (process.env.MENTIONS_SOURCE ?? "mentions").toLowerCase() as
  | "mentions"
  | "search";

const BOT_USERNAME = (process.env.BOT_USERNAME ?? "Gorky_on_sol").replace(/^@/, "");

interface ProcessedMentionsState {
  last_since_id: string | null;
  processed: string[];
}

// Load or create state
function loadState(): ProcessedMentionsState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw) as ProcessedMentionsState;
      return {
        last_since_id: parsed.last_since_id ?? null,
        processed: parsed.processed ?? [],
      };
    }
  } catch (error) {
    console.warn("[WARN] Failed to load state, creating fresh:", error);
  }
  return { last_since_id: null, processed: [] };
}

// Save state
function saveState(state: ProcessedMentionsState): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// Check if tweet already processed
function isProcessed(state: ProcessedMentionsState, tweetId: string): boolean {
  return state.processed.includes(tweetId);
}

// Mark tweet as processed
function markProcessed(state: ProcessedMentionsState, tweetId: string): void {
  if (!state.processed.includes(tweetId)) {
    state.processed.push(tweetId);
  }
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch authenticated user ID
async function getUserId(client: TwitterApi): Promise<string> {
  const user = await client.v2.me();
  return user.data.id;
}

/** Adapt timeline/search response to shape expected by mapMentionsResponse (data/includes/meta) */
function adaptForMentionsMapper(response: { tweets?: unknown[]; includes?: unknown; meta?: unknown }) {
  return {
    data: response.tweets ?? [],
    includes: response.includes,
    meta: response.meta,
  };
}

async function fetchMentionsViaMentionsEndpoint(
  client: TwitterApi,
  userId: string,
  sinceId: string | null
): Promise<{ mentions: Mention[]; maxId: string | null }> {
  const params: Record<string, unknown> = {
    max_results: MENTIONS_FETCH_OPTIONS.max_results,
    expansions: [...MENTIONS_FETCH_OPTIONS.expansions],
    "tweet.fields": [...MENTIONS_FETCH_OPTIONS["tweet.fields"]],
    "user.fields": [...MENTIONS_FETCH_OPTIONS["user.fields"]],
  };
  if (sinceId) params.since_id = sinceId;

  const response = await client.v2.userMentionTimeline(userId, params);
  const result = mapMentionsResponse(adaptForMentionsMapper(response));
  return { mentions: result.mentions, maxId: result.maxId };
}

async function fetchMentionsViaSearch(
  client: TwitterApi,
  username: string,
  sinceId: string | null
): Promise<{ mentions: Mention[]; maxId: string | null }> {
  const params: Record<string, unknown> = {
    max_results: MENTIONS_FETCH_OPTIONS.max_results,
    expansions: [...MENTIONS_FETCH_OPTIONS.expansions],
    "tweet.fields": [...MENTIONS_FETCH_OPTIONS["tweet.fields"]],
    "user.fields": [...MENTIONS_FETCH_OPTIONS["user.fields"]],
  };
  if (sinceId) params.since_id = sinceId;

  const query = `@${username}`;
  const response = await client.v2.search(query, params);
  const result = mapMentionsResponse(adaptForMentionsMapper(response));
  return { mentions: result.mentions, maxId: result.maxId };
}

async function fetchMentions(
  client: TwitterApi,
  userId: string,
  sinceId: string | null
): Promise<{ mentions: Mention[]; maxId: string | null }> {
  if (MENTIONS_SOURCE === "search") {
    return fetchMentionsViaSearch(client, BOT_USERNAME, sinceId);
  }

  try {
    return await fetchMentionsViaMentionsEndpoint(client, userId, sinceId);
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e?.code === 401) {
      console.error(
        `[WARN] Mentions endpoint returned 401; falling back to recent search for @${BOT_USERNAME}`
      );
      return fetchMentionsViaSearch(client, BOT_USERNAME, sinceId);
    }
    throw err;
  }
}

function mentionToCanonicalEvent(mention: Mention): CanonicalEvent {
  const authorHandle = mention.authorUsername
    ? `@${mention.authorUsername.toLowerCase()}`
    : mention.author_id;

  const cashtags = (mention.text.match(/\$[A-Z]{2,10}/gi) ?? []).map((t) =>
    t.toUpperCase(),
  );
  const hashtags = (mention.text.match(/#\w+/g) ?? []);
  const urls = (mention.text.match(/https?:\/\/\S+/gi) ?? []);

  return {
    event_id: mention.id,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: authorHandle,
    author_id: mention.author_id,
    text: mention.text,
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags,
    hashtags,
    urls,
    timestamp: mention.created_at ?? new Date().toISOString(),
  };
}

export async function processCanonicalMention(
  deps: PipelineDeps,
  xClient: ReturnType<typeof createXClient>,
  mention: Mention,
  state: ProcessedMentionsState,
  dryRun: boolean,
  configOverride?: typeof DEFAULT_CANONICAL_CONFIG,
): Promise<PipelineResult | undefined> {
  if (isProcessed(state, mention.id)) {
    console.log(`[SKIP] Already processed: ${mention.id}`);
    return undefined;
  }

  const preview = (mention.text ?? "").slice(0, 50);
  console.log(`[NEW] Mention ${mention.id} from @${mention.authorUsername ?? "unknown"}: "${preview}..."`);

  const event = mentionToCanonicalEvent(mention);
  const config = configOverride ?? DEFAULT_CANONICAL_CONFIG;

  try {
    const result = await handleEvent(event, deps, config);

    if (result.action === "skip") {
      console.log(`[SKIP] ${mention.id}: ${result.skip_reason}`);
      markProcessed(state, mention.id);
      saveState(state);
      return result;
    }

    const postDecision = shouldPost(mention.authorUsername ?? undefined);
    if (postDecision.action !== "post") {
      console.log(`[LAUNCH_GATE] ${mention.id}: ${postDecision.action} — ${(postDecision as { reason: string }).reason}`);
      markProcessed(state, mention.id);
      saveState(state);
      return result;
    }

    if (dryRun) {
      console.log(`[DRY_RUN] Would reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..."`);
    } else {
      await xClient.reply(result.reply_text, mention.id);
      console.log(`[POSTED] Reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..."`);
    }

    markProcessed(state, mention.id);
    saveState(state);
    console.log(`[SAVED] Marked ${mention.id} as processed`);
    return result;
  } catch (error) {
    console.error(`[ERROR] Processing mention ${mention.id}:`, error);
    throw error;
  }
}

/** Main worker loop. Exported for index.ts entrypoint. */
export async function runWorkerLoop(): Promise<void> {
  console.log("[START] Gorky_on_sol Mention Poller (canonical pipeline)");
  console.log(`[CONFIG] DRY_RUN=${DRY_RUN}`);
  console.log(`[CONFIG] POLL_INTERVAL=${POLL_INTERVAL_MS}ms`);
  console.log(`[CONFIG] Mentions source: ${MENTIONS_SOURCE}`);
  if (MENTIONS_SOURCE === "search") {
    console.log(`[CONFIG] BOT_USERNAME=@${BOT_USERNAME}`);
  }

  const activationConfig: ActivationConfig = readActivationConfigFromEnv();
  console.log(`[CONFIG] Activation mode: ${activationConfig.mode}`);

  const dryRun = process.env.LAUNCH_MODE ? isPostingDisabled() : DRY_RUN;
  const xClient = createXClient(dryRun);

  const rawClient = new TwitterApi({
    appKey: process.env.X_API_KEY || "",
    appSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  });

  const userId = await getUserId(rawClient);
  console.log(`[AUTH] Authenticated as user: ${userId}`);

  const llmClient = process.env.XAI_API_KEY
    ? withCircuitBreaker(createXAILLMClient())
    : undefined;

  if (!llmClient) {
    console.error("[FATAL] No XAI_API_KEY set — LLM client unavailable.");
    process.exit(1);
  }

  const pipelineDeps: PipelineDeps = {
    llm: llmClient,
    botUserId: userId,
  };

  const state = loadState();
  console.log(`[STATE] Loaded ${state.processed.length} processed mentions`);
  if (state.last_since_id) {
    console.log(`[STATE] last_since_id: ${state.last_since_id}`);
  }

  const BACKOFF_BASE_MS = 5_000;
  const BACKOFF_MAX_MS = 300_000;
  let consecutiveFailures = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log("\n[POLL] Fetching mentions...");

      const { mentions, maxId } = await fetchMentions(
        rawClient,
        userId,
        state.last_since_id
      );

      consecutiveFailures = 0;

      console.log(`[POLL] Found ${mentions.length} new mention(s)`);

      for (const mention of mentions) {
        try {
          await processCanonicalMention(pipelineDeps, xClient, mention, state, dryRun);
        } catch (error) {
          console.error(`[ERROR] Processing mention ${mention.id}:`, error);
        }
      }

      if (maxId && maxId !== state.last_since_id) {
        state.last_since_id = maxId;
        saveState(state);
        console.log(`[STATE] Updated last_since_id: ${maxId}`);
      }

      if (state.processed.length > 1000) {
        state.processed = state.processed.slice(-500);
        saveState(state);
        console.log("[STATE] Pruned processed list to 500 entries");
      }
    } catch (err: unknown) {
      const e = err as { code?: number; status?: number; data?: unknown };
      consecutiveFailures++;
      console.error("[ERROR] Poll iteration failed:", e?.data ?? err);

      if (e?.code === 401 || e?.status === 401) {
        console.error(
          "[AUTH] 401 Unauthorized while polling. Likely endpoint access/tier issue."
        );
        process.exit(1);
      }

      const backoffMs = Math.min(
        BACKOFF_BASE_MS * Math.pow(2, consecutiveFailures - 1),
        BACKOFF_MAX_MS
      );
      console.warn(`[BACKOFF] Consecutive failures: ${consecutiveFailures}, sleeping ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    console.log(`[SLEEP] ${POLL_INTERVAL_MS}ms...`);
    await sleep(POLL_INTERVAL_MS);
  }
}
