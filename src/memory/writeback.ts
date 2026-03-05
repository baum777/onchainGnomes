/**
 * Memory Writeback - Persist Interactions and Generated Lore
 *
 * Handles writeback operations after reply generation:
 * - Stores new lore entries when replies contain creative content
 * - Records user interactions
 * - Updates fact store with verified data
 *
 * Example:
 * user: "where are you from"
 * bot: "the liquidity void behind green candles"
 * → Lore entry appended for future consistency
 */

import type { LoreStore } from "./loreStore.js";
import type { FactsStore } from "./factsStore.js";
import type { UserGraph } from "./userGraph.js";
import type {
  ReplyCandidate,
  IntentDetectionResult,
  TruthClassification,
  MemoryWriteback,
  LoreEntry,
  SentimentLabel,
} from "../types/coreTypes.js";

export interface WritebackDeps {
  loreStore: LoreStore;
  factsStore?: FactsStore;
  userGraph: UserGraph;
}

/** Writeback operation result */
export interface WritebackResult {
  success: boolean;
  loreWritten: boolean;
  loreId?: string;
  interactionRecorded: boolean;
  interactionId?: string;
  errors: string[];
}

/**
 * Performs memory writeback after a reply is generated.
 * Stores lore if reply contains narrative content.
 * Records user interaction.
 */
export async function performWriteback(
  deps: WritebackDeps,
  params: {
    userId: string;
    userHandle: string;
    tweetId: string;
    ourReplyId?: string;
    replyCandidate: ReplyCandidate;
    truthClassification: TruthClassification;
    intentResult: IntentDetectionResult;
    threadTopic?: string;
  }
): Promise<WritebackResult> {
  const errors: string[] = [];
  const result: WritebackResult = {
    success: true,
    loreWritten: false,
    interactionRecorded: false,
    errors,
  };

  // Step 1: Extract and store lore if applicable
  if (truthClassification.category === "LORE") {
    try {
      const loreId = await extractAndStoreLore(deps.loreStore, params);
      result.loreWritten = true;
      result.loreId = loreId;
    } catch (error) {
      errors.push(`Lore writeback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Step 2: Record user interaction
  try {
    const sentiment = determineSentiment(
      params.intentResult.aggression_level,
      params.intentResult.intent
    );

    const interaction = await deps.userGraph.recordInteraction(
      params.userId,
      params.userHandle,
      {
        user_handle: params.userHandle,
        tweet_id: params.tweetId,
        our_reply_id: params.ourReplyId,
        interaction_type: params.intentResult.intent,
        sentiment,
        topic: params.threadTopic,
        lore_generated: result.loreWritten ? result.loreId : undefined,
      }
    );

    result.interactionRecorded = true;
    result.interactionId = interaction.id;
  } catch (error) {
    errors.push(`Interaction recording failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Determine overall success
  result.success = errors.length === 0 ||
    (result.loreWritten || truthClassification.category !== "LORE") &&
    result.interactionRecorded;

  return result;
}

/**
 * Extracts lore from a reply and stores it.
 * Parses the reply for narrative content that should be remembered.
 */
async function extractAndStoreLore(
  loreStore: LoreStore,
  params: {
    userId: string;
    userHandle: string;
    replyCandidate: ReplyCandidate;
    intentResult: IntentDetectionResult;
    threadTopic?: string;
  }
): Promise<string> {
  const { replyCandidate, intentResult, threadTopic } = params;
  const replyText = replyCandidate.reply_text;

  // Determine lore topic based on context
  const loreTopic = determineLoreTopic(intentResult, threadTopic);

  // Extract the narrative portion (full reply for now, could be smarter)
  const loreContent = extractNarrativeContent(replyText);

  // Determine tags
  const tags = buildLoreTags(loreTopic, intentResult, threadTopic);

  // Store in lore store
  const entry = await loreStore.addLore({
    topic: loreTopic,
    content: loreContent,
    tags,
    last_accessed: new Date().toISOString(),
  });

  return entry.id;
}

/**
 * Determines the appropriate lore topic from context.
 */
function determineLoreTopic(
  intentResult: IntentDetectionResult,
  threadTopic?: string
): string {
  // Lore query about bot identity
  if (intentResult.intent === "lore_query") {
    const topics = intentResult.topics;
    if (topics.includes("origin") || topics.includes("backstory")) {
      return "origin";
    }
    if (topics.includes("location") || topics.includes("where")) {
      return "location";
    }
    if (topics.includes("purpose") || topics.includes("mission")) {
      return "purpose";
    }
    return "identity";
  }

  // Market-related lore
  if (intentResult.intent === "market_request" || intentResult.intent === "coin_query") {
    return "market_observation";
  }

  // Use thread topic if available
  if (threadTopic) {
    return `topic_${threadTopic.toLowerCase().replace(/\s+/g, "_")}`;
  }

  // Default topic
  return "general_interaction";
}

/**
 * Extracts narrative content from a reply.
 * Filters out questions, calls-to-action, etc.
 */
function extractNarrativeContent(replyText: string): string {
  // Remove questions (we only want statements for lore)
  let content = replyText
    .split(/\?/)[0] // Take only part before first question mark
    .trim();

  // Remove common prefixes
  const prefixesToRemove = [
    /^here['']s?:?\s*/i,
    /^well[,]?\s*/i,
    /^honestly[,]?\s*/i,
    /^tbh[,]?\s*/i,
  ];

  for (const prefix of prefixesToRemove) {
    content = content.replace(prefix, "");
  }

  // Truncate if too long
  if (content.length > 280) {
    content = content.slice(0, 277) + "...";
  }

  return content;
}

/**
 * Builds tags for a lore entry.
 */
function buildLoreTags(
  loreTopic: string,
  intentResult: IntentDetectionResult,
  threadTopic?: string
): string[] {
  const tags = [loreTopic];

  // Add intent-based tags
  switch (intentResult.intent) {
    case "lore_query":
      tags.push("backstory", "identity");
      break;
    case "question":
      tags.push("q_and_a");
      break;
    case "market_request":
    case "coin_query":
      tags.push("market", "analysis");
      break;
    case "meme_play":
      tags.push("meme", "humor");
      break;
  }

  // Add entity tags
  for (const coin of intentResult.entities.coins) {
    tags.push(`coin_${coin.toLowerCase()}`);
  }

  for (const cashtag of intentResult.entities.cashtags) {
    tags.push(`cashtag_${cashtag.toLowerCase().replace("$", "")}`);
  }

  // Add thread topic tag
  if (threadTopic) {
    tags.push(`topic_${threadTopic.toLowerCase().replace(/\s+/g, "_")}`);
  }

  return dedupe(tags);
}

/**
 * Determines sentiment label from aggression level and intent.
 */
function determineSentiment(
  aggressionLevel: "low" | "medium" | "high",
  intent: string
): SentimentLabel {
  if (aggressionLevel === "high") {
    return "hostile";
  }

  if (aggressionLevel === "medium") {
    if (intent === "insult" || intent === "debate") {
      return "suspicious";
    }
    return "neutral";
  }

  // Low aggression
  if (intent === "meme_play") {
    return "playful";
  }

  if (intent === "question" || intent === "lore_query") {
    return "friendly";
  }

  return "neutral";
}

/**
 * Deduplicates array while preserving order.
 */
function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Creates a writeback batch for multiple replies.
 */
export async function batchWriteback(
  deps: WritebackDeps,
  operations: Array<{
    userId: string;
    userHandle: string;
    tweetId: string;
    ourReplyId?: string;
    replyCandidate: ReplyCandidate;
    truthClassification: TruthClassification;
    intentResult: IntentDetectionResult;
    threadTopic?: string;
  }>
): Promise<WritebackResult[]> {
  const results: WritebackResult[] = [];

  for (const op of operations) {
    const result = await performWriteback(deps, op);
    results.push(result);
  }

  return results;
}
