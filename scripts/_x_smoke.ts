import "dotenv/config";
import { invokeXApiRequest } from "../src/clients/xApi.js";

async function run() {
  const me = await invokeXApiRequest<{ data: { username?: string; id: string } }>({
    method: "GET",
    uri: "https://api.x.com/2/users/me",
  });
  console.log("OK user:", me.data?.username, me.data?.id);
}

run().catch((e: any) => {
  console.error("SMOKE FAIL:", e?.message || e);
  process.exit(1);
});
