import { invokeXApiRequest } from "../clients/xApi.js";
import type { TimelineScoutTweet } from "./types.js";

export interface TimelineScoutConfig {
  sourceAccounts: string[];
  keywordFilters: string[];
  maxResults?: number;
}

interface SearchResponse {
  data?: TimelineScoutTweet[];
  includes?: {
    users?: Array<{ id: string; username: string }>;
  };
}

export async function scoutTimelineCandidates(config: TimelineScoutConfig): Promise<{
  tweets: TimelineScoutTweet[];
  userMap: Map<string, string>;
}> {
  if (config.sourceAccounts.length === 0) return { tweets: [], userMap: new Map() };

  const queryParts: string[] = [
    `(${config.sourceAccounts.map((a) => `from:${a}`).join(" OR ")})`,
    "-is:retweet",
    "-is:quote",
  ];
  if (config.keywordFilters.length > 0) {
    queryParts.push(`(${config.keywordFilters.map((k) => `"${k}"`).join(" OR ")})`);
  }

  const params = new URLSearchParams({
    query: queryParts.join(" "),
    max_results: String(config.maxResults ?? 50),
    expansions: "author_id,referenced_tweets.id",
    "tweet.fields": "created_at,conversation_id,public_metrics,author_id,referenced_tweets",
    "user.fields": "username",
  });

  const response = await invokeXApiRequest<SearchResponse>({
    method: "GET",
    uri: `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
  });

  const userMap = new Map<string, string>();
  for (const user of response.includes?.users ?? []) {
    userMap.set(user.id, user.username.toLowerCase());
  }

  return { tweets: response.data ?? [], userMap };
}
