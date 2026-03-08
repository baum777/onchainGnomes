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
import { logError } from "../ops/logger.js";
import { shutdownAuditLog } from "../canonical/auditLog.js";
import { 
  recordEventSeen, 
  recordEventProcessed, 
  publishWithRetry,
  isPublished 
} from "../state/eventState.js";
import { 
  robustFetch, 
  AdaptivePollingController,
  isRateLimitError,
  getRetryAfterMs 
} from "../utils/robustFetch.js";
import { CursorManager } from "../utils/cursorPersistence.js";
import { extractMentionsFromResponse } from "../utils/inputNormalizer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(process.cwd(), "data/processed_mentions.json");

import { isPostingDisabled, shouldPost } from "../ops/launchGate.js";
import { withCircuitBreaker } from "../ops/llmCircuitBreaker.js";
import { logInfo, logWarn } from "../ops/logger.js";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000;
const DRY_RUN = process.env.DRY_RUN === "true";
const ADAPTIVE_POLLING_ENABLED = process.env.ADAPTIVE_POLLING_ENABLED === "true";

const MENTIONS_SOURCE = (process.env.MENTIONS_SOURCE ?? "mentions").toLowerCase() as
  | "mentions"
  | "search";

const BOT_USERNAME = (process.env.BOT_USERNAME ?? "Gorky_on_sol").replace(/^@/, "");

interface ProcessedMentionsState {
  last_since_id: string | null;
  processed: string[];
}

// Track consecutive errors per mention for circuit breaker pattern
const mentionErrorCounts = new Map<string, number>();
const MAX_MENTION_ERRORS = 3;

// Global error handlers to prevent crashes
function setupGlobalErrorHandlers(): void {
  process.on("unhandledRejection", (reason, promise) => {
    logError("[FATAL] Unhandled rejection at promise", { reason, promise });
  });

  process.on("uncaughtException", (error) => {
    logError("[FATAL] Uncaught exception", { error: error.message, stack: error.stack });
    // Give time for logs to flush before exit
    setTimeout(() => process.exit(1), 1000);
  });
  
  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("[SHUTDOWN] SIGTERM received, flushing audit log...");
    await shutdownAuditLog();
    process.exit(0);
  });
  
  process.on("SIGINT", async () => {
    console.log("[SHUTDOWN] SIGINT received, flushing audit log...");
    await shutdownAuditLog();
    process.exit(0);
  });
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
  // Check if already processed
  if (isProcessed(state, mention.id)) {
    console.log(`[SKIP] Already processed: ${mention.id}`);
    return undefined;
  }

  // Check error count - skip if too many consecutive failures
  const errorCount = mentionErrorCounts.get(mention.id) ?? 0;
  if (errorCount >= MAX_MENTION_ERRORS) {
    console.warn(`[SKIP] Mention ${mention.id} exceeded max error count (${MAX_MENTION_ERRORS}), marking as processed`);
    markProcessed(state, mention.id);
    saveState(state);
    mentionErrorCounts.delete(mention.id);
    return undefined;
  }

  // Check idempotency - already published?
  const publishCheck = isPublished(mention.id);
  if (publishCheck.published) {
    console.log(`[SKIP] Already published reply for ${mention.id}: tweet ${publishCheck.tweetId}`);
    markProcessed(state, mention.id);
    saveState(state);
    return undefined;
  }

  // Record event seen
  recordEventSeen(mention.id);

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
      mentionErrorCounts.delete(mention.id);
      return result;
    }

    // Record that pipeline processing succeeded
    recordEventProcessed(mention.id);

    const postDecision = shouldPost(mention.authorUsername ?? undefined);
    if (postDecision.action !== "post") {
      console.log(`[LAUNCH_GATE] ${mention.id}: ${postDecision.action} — ${(postDecision as { reason: string }).reason}`);
      markProcessed(state, mention.id);
      saveState(state);
      mentionErrorCounts.delete(mention.id);
      return result;
    }

    if (dryRun) {
      console.log(`[DRY_RUN] Would reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..."`);
    } else {
      // Use retry logic for publishing
      const publishResult = await publishWithRetry(mention.id, async () => {
        const reply = await xClient.reply(result.reply_text, mention.id);
        return { tweetId: reply.id ?? mention.id };
      });

      if (publishResult.success) {
        console.log(`[POSTED] Reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..." (tweet: ${publishResult.tweetId})`);
      } else {
        console.error(`[ERROR] Failed to publish reply to ${mention.id} after retries: ${publishResult.error}`);
        throw new Error(`Publish failed: ${publishResult.error}`);
      }
    }

    markProcessed(state, mention.id);
    saveState(state);
    mentionErrorCounts.delete(mention.id);
    console.log(`[SAVED] Marked ${mention.id} as processed`);
    return result;
  } catch (error) {
    // Increment error count for this mention
    const currentErrors = mentionErrorCounts.get(mention.id) ?? 0;
    mentionErrorCounts.set(mention.id, currentErrors + 1);
    
    logError(`[ERROR] Processing mention ${mention.id}:`, { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      mentionId: mention.id,
      errorCount: currentErrors + 1
    });
    
    // Re-throw to let caller decide (loop continues in runWorkerLoop)
    throw error;
  }
}

/** Main worker loop. Exported for index.ts entrypoint. */
export async function runWorkerLoop(): Promise<void> {
  // Setup global error handlers first
  setupGlobalErrorHandlers();
  
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
          // Error already logged in processCanonicalMention
          // Continue to next mention - the error count is tracked
          console.warn(`[CONTINUE] Moving to next mention after error in ${mention.id}`);
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
      logError("[ERROR] Poll iteration failed:", { error: e?.data ?? err, consecutiveFailures });

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
