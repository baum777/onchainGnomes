/**
 * Minimal Mention Poller
 *
 * Fetches mentions, generates replies, posts via XClient.
 * Uses file-based storage for idempotency.
 * Runs in an infinite loop with 30s sleep.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TwitterApi } from "twitter-api-v2";
import { createXClient, XClient } from "../src/clients/xClient.js";

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../data/processed_mentions.json");

// Config
const POLL_INTERVAL_MS = 30_000;
const DRY_RUN = process.env.DRY_RUN === "true";

interface ProcessedMentionsState {
  last_since_id: string | null;
  processed: string[];
}

interface Mention {
  id: string;
  text: string;
  author_id: string;
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

// Generate placeholder reply
function generateReply(_mention: Mention): string {
  return "gorky observed your message. chaos acknowledged.";
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

// Fetch mentions using since_id
async function fetchMentions(
  client: TwitterApi,
  userId: string,
  sinceId: string | null
): Promise<{ mentions: Mention[]; maxId: string | null }> {
  const params: { max_results: number; since_id?: string; "tweet.fields"?: string } = {
    max_results: 10,
    "tweet.fields": "author_id",
  };

  if (sinceId) {
    params.since_id = sinceId;
  }

  const timeline = await client.v2.userMentionTimeline(userId, params);
  const tweets = timeline.tweets || [];

  let maxId: string | null = sinceId;
  const mentions: Mention[] = tweets.map((t) => ({
    id: t.id,
    text: t.text,
    author_id: t.author_id || "",
  }));

  // Track the newest ID for next iteration
  for (const m of mentions) {
    if (!maxId || BigInt(m.id) > BigInt(maxId)) {
      maxId = m.id;
    }
  }

  return { mentions, maxId };
}

// Process single mention
async function processMention(
  xClient: XClient,
  mention: Mention,
  state: ProcessedMentionsState
): Promise<void> {
  if (isProcessed(state, mention.id)) {
    console.log(`[SKIP] Already processed: ${mention.id}`);
    return;
  }

  console.log(`[NEW] Mention ${mention.id}: "${mention.text.substring(0, 50)}..."`);

  const replyText = generateReply(mention);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would reply to ${mention.id}: "${replyText}"`);
  } else {
    try {
      const result = await xClient.reply(replyText, mention.id);
      console.log(`[POSTED] Reply ${result.id}: "${result.text}"`);
    } catch (error) {
      console.error(`[ERROR] Failed to reply to ${mention.id}:`, error);
      throw error; // Let caller handle
    }
  }

  markProcessed(state, mention.id);
  saveState(state);
  console.log(`[SAVED] Marked ${mention.id} as processed`);
}

// Main loop
async function main(): Promise<void> {
  console.log("[START] Mention Poller");
  console.log(`[CONFIG] DRY_RUN=${DRY_RUN}`);
  console.log(`[CONFIG] POLL_INTERVAL=${POLL_INTERVAL_MS}ms`);

  const xClient = createXClient(DRY_RUN);

  // Create raw TwitterApi client for mentions API
  const rawClient = new TwitterApi({
    appKey: process.env.X_API_KEY || "",
    appSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  });

  const userId = await getUserId(rawClient);
  console.log(`[AUTH] Authenticated as user: ${userId}`);

  const state = loadState();
  console.log(`[STATE] Loaded ${state.processed.length} processed mentions`);
  if (state.last_since_id) {
    console.log(`[STATE] last_since_id: ${state.last_since_id}`);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log("\n[POLL] Fetching mentions...");

      const { mentions, maxId } = await fetchMentions(
        rawClient,
        userId,
        state.last_since_id
      );

      console.log(`[POLL] Found ${mentions.length} new mention(s)`);

      for (const mention of mentions) {
        try {
          await processMention(xClient, mention, state);
        } catch (error) {
          console.error(`[ERROR] Processing mention ${mention.id}:`, error);
          // Continue to next mention
        }
      }

      // Update since_id if we have new mentions
      if (maxId && maxId !== state.last_since_id) {
        state.last_since_id = maxId;
        saveState(state);
        console.log(`[STATE] Updated last_since_id: ${maxId}`);
      }

      // Prune processed list if too large (keep last 1000)
      if (state.processed.length > 1000) {
        state.processed = state.processed.slice(-500);
        saveState(state);
        console.log("[STATE] Pruned processed list to 500 entries");
      }
    } catch (error) {
      console.error("[ERROR] Poll iteration failed:", error);
      // Continue loop - don't crash
    }

    console.log(`[SLEEP] ${POLL_INTERVAL_MS}ms...`);
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((e) => {
  console.error("[FATAL] Poller crashed:", e);
  process.exit(1);
});
