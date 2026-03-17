/**
 * gorky_on_sol Mention Poller
 *
 * Fetches mentions, processes via canonical pipeline.
 * Uses StateStore as single source of truth for cursor, processed mentions, and publish state.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TwitterApi } from "twitter-api-v2";
import { createXClient } from "../clients/xClient.js";
import { checkXConfigHealth } from "../clients/xClientConfig.js";
import { createUnifiedLLMClient } from "../clients/llmClient.unified.js";
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
import { shutdownAuditLog, getAuditBufferSize } from "../canonical/auditLog.js";
import {
  incrementCounter,
  setGauge,
  metrics as observabilityMetrics,
} from "../observability/metrics.js";
import { COUNTER_NAMES, GAUGE_NAMES, HISTOGRAM_NAMES } from "../observability/metricTypes.js";
import { recordPollSuccess, setHealthDeps } from "../observability/health.js";
import {
  recordEventSeen,
  recordEventProcessed,
  recordMentionSkipped,
  publishWithRetry,
  isPublished,
  isProcessed,
} from "../state/eventStateStore.js";
import { getStateStore } from "../state/storeFactory.js";
import type { CursorState } from "../state/stateStore.js";
import { migrateLegacyState } from "./migrateLegacyState.js";

import { DATA_DIR } from "../config/dataDir.js";
import { isPostingDisabled, shouldPost } from "../ops/launchGate.js";
import { withCircuitBreaker } from "../ops/llmCircuitBreaker.js";
import {
  tryAcquirePollLock,
  extendPollLock,
  releasePollLock,
  getHolderId,
  POLL_LOCK_RETRY_MS,
} from "../ops/pollLock.js";
import { logInfo, logWarn } from "../ops/logger.js";
import { writeInteractionWriteback } from "../memory/writeback/interactionWriteback.js";
import {
  writeRoutingDecision,
  writeInteractionEvent,
  writeReplyOutcome,
} from "../memory/writeback/routingWriteback.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGACY_DATA_FILE = path.resolve(DATA_DIR, "processed_mentions.json");

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000;
const DRY_RUN = process.env.DRY_RUN === "true";
const ADAPTIVE_POLLING_ENABLED = process.env.ADAPTIVE_POLLING_ENABLED === "true";

const MENTIONS_SOURCE = (process.env.MENTIONS_SOURCE ?? "mentions").toLowerCase() as
  | "mentions"
  | "search";

const BOT_USERNAME = (process.env.BOT_USERNAME ?? "gorky_on_sol").replace(/^@/, "");

// Track consecutive errors per mention for circuit breaker pattern (in-memory, acceptable per plan)
const mentionErrorCounts = new Map<string, number>();
const MAX_MENTION_ERRORS = 3;

// Global error handlers to prevent crashes
function setupGlobalErrorHandlers(): void {
  process.on("unhandledRejection", (reason, promise) => {
    logError("[FATAL] Unhandled rejection at promise", { reason, promise });
  });

  process.on("uncaughtException", (error) => {
    logError("[FATAL] Uncaught exception", { error: error.message, stack: error.stack });
    setTimeout(() => process.exit(1), 1000);
  });

  process.on("SIGTERM", async () => {
    console.log("[SHUTDOWN] SIGTERM received, flushing audit log...");
    await releasePollLock(getHolderId());
    await shutdownAuditLog();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[SHUTDOWN] SIGINT received, flushing audit log...");
    await releasePollLock(getHolderId());
    await shutdownAuditLog();
    process.exit(0);
  });
}

/** One-time migration: migrate legacy processed_mentions.json to StateStore (event_state + cursor) */
async function migrateLegacyStateIfExists(): Promise<void> {
  try {
    const result = await migrateLegacyState(LEGACY_DATA_FILE, getStateStore());
    if (result.migratedCount > 0 || result.cursorSet) {
      logInfo("[MIGRATION] Migrated legacy state", { ...result });
    }
  } catch (error) {
    logWarn("[MIGRATION] Failed to migrate legacy state, continuing fresh", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserId(client: TwitterApi): Promise<string> {
  const user = await client.v2.me();
  return user.data.id;
}

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

  const cashtags = (mention.text.match(/\$[A-Z]{2,10}/gi) ?? []).map((t) => t.toUpperCase());
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
  dryRun: boolean,
  configOverride?: typeof DEFAULT_CANONICAL_CONFIG,
): Promise<PipelineResult | undefined> {
  if (await isProcessed(mention.id)) {
    incrementCounter(COUNTER_NAMES.MENTIONS_SKIPPED_TOTAL);
    console.log(`[SKIP] Already processed: ${mention.id}`);
    return undefined;
  }

  const errorCount = mentionErrorCounts.get(mention.id) ?? 0;
  if (errorCount >= MAX_MENTION_ERRORS) {
    incrementCounter(COUNTER_NAMES.MENTIONS_SKIPPED_TOTAL);
    console.warn(
      `[SKIP] Mention ${mention.id} exceeded max error count (${MAX_MENTION_ERRORS}), marking as processed`
    );
    await recordMentionSkipped(mention.id);
    mentionErrorCounts.delete(mention.id);
    return undefined;
  }

  const publishCheck = await isPublished(mention.id);
  if (publishCheck.published) {
    incrementCounter(COUNTER_NAMES.MENTIONS_SKIPPED_TOTAL);
    console.log(`[SKIP] Already published reply for ${mention.id}: tweet ${publishCheck.tweetId}`);
    await recordMentionSkipped(mention.id);
    return undefined;
  }

  incrementCounter(COUNTER_NAMES.MENTIONS_SEEN_TOTAL);
  await recordEventSeen(mention.id);

  const preview = (mention.text ?? "").slice(0, 50);
  console.log(`[NEW] Mention ${mention.id} from @${mention.authorUsername ?? "unknown"}: "${preview}..."`);

  const event = mentionToCanonicalEvent(mention);
  const config = configOverride ?? DEFAULT_CANONICAL_CONFIG;

  try {
    const result = await handleEvent(event, deps, config);

    if (result.action === "skip") {
      incrementCounter(COUNTER_NAMES.MENTIONS_SKIPPED_TOTAL);
      console.log(`[SKIP] ${mention.id}: ${result.skip_reason}`);
      await recordMentionSkipped(mention.id);
      mentionErrorCounts.delete(mention.id);
      return result;
    }

    await recordEventProcessed(mention.id);

    const postDecision = shouldPost(mention.authorUsername ?? undefined);
    if (postDecision.action !== "post") {
      incrementCounter(COUNTER_NAMES.MENTIONS_BLOCKED_TOTAL);
      console.log(
        `[LAUNCH_GATE] ${mention.id}: ${postDecision.action} — ${(postDecision as { reason: string }).reason}`
      );
      await recordMentionSkipped(mention.id);
      mentionErrorCounts.delete(mention.id);
      return result;
    }

    let published = false;
    if (dryRun) {
      console.log(`[DRY_RUN] Would reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..."`);
    } else {
      incrementCounter(COUNTER_NAMES.PUBLISH_ATTEMPT_TOTAL);
      const publishStartMs = Date.now();
      const publishResult = await publishWithRetry(mention.id, async () => {
        const reply = await xClient.reply(result.reply_text, mention.id);
        return { tweetId: reply.id ?? mention.id };
      });
      observabilityMetrics.observeHistogram(HISTOGRAM_NAMES.PUBLISH_DURATION_MS, Date.now() - publishStartMs);

      if (publishResult.success) {
        incrementCounter(COUNTER_NAMES.PUBLISH_SUCCESS_TOTAL);
        published = true;
        console.log(
          `[POSTED] Reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..." (tweet: ${publishResult.tweetId})`
        );
      } else {
        incrementCounter(COUNTER_NAMES.PUBLISH_FAILURE_TOTAL);
        console.error(
          `[ERROR] Failed to publish reply to ${mention.id} after retries: ${publishResult.error}`
        );
        throw new Error(`Publish failed: ${publishResult.error}`);
      }
    }

    incrementCounter(COUNTER_NAMES.MENTIONS_PROCESSED_TOTAL);
    mentionErrorCounts.delete(mention.id);
    console.log(`[SAVED] Marked ${mention.id} as processed (publishWithRetry already persisted state)`);

    writeInteractionWriteback({
      event_id: mention.id,
      user_id: event.author_id,
      user_handle: mention.authorUsername ?? event.author_handle,
      selected_gnome_id: result.selectedGnomeId ?? "gorky",
      response_mode: result.audit?.response_mode ?? "single_tweet",
      intent: result.intent ?? (result.audit?.classifier_output as { intent?: string } | undefined)?.intent ?? "unknown",
      reply_text: result.reply_text,
      safety_passed: true,
      published,
    }).catch(() => {});

    // Phase-2: Routing writeback when gnomeSelection available
    if (result.gnomeSelection) {
      writeRoutingDecision({
        event_id: mention.id,
        user_id: event.author_id,
        user_handle: mention.authorUsername ?? event.author_handle,
        selected_gnome_id: result.gnomeSelection.selectedGnomeId,
        alternative_candidates: result.gnomeSelection.alternativeCandidates.map((c) => ({
          gnomeId: c.gnomeId,
          score: c.score,
        })),
        response_mode: result.gnomeSelection.responseMode,
        reasoning: result.gnomeSelection.reasoning,
      });
      writeInteractionEvent({
        event_id: mention.id,
        user_id: event.author_id,
        user_handle: mention.authorUsername ?? event.author_handle,
        gnome_id: result.gnomeSelection.selectedGnomeId,
        intent: result.intent ?? (result.audit?.classifier_output as { intent?: string } | undefined)?.intent,
      });
      writeReplyOutcome({
        event_id: mention.id,
        reply_text: result.reply_text,
        safety_passed: true,
        published,
      });
    }

    return result;
  } catch (error) {
    incrementCounter(COUNTER_NAMES.MENTIONS_FAILED_TOTAL);
    const currentErrors = mentionErrorCounts.get(mention.id) ?? 0;
    mentionErrorCounts.set(mention.id, currentErrors + 1);

    logError(`[ERROR] Processing mention ${mention.id}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      mentionId: mention.id,
      errorCount: currentErrors + 1,
    });

    throw error;
  }
}

/** Main worker loop. Exported for index.ts entrypoint. */
export async function runWorkerLoop(): Promise<void> {
  setupGlobalErrorHandlers();

  console.log("[START] gorky_on_sol Mention Poller (canonical pipeline)");
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

  const health = checkXConfigHealth();
  console.log(
    `[AUTH] Credential presence: ${JSON.stringify({ present: health.present, missing: health.missing })}`
  );
  if (health.warnings.length > 0) {
    console.warn(`[AUTH] Credential warnings: ${health.warnings.join("; ")}`);
  }
  if (!health.ready) {
    console.error(`[AUTH] Missing required credentials: ${health.missing.join(", ")}. Cannot start.`);
    process.exit(1);
  }

  const rawClient = new TwitterApi({
    appKey: (process.env.X_API_KEY || "").trim(),
    appSecret: (process.env.X_API_SECRET || "").trim(),
    accessToken: (process.env.X_ACCESS_TOKEN || "").trim(),
    accessSecret: (process.env.X_ACCESS_SECRET || "").trim(),
  });

  let userId: string;
  try {
    console.log("[AUTH] Verifying credentials via v2.me()...");
    userId = await getUserId(rawClient);
    console.log(`[AUTH] Verified. Authenticated as user: ${userId}`);
  } catch (err: unknown) {
    const e = err as { code?: number; data?: unknown };
    if (e?.code === 401) {
      console.error(
        "[AUTH] 401 Unauthorized from v2.me(). Your X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET are invalid or revoked."
      );
      console.error("[AUTH] Ensure you are using OAuth 1.0a Consumer Keys + Access Tokens (NOT OAuth 2.0 Client ID/Secret).");
    } else if (e?.code === 403) {
      console.error(
        "[AUTH] 403 Forbidden from v2.me(). App permissions may be insufficient (need Read+Write). Regenerate Access Token after changing permissions."
      );
    } else {
      console.error("[AUTH] Unexpected error during auth verification:", e?.data ?? err);
    }
    process.exit(1);
  }

  const llmClient = withCircuitBreaker(createUnifiedLLMClient());
  const pipelineDeps: PipelineDeps = {
    llm: llmClient,
    botUserId: userId,
  };

  const store = getStateStore();
  setHealthDeps({
    getAuditBufferSize,
    loadCursor: () => store.getCursor(),
  });
  setGauge(GAUGE_NAMES.CURRENT_POLL_INTERVAL_MS, POLL_INTERVAL_MS);
  incrementCounter(COUNTER_NAMES.RECOVERY_RESTART_TOTAL);

  await migrateLegacyStateIfExists();

  let lastSinceId: string | null = null;
  const cursor = await store.getCursor();
  if (cursor?.since_id) {
    lastSinceId = cursor.since_id;
    console.log(`[STATE] Loaded cursor from StateStore: ${lastSinceId}`);
  }

  const BACKOFF_BASE_MS = 5_000;
  const BACKOFF_MAX_MS = 300_000;
  let consecutiveFailures = 0;
  const myHolderId = getHolderId();
  let leaderId: string | null = null;

  while (true) {
    try {
      // Single-leader: acquire or extend poll lock (Redis only)
      if (leaderId) {
        const extended = await extendPollLock(leaderId);
        if (!extended) {
          logWarn("[POLL_LOCK] Lost leadership, re-acquiring...");
          leaderId = null;
        }
      }
      if (!leaderId) {
        const acquired = await tryAcquirePollLock(myHolderId);
        if (!acquired) {
          console.log("[POLL] Not leader, waiting...");
          await sleep(POLL_LOCK_RETRY_MS);
          continue;
        }
        leaderId = myHolderId;
      }

      console.log("\n[POLL] Fetching mentions...");

      const { mentions, maxId } = await fetchMentions(rawClient, userId, lastSinceId);

      consecutiveFailures = 0;
      setGauge(GAUGE_NAMES.RECENT_FAILURE_STREAK, 0);
      await recordPollSuccess();

      console.log(`[POLL] Found ${mentions.length} new mention(s)`);

      for (const mention of mentions) {
        const startMs = Date.now();
        try {
          await processCanonicalMention(pipelineDeps, xClient, mention, dryRun);
        } catch (error) {
          console.warn(`[CONTINUE] Moving to next mention after error in ${mention.id}`);
        } finally {
          observabilityMetrics.observeHistogram(
            HISTOGRAM_NAMES.MENTION_PROCESSING_DURATION_MS,
            Date.now() - startMs
          );
        }
      }

      if (maxId && maxId !== lastSinceId) {
        lastSinceId = maxId;
        const newCursor: CursorState = {
          since_id: maxId,
          last_fetch_at: new Date().toISOString(),
          fetched_count: mentions.length,
          version: 1,
        };
        await store.setCursor(newCursor);
        console.log(`[STATE] Updated cursor: ${maxId}`);
      }
    } catch (err: unknown) {
      const e = err as { code?: number; status?: number; data?: unknown };
      consecutiveFailures++;
      setGauge(GAUGE_NAMES.RECENT_FAILURE_STREAK, consecutiveFailures);
      logError("[ERROR] Poll iteration failed:", { error: e?.data ?? err, consecutiveFailures });

      if (e?.code === 401 || e?.status === 401) {
        console.error("[AUTH] 401 Unauthorized while polling. Likely endpoint access/tier issue.");
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
