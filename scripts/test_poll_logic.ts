import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";
import { createXClient } from "./src/clients/xClient.js";
import { mapMentionsResponse, MENTIONS_FETCH_OPTIONS } from "./src/poller/mentionsMapper.js";

async function testPoll() {
  const rawClient = new TwitterApi({
    appKey: process.env.X_API_KEY || "",
    appSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  });

  const BOT_USERNAME = (process.env.BOT_USERNAME ?? "Gorky_on_sol_on_sol").replace(/^@/, "");
  const MENTIONS_SOURCE = process.env.MENTIONS_SOURCE;

  console.log(`Testing poll with MENTIONS_SOURCE=${MENTIONS_SOURCE}, BOT_USERNAME=${BOT_USERNAME}`);

  const params: any = {
    max_results: 10,
    expansions: [...MENTIONS_FETCH_OPTIONS.expansions],
    "tweet.fields": [...MENTIONS_FETCH_OPTIONS["tweet.fields"]],
    "user.fields": [...MENTIONS_FETCH_OPTIONS["user.fields"]],
  };

  if (MENTIONS_SOURCE === "search") {
    const query = `@${BOT_USERNAME}`;
    const response = await rawClient.v2.search(query, params);
    console.log(`Search result count: ${response.data.data?.length || 0}`);
    if (response.data.data) {
        response.data.data.forEach(t => console.log(`- ${t.id}: ${t.text}`));
    }
  } else {
    const user = await rawClient.v2.me();
    const response = await rawClient.v2.userMentionTimeline(user.data.id, params);
    console.log(`Timeline result count: ${response.data.data?.length || 0}`);
  }
}

testPoll().catch(console.error);
