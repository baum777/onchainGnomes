/**
 * X Read Client — Read-only wrapper for Twitter API v2
 *
 * Provides getMe, getTweet, getTweets, searchRecent with consistent
 * expansions and error handling.
 */

import type { TwitterApi } from "twitter-api-v2";

export interface XReadClient {
  getMe(): Promise<{ id: string; username?: string }>;
  getTweet(id: string): Promise<unknown>;
  getTweets(ids: string[]): Promise<unknown>;
  searchRecent(query: string, params: Record<string, unknown>): Promise<unknown>;
}

export function createXReadClient(raw: TwitterApi): XReadClient {
  return {
    async getMe() {
      const me = await raw.v2.me({ "user.fields": ["username"] as const });
      return {
        id: me.data.id,
        username: (me.data as { username?: string }).username,
      };
    },
    async getTweet(id: string) {
      return raw.v2.singleTweet(id, {
        expansions: ["author_id", "referenced_tweets.id"],
        "tweet.fields": ["created_at", "conversation_id", "author_id", "referenced_tweets"],
        "user.fields": ["username", "name"],
      } as Record<string, unknown>);
    },
    async getTweets(ids: string[]) {
      return raw.v2.tweets(ids, {
        expansions: ["author_id", "referenced_tweets.id"],
        "tweet.fields": ["created_at", "conversation_id", "author_id", "referenced_tweets"],
        "user.fields": ["username", "name"],
      } as Record<string, unknown>);
    },
    async searchRecent(query: string, params: Record<string, unknown>) {
      return raw.v2.search(query, params);
    },
  };
}
