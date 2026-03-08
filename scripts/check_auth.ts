import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";

async function checkAuth() {
  const rawClient = new TwitterApi({
    appKey: process.env.X_API_KEY || "",
    appSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  });

  try {
    const user = await rawClient.v2.me();
    console.log("Authenticated as:");
    console.log("ID:", user.data.id);
    console.log("Username:", user.data.username);
    console.log("Name:", user.data.name);
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

checkAuth();
