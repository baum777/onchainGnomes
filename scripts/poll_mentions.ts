/**
 * serGorky Mention Poller
 *
 * Fetches mentions, processes via MentionWorkflow (global activation).
 * Uses file-based storage for idempotency.
 * Runs in an infinite loop with 30s sleep.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TwitterApi } from "twitter-api-v2";
import { createXClient } from "../src/clients/xClient.js";
import {
  MentionWorkflow,
  type MentionEvent,
  type ProcessedEvent,
  type UserProfile,
  type WorkflowConfig,
} from "../src/workflows/mentionWorkflow.js";
import {
  RewardEngine,
  type RewardStateRepo,
  type RewardUserProfile,
} from "../src/reward_engine/index.js";

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
  const params: {
    max_results: number;
    since_id?: string;
    "tweet.fields"?: string;
  } = {
    max_results: 10,
    "tweet.fields": "author_id,conversation_id,created_at,referenced_tweets",
  };

  if (sinceId) {
    params.since_id = sinceId;
  }

  const timeline = await client.v2.userMentionTimeline(userId, params);
  const tweets = timeline.tweets || [];

  let maxId: string | null = sinceId;
  const mentions: Mention[] = tweets.map((t) => ({
    id: t.id,
    text: t.text ?? "",
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

// In-memory reward state (poll does not persist XP across restarts)
function createPollRewardRepo(): RewardStateRepo {
  const profiles = new Map<string, RewardUserProfile>();
  const processedEvents = new Set<string>();
  let globalImageCount = 0;

  return {
    async getUserProfile(userId: string) {
      return profiles.get(userId) ?? null;
    },
    async saveUserProfile(profile: RewardUserProfile) {
      profiles.set(profile.user_id, { ...profile });
    },
    async isEventProcessed(eventId: string) {
      return processedEvents.has(eventId);
    },
    async markEventProcessed(eventId: string) {
      processedEvents.add(eventId);
    },
    async getGlobalImageCount24h() {
      return globalImageCount;
    },
    async incrementGlobalImageCount() {
      globalImageCount++;
    },
  };
}

// Process single mention via MentionWorkflow
async function processMention(
  workflow: MentionWorkflow,
  mention: Mention,
  state: ProcessedMentionsState
): Promise<void> {
  if (isProcessed(state, mention.id)) {
    console.log(`[SKIP] Already processed: ${mention.id}`);
    return;
  }

  console.log(`[NEW] Mention ${mention.id}: "${mention.text.substring(0, 50)}..."`);

  const event: MentionEvent = {
    tweet_id: mention.id,
    user_id: mention.author_id,
    user_handle: mention.author_id, // API may not include username in minimal payload
    text: mention.text,
    created_at: new Date().toISOString(),
  };

  const profile: UserProfile = {
    user_id: mention.author_id,
    reward_pending: false,
    reply_count_24h: 0,
  };

  const processedEvents: ProcessedEvent[] = state.processed.map((id) => ({
    event_id: id,
    processed_at: new Date().toISOString(),
  }));

  try {
    const result = await workflow.process(event, profile, processedEvents);

    if (result.skip_reason) {
      console.log(`[SKIP] ${mention.id}: ${result.skip_reason}`);
      markProcessed(state, mention.id);
      saveState(state);
      return;
    }

    if (!result.success) {
      console.error(`[ERROR] ${mention.id}: ${result.error ?? "Unknown"}`);
      return;
    }

    if (DRY_RUN) {
      console.log(`[DRY_RUN] Would reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..."`);
    } else {
      console.log(`[POSTED] Reply to ${mention.id}: "${result.reply_text.substring(0, 80)}..."`);
    }

    markProcessed(state, mention.id);
    saveState(state);
    console.log(`[SAVED] Marked ${mention.id} as processed`);
  } catch (error) {
    console.error(`[ERROR] Processing mention ${mention.id}:`, error);
    throw error;
  }
}

// Main loop
async function main(): Promise<void> {
  console.log("[START] serGorky Mention Poller");
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

  const rewardRepo = createPollRewardRepo();
  const rewardEngine = new RewardEngine(rewardRepo, {
    cooldownHours: 24,
    globalImageCap24h: 100,
  });

  const workflowConfig: WorkflowConfig = {
    presetsDir: "./memes/presets",
    templatesDir: "./memes/templates",
    datasetsRoot: "./data/datasets",
    cooldownMinutes: 60,
    dryRun: DRY_RUN,
    botUserId: userId,
    twitterClient: rawClient,
    xClient,
  };

  const workflow = new MentionWorkflow(workflowConfig, rewardEngine);

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
          await processMention(workflow, mention, state);
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
