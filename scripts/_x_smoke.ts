import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";

async function run() {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_SECRET!,
  });

  const me = await client.v2.me();
  console.log("OK user:", me.data?.username, me.data?.id);
}

run().catch((e: any) => {
  console.error("SMOKE FAIL code:", e?.code);
  console.error("SMOKE FAIL data:", e?.data);
  console.error("SMOKE FAIL errors:", e?.errors);
  process.exit(1);
});