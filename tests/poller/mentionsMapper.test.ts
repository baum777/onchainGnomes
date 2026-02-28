/**
 * Mentions Mapper Tests
 *
 * Unit tests for mapping Twitter API v2 responses to internal Mention objects.
 * Verifies author username resolution from includes.users.
 */

import { describe, it, expect } from "vitest";
import {
  mapMentionsResponse,
  MENTIONS_FETCH_OPTIONS,
  type Mention,
} from "../../src/poller/mentionsMapper.js";
import type { ApiV2Includes, TweetV2, UserV2 } from "twitter-api-v2";

describe("mentionsMapper", () => {
  describe("MENTIONS_FETCH_OPTIONS", () => {
    it("includes required expansions", () => {
      expect(MENTIONS_FETCH_OPTIONS.expansions).toContain("author_id");
      expect(MENTIONS_FETCH_OPTIONS.expansions).toContain("referenced_tweets.id");
      expect(MENTIONS_FETCH_OPTIONS.expansions).toContain("in_reply_to_user_id");
    });

    it("includes required tweet.fields", () => {
      expect(MENTIONS_FETCH_OPTIONS["tweet.fields"]).toContain("id");
      expect(MENTIONS_FETCH_OPTIONS["tweet.fields"]).toContain("text");
      expect(MENTIONS_FETCH_OPTIONS["tweet.fields"]).toContain("author_id");
      expect(MENTIONS_FETCH_OPTIONS["tweet.fields"]).toContain("created_at");
      expect(MENTIONS_FETCH_OPTIONS["tweet.fields"]).toContain("conversation_id");
      expect(MENTIONS_FETCH_OPTIONS["tweet.fields"]).toContain("referenced_tweets");
    });

    it("includes required user.fields", () => {
      expect(MENTIONS_FETCH_OPTIONS["user.fields"]).toContain("id");
      expect(MENTIONS_FETCH_OPTIONS["user.fields"]).toContain("username");
      expect(MENTIONS_FETCH_OPTIONS["user.fields"]).toContain("name");
      expect(MENTIONS_FETCH_OPTIONS["user.fields"]).toContain("verified");
    });
  });

  describe("mapMentionsResponse", () => {
    it("maps tweets with author usernames from includes", () => {
      // Mock API response with includes.users
      const mockResponse = {
        data: {
          data: [
            {
              id: "tweet_123",
              text: "Hello @serGorky",
              author_id: "user_456",
              created_at: "2024-01-15T12:00:00Z",
              conversation_id: "conv_789",
              referenced_tweets: [
                { type: "replied_to", id: "tweet_parent" },
              ],
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              {
                id: "user_456",
                username: "alice",
                name: "Alice Smith",
                verified: true,
              } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          meta: {
            result_count: 1,
            newest_id: "tweet_123",
            oldest_id: "tweet_123",
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]).toMatchObject({
        id: "tweet_123",
        text: "Hello @serGorky",
        author_id: "user_456",
        authorUsername: "alice",
        conversation_id: "conv_789",
        created_at: "2024-01-15T12:00:00Z",
      });
      expect(result.maxId).toBe("tweet_123");
      expect(result.meta?.result_count).toBe(1);
    });

    it("sets authorUsername to null when user not in includes", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "tweet_123",
              text: "Hello",
              author_id: "user_unknown",
              created_at: "2024-01-15T12:00:00Z",
            } as unknown as TweetV2,
          ],
          includes: {
            users: [],
          } as unknown as ApiV2Includes,
          meta: {
            result_count: 1,
            newest_id: "tweet_123",
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions[0]?.authorUsername).toBeNull();
    });

    it("maps multiple mentions with correct usernames", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "tweet_1",
              text: "First mention",
              author_id: "user_a",
              created_at: "2024-01-15T10:00:00Z",
            } as unknown as TweetV2,
            {
              id: "tweet_2",
              text: "Second mention",
              author_id: "user_b",
              created_at: "2024-01-15T11:00:00Z",
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              { id: "user_a", username: "alice" } as unknown as UserV2,
              { id: "user_b", username: "bob" } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          meta: {
            result_count: 2,
            newest_id: "tweet_2",
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0]?.authorUsername).toBe("alice");
      expect(result.mentions[1]?.authorUsername).toBe("bob");
      // maxId should be the newest tweet id
      expect(result.maxId).toBe("tweet_2");
    });

    it("handles mentions without referenced_tweets", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "tweet_123",
              text: "Simple mention",
              author_id: "user_456",
              created_at: "2024-01-15T12:00:00Z",
              // No referenced_tweets field
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              { id: "user_456", username: "alice" } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          meta: {
            result_count: 1,
            newest_id: "tweet_123",
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions[0]?.referenced_tweets).toBeNull();
      expect(result.mentions[0]?.in_reply_to_user_id).toBeNull();
    });

    it("handles empty mentions response", () => {
      const mockResponse = {
        data: {
          data: [],
          includes: { users: [] },
          meta: {
            result_count: 0,
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions).toHaveLength(0);
      expect(result.maxId).toBeNull();
    });

    it("handles missing includes gracefully", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "tweet_123",
              text: "Hello",
              author_id: "user_456",
              created_at: "2024-01-15T12:00:00Z",
            } as unknown as TweetV2,
          ],
          // No includes field
          meta: {
            result_count: 1,
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions[0]?.authorUsername).toBeNull();
    });

    it("extracts in_reply_to_user_id from referenced_tweets", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "tweet_123",
              text: "Reply to someone",
              author_id: "user_456",
              created_at: "2024-01-15T12:00:00Z",
              referenced_tweets: [
                { type: "replied_to", id: "parent_tweet_789" },
              ],
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              { id: "user_456", username: "alice" } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          meta: {
            result_count: 1,
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions[0]?.in_reply_to_user_id).toBe("parent_tweet_789");
      expect(result.mentions[0]?.referenced_tweets).toEqual([
        { type: "replied_to", id: "parent_tweet_789" },
      ]);
    });

    it("calculates maxId from mentions when meta.newest_id is missing", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "1000000000000000000",
              text: "First",
              author_id: "user_1",
            } as unknown as TweetV2,
            {
              id: "2000000000000000000",
              text: "Second",
              author_id: "user_2",
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              { id: "user_1", username: "alice" } as unknown as UserV2,
              { id: "user_2", username: "bob" } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          // No meta.newest_id
        },
      };

      const result = mapMentionsResponse(mockResponse);

      // Should pick the largest (newest) ID
      expect(result.maxId).toBe("2000000000000000000");
    });
  });

  describe("response shape handling", () => {
    it("accepts wrapped response shape (response.data = { data, includes, meta })", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "1000000000000000001",
              text: "Wrapped response mention",
              author_id: "user_abc",
              created_at: "2024-01-15T10:00:00Z",
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              { id: "user_abc", username: "wrappeduser" } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          meta: {
            result_count: 1,
            newest_id: "1000000000000000001",
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]?.authorUsername).toBe("wrappeduser");
      expect(result.maxId).toBe("1000000000000000001");
    });

    it("accepts root response shape (response = { data, includes, meta })", () => {
      const mockResponse = {
        data: [
          {
            id: "2000000000000000002",
            text: "Root response mention",
            author_id: "user_def",
            created_at: "2024-01-15T11:00:00Z",
          } as unknown as TweetV2,
        ],
        includes: {
          users: [
            { id: "user_def", username: "rootuser" } as unknown as UserV2,
          ],
        } as ApiV2Includes,
        meta: {
          result_count: 1,
          newest_id: "2000000000000000002",
        },
      };

      const result = mapMentionsResponse(mockResponse);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]?.authorUsername).toBe("rootuser");
      expect(result.maxId).toBe("2000000000000000002");
    });
  });

  describe("whitelist integration", () => {
    it("correctly maps whitelisted usernames for activation policy", () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: "1000000000000000001",
              text: "@serGorky help",
              author_id: "user_twim",
              created_at: "2024-01-15T10:00:00Z",
            } as unknown as TweetV2,
            {
              id: "2000000000000000002",
              text: "@serGorky hello",
              author_id: "user_nira",
              created_at: "2024-01-15T11:00:00Z",
            } as unknown as TweetV2,
          ],
          includes: {
            users: [
              { id: "user_twim", username: "twimsalot" } as unknown as UserV2,
              { id: "user_nira", username: "nirapump_" } as unknown as UserV2,
            ],
          } as ApiV2Includes,
          meta: {
            result_count: 2,
          },
        },
      };

      const result = mapMentionsResponse(mockResponse);

      // Verify usernames are resolved for whitelist matching
      expect(result.mentions[0]?.authorUsername).toBe("twimsalot");
      expect(result.mentions[1]?.authorUsername).toBe("nirapump_");

      // These usernames would match the default whitelist: @twimsalot,@nirapump_
    });
  });
});
