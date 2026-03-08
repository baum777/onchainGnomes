import { RedisStateStore } from "./redisStore.js";
import type { StateStore } from "./stateStore.js";
import { logInfo, logWarn } from "../ops/logger.js";

export function createStateStore(): StateStore {
  const url = process.env.KV_URL ?? process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      "KV_URL not configured. Set KV_URL=redis://... in your environment.",
    );
  }

  logInfo("[initStore] Creating RedisStateStore", {
    host: url.replace(/\/\/.*@/, "//***@"),
  });

  return new RedisStateStore(url);
}
