/**
 * Gnomes Bot — Canonical Entrypoint
 *
 * Production entrypoint for the mention poller worker.
 * Loads env, validates config, and runs the worker loop.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env") });
import { validateEnv } from "./config/envSchema.js";
import { validateLaunchEnvOrExit } from "./config/env.js";
import { runWorkerLoop } from "./worker/pollMentions.js";

if (process.env.SKIP_ENV_VALIDATION !== "true") {
  validateEnv();
  validateLaunchEnvOrExit();
}
runWorkerLoop().catch((e) => {
  console.error("[FATAL] Worker crashed:", e);
  process.exit(1);
});
