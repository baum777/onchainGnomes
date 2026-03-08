import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";

async function checkMentions() {
  const rawClient = new TwitterApi({
    appKey: process.env.X_API_KEY || "",
    appSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  });

  const BOT_USERNAME = process.env.BOT_USERNAME || "GORKYPF";
  const me = await rawClient.v2.me();
  const userId = me.data.id;
  
  console.log(`Authenticated as @${me.data.username} (ID: ${userId})`);
  console.log(`Checking for mentions of @${BOT_USERNAME}...`);

  console.log("\n--- Via search (@username) ---");
  try {
    const search = await rawClient.v2.search(`@${BOT_USERNAME}`, {
      max_results: 10,
      expansions: ["author_id"],
      "user.fields": ["username"]
    });
    console.log(`Found ${search.data.data?.length || 0} mentions.`);
    if (search.data.data) {
      const users = new Map(search.data.includes?.users?.map(u => [u.id, u.username]));
      search.data.data.forEach(t => {
        const username = users.get(t.author_id || "") || "unknown";
        console.log(`- [${t.id}] @${username}: ${t.text}`);
      });
    }
  } catch (err: any) {
    console.error("Failed to fetch via search endpoint:", err.data || err);
  }
}

checkMentions();
