/**
 * Input Normalizer
 *
 * Defensive parsing for Twitter API responses:
 * - Handles missing fields
 * - Normalizes unexpected payload formats
 * - Sanitizes text content
 * - Validates data types
 */

import { logWarn, logError } from "../ops/logger.js";

// Maximum field lengths for safety
const MAX_TEXT_LENGTH = 10000;
const MAX_USERNAME_LENGTH = 50;
const MAX_ID_LENGTH = 50;

export interface NormalizedMention {
  id: string;
  text: string;
  author_id: string;
  authorUsername: string | null;
  created_at: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{
    type: string;
    id: string;
  }>;
}

/**
 * Sanitize text to prevent injection and normalize
 */
export function sanitizeText(text: unknown): string {
  if (typeof text !== "string") {
    return "";
  }
  
  // Trim and limit length
  let sanitized = text.trim().slice(0, MAX_TEXT_LENGTH);
  
  // Remove control characters except newlines
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, " ");
  
  return sanitized;
}

/**
 * Validate and normalize ID
 */
export function normalizeId(id: unknown): string | null {
  if (typeof id === "number") {
    return String(id);
  }
  
  if (typeof id !== "string") {
    return null;
  }
  
  // Remove whitespace
  const normalized = id.trim();
  
  // Validate length
  if (normalized.length === 0 || normalized.length > MAX_ID_LENGTH) {
    return null;
  }
  
  // Twitter IDs should be numeric
  if (!/^\d+$/.test(normalized)) {
    logWarn("[INPUT_NORMALIZER] Non-numeric ID detected", { id: normalized });
  }
  
  return normalized;
}

/**
 * Normalize username
 */
export function normalizeUsername(username: unknown): string | null {
  if (typeof username !== "string") {
    return null;
  }
  
  // Remove @ prefix if present
  let normalized = username.trim().replace(/^@/, "");
  
  // Validate length
  if (normalized.length === 0 || normalized.length > MAX_USERNAME_LENGTH) {
    return null;
  }
  
  // Twitter usernames: alphanumeric + underscore
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    logWarn("[INPUT_NORMALIZER] Invalid username format", { username: normalized });
  }
  
  return normalized.toLowerCase();
}

/**
 * Parse date safely
 */
export function parseDate(dateValue: unknown): string {
  if (typeof dateValue === "string") {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Fallback to now
  return new Date().toISOString();
}

/**
 * Normalize a tweet object from Twitter API
 */
export function normalizeTweet(tweet: unknown): NormalizedMention | null {
  if (!tweet || typeof tweet !== "object") {
    logError("[INPUT_NORMALIZER] Invalid tweet object");
    return null;
  }
  
  const t = tweet as Record<string, unknown>;
  
  // Required fields
  const id = normalizeId(t.id);
  if (!id) {
    logError("[INPUT_NORMALIZER] Missing or invalid tweet ID");
    return null;
  }
  
  const text = sanitizeText(t.text);
  const author_id = normalizeId(t.author_id) || "unknown";
  const created_at = parseDate(t.created_at);
  
  // Optional fields with defaults
  const authorUsername = normalizeUsername(t.authorUsername || (t as Record<string, unknown>).username);
  const conversation_id = normalizeId(t.conversation_id) || undefined;
  const in_reply_to_user_id = normalizeId(t.in_reply_to_user_id) || undefined;
  
  // Handle referenced tweets
  let referenced_tweets: NormalizedMention["referenced_tweets"] = undefined;
  if (Array.isArray(t.referenced_tweets)) {
    referenced_tweets = t.referenced_tweets
      .filter((ref): ref is { type: string; id: string } => 
        typeof ref === "object" && 
        ref !== null &&
        typeof ref.type === "string" &&
        typeof ref.id === "string"
      )
      .map((ref) => ({
        type: ref.type,
        id: ref.id,
      }));
  }
  
  return {
    id,
    text,
    author_id,
    authorUsername,
    created_at,
    ...(conversation_id && { conversation_id }),
    ...(in_reply_to_user_id && { in_reply_to_user_id }),
    ...(referenced_tweets && { referenced_tweets }),
  };
}

/**
 * Normalize array of tweets
 */
export function normalizeTweets(tweets: unknown[]): NormalizedMention[] {
  const normalized: NormalizedMention[] = [];
  
  for (const tweet of tweets) {
    try {
      const normalizedTweet = normalizeTweet(tweet);
      if (normalizedTweet) {
        normalized.push(normalizedTweet);
      }
    } catch (error) {
      logError("[INPUT_NORMALIZER] Failed to normalize tweet", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return normalized;
}

/**
 * Validate mention has required fields
 */
export function isValidMention(mention: NormalizedMention): boolean {
  if (!mention.id || !mention.text || !mention.author_id) {
    return false;
  }
  
  if (mention.text.length === 0) {
    return false;
  }
  
  return true;
}

/**
 * Defensive JSON parser
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logWarn("[INPUT_NORMALIZER] JSON parse failed, using default", {
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultValue;
  }
}

/**
 * Extract mentions from various response formats
 */
export function extractMentionsFromResponse(response: unknown): NormalizedMention[] {
  if (!response || typeof response !== "object") {
    return [];
  }
  
  const r = response as Record<string, unknown>;
  
  // Standard Twitter API format: { data: [...] }
  if (Array.isArray(r.data)) {
    return normalizeTweets(r.data);
  }
  
  // Alternative format: { tweets: [...] }
  if (Array.isArray(r.tweets)) {
    return normalizeTweets(r.tweets);
  }
  
  // Single tweet format: { id: ..., text: ... }
  if (r.id && r.text) {
    const single = normalizeTweet(r);
    return single ? [single] : [];
  }
  
  logWarn("[INPUT_NORMALIZER] Unknown response format");
  return [];
}
