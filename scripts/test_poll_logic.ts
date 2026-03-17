import "dotenv/config";
import { MENTIONS_FETCH_OPTIONS } from "../src/poller/mentionsMapper.js";
import { invokeXApiRequest } from "../src/clients/xApi.js";

async function testPoll() {
  const BOT_USERNAME = (process.env.BOT_USERNAME ?? "GORKY_ON_SOL_on_sol").replace(/^@/, "");
  const MENTIONS_SOURCE = process.env.MENTIONS_SOURCE;

  console.log(`Testing poll with MENTIONS_SOURCE=${MENTIONS_SOURCE}, BOT_USERNAME=${BOT_USERNAME}`);

  const params: Record<string, unknown> = {
    max_results: 10,
    expansions: [...MENTIONS_FETCH_OPTIONS.expansions],
    "tweet.fields": [...MENTIONS_FETCH_OPTIONS["tweet.fields"]],
    "user.fields": [...MENTIONS_FETCH_OPTIONS["user.fields"]],
  };

  if (MENTIONS_SOURCE === "search") {
    const qp = new URLSearchParams({ query: `@${BOT_USERNAME}` });
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) qp.set(k, v.join(","));
      else qp.set(k, String(v));
    });
    const response = await invokeXApiRequest<{ data?: { id: string; text: string }[] }>({
      method: "GET",
      uri: `https://api.x.com/2/tweets/search/recent?${qp.toString()}`,
    });
    console.log(`Search result count: ${response.data?.length || 0}`);
    if (response.data) response.data.forEach((t) => console.log(`- ${t.id}: ${t.text}`));
  } else {
    const me = await invokeXApiRequest<{ data: { id: string } }>({
      method: "GET",
      uri: "https://api.x.com/2/users/me",
    });

    const qp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) qp.set(k, v.join(","));
      else qp.set(k, String(v));
    });

    const response = await invokeXApiRequest<{ data?: unknown[] }>({
      method: "GET",
      uri: `https://api.x.com/2/users/${me.data.id}/mentions?${qp.toString()}`,
    });
    console.log(`Timeline result count: ${response.data?.length || 0}`);
  }
}

testPoll().catch(console.error);
