import "dotenv/config";
import { invokeXApiRequest } from "../src/clients/xApi.js";

async function checkMentions() {
  const BOT_USERNAME = process.env.BOT_USERNAME || "gorky_on_sol";
  const me = await invokeXApiRequest<{ data: { id: string; username?: string } }>({
    method: "GET",
    uri: "https://api.x.com/2/users/me",
  });

  console.log(`Authenticated as @${me.data.username} (ID: ${me.data.id})`);
  console.log(`Checking for mentions of @${BOT_USERNAME}...`);

  const query = new URLSearchParams({
    query: `@${BOT_USERNAME}`,
    max_results: "10",
    expansions: "author_id",
    "user.fields": "username",
  });

  console.log("\n--- Via search (@username) ---");
  try {
    const search = await invokeXApiRequest<{
      data?: { id: string; text: string; author_id?: string }[];
      includes?: { users?: { id: string; username?: string }[] };
    }>({
      method: "GET",
      uri: `https://api.x.com/2/tweets/search/recent?${query.toString()}`,
    });

    console.log(`Found ${search.data?.length || 0} mentions.`);
    if (search.data) {
      const users = new Map(search.includes?.users?.map((u) => [u.id, u.username]));
      search.data.forEach((t) => {
        const username = users.get(t.author_id || "") || "unknown";
        console.log(`- [${t.id}] @${username}: ${t.text}`);
      });
    }
  } catch (err: any) {
    console.error("Failed to fetch via search endpoint:", err?.data || err);
  }
}

checkMentions();
