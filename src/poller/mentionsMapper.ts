/**
 * Mentions Mapper
 *
 * Maps Twitter API v2 userMentionTimeline response to internal Mention objects.
 * Handles expansions to resolve author usernames from includes.users.
 */

import type { TweetV2, UserV2, ReferencedTweetV2, ApiV2Includes } from "twitter-api-v2";

export type Mention = {
  id: string;
  text: string;
  author_id: string;
  authorUsername: string | null;
  conversation_id: string | null;
  created_at: string | null;
  referenced_tweets: Array<{
    type: string;
    id: string;
  }> | null;
  in_reply_to_user_id: string | null;
};

export type FetchMentionsResult = {
  mentions: Mention[];
  maxId: string | null;
  meta: {
    result_count: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  } | null;
};

/**
 * Build a Map of userId -> username from API includes
 */
function buildUserIdToUsernameMap(includes?: ApiV2Includes): Map<string, string> {
  const userMap = new Map<string, string>();

  if (!includes?.users) {
    return userMap;
  }

  for (const user of includes.users) {
    if (user.id && user.username) {
      userMap.set(user.id, user.username);
    }
  }

  return userMap;
}

/**
 * Map a single tweet to Mention with resolved username
 */
function mapTweetToMention(
  tweet: TweetV2,
  userMap: Map<string, string>,
  includes?: ApiV2Includes
): Mention {
  // Resolve author username from includes.users
  const authorUsername = tweet.author_id
    ? userMap.get(tweet.author_id) ?? null
    : null;

  // Build referenced tweets if present
  let referencedTweets: Array<{ type: string; id: string }> | null = null;
  if (tweet.referenced_tweets && Array.isArray(tweet.referenced_tweets)) {
    referencedTweets = tweet.referenced_tweets.map((ref: ReferencedTweetV2) => ({
      type: ref.type,
      id: ref.id,
    }));
  }

  // Get in_reply_to_user_id if this is a reply
  const inReplyToUserId =
    referencedTweets?.find((r) => r.type === "replied_to")?.id ?? null;

  if (!authorUsername) {
    console.warn(`[WARN] authorUsername missing for mention ${tweet.id}`);
  }

  return {
    id: tweet.id,
    text: tweet.text ?? "",
    author_id: tweet.author_id || "",
    authorUsername,
    conversation_id: (tweet as unknown as Record<string, string>).conversation_id ?? null,
    created_at: tweet.created_at ?? null,
    referenced_tweets: referencedTweets,
    in_reply_to_user_id: inReplyToUserId,
  };
}

/**
 * Safely compare tweet IDs as BigInt, ignoring malformed IDs
 */
function compareTweetIds(a: string, b: string): number {
  try {
    const bigA = BigInt(a);
    const bigB = BigInt(b);
    if (bigA > bigB) return 1;
    if (bigA < bigB) return -1;
    return 0;
  } catch {
    // Ignore malformed IDs - treat as equal (fallback to string comparison)
    return 0;
  }
}

/**
 * Map Twitter API v2 mention timeline response to internal Mentions
 * Supports both shapes:
 *   - response is JSON root { data, includes, meta }
 *   - response is wrapped { data: { data, includes, meta } }
 */
export function mapMentionsResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): FetchMentionsResult {
  // Handle both wrapped and unwrapped response shapes
  // wrapped: response.data = { data, includes, meta }
  // unwrapped: response = { data, includes, meta }
  const root = response?.data?.data ? response.data : response;

  const tweets: TweetV2[] = root?.data || [];
  const includes: ApiV2Includes | undefined = root?.includes;
  const meta = root?.meta || null;

  // Build user lookup map
  const userMap = buildUserIdToUsernameMap(includes);

  // Map each tweet to Mention with resolved username
  const mentions: Mention[] = tweets.map((tweet) =>
    mapTweetToMention(tweet, userMap, includes)
  );

  // Calculate maxId for pagination (newest tweet id)
  let maxId: string | null = null;
  if (meta?.newest_id) {
    maxId = meta.newest_id;
  } else {
    // Fallback: find newest from mentions with guarded BigInt comparison
    for (const mention of mentions) {
      if (!maxId || compareTweetIds(mention.id, maxId) > 0) {
        maxId = mention.id;
      }
    }
  }

  return {
    mentions,
    maxId,
    meta,
  };
}

/**
 * Options for fetching mentions with proper expansions and fields
 */
export const MENTIONS_FETCH_OPTIONS = {
  max_results: 10 as const,
  expansions: [
    "author_id",
    "referenced_tweets.id",
    "in_reply_to_user_id",
  ] as const,
  "tweet.fields": [
    "id",
    "text",
    "author_id",
    "created_at",
    "conversation_id",
    "referenced_tweets",
    "in_reply_to_user_id",
  ] as const,
  "user.fields": [
    "id",
    "username",
    "name",
    "verified",
    "description",
    "created_at",
    "public_metrics",
  ] as const,
};

/**
 * Type for the fetch options
 */
export type MentionsFetchOptions = typeof MENTIONS_FETCH_OPTIONS;
