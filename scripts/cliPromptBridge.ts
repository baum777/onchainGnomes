/**
 * CLI Prompt Bridge — Terminal-to-canonical mention simulator.
 * Wraps terminal input as a simulated X mention and runs the full production pipeline.
 * Outputs JSON: { skip, reason?, reply_text?, mode?, debug? }
 *
 * Uses handleEvent() — no direct LLM shortcut. Pipeline: classify → score → eligibility
 * → thesis → mode → fallbackCascade (LLM) → validate.
 */

import "dotenv/config";
import { createSimulatedMention } from "../src/canonical/createSimulatedMention.js";
import { handleEvent } from "../src/canonical/pipeline.js";
import {
  DEFAULT_CANONICAL_CONFIG,
  type CanonicalEvent,
} from "../src/canonical/types.js";
import { createXAILLMClient } from "../src/clients/llmClient.xai.js";
import { withCircuitBreaker } from "../src/ops/llmCircuitBreaker.js";

const BOT_USER_ID_TERMINAL = "terminal-bot-1";

function parseArgs(): {
  userInput: string;
  debugPrompt: boolean;
  debugBridge: boolean;
  debugDecision: boolean;
  systemOverride?: string;
} {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const nonFlags = args.filter((a) => !a.startsWith("--") && a !== "--system"); // Avoid capturing the flag value as input if it was misplaced
  
  // Custom logic to find --system and its value, then remove them from non-flags
  let systemOverride: string | undefined;
  const sysIdx = args.indexOf("--system");
  if (sysIdx !== -1 && sysIdx + 1 < args.length) {
    systemOverride = args[sysIdx + 1];
  }

  // Filter out the system prompt from the user input if it was included in nonFlags
  const filteredNonFlags = nonFlags.filter(val => val !== systemOverride);
  const userInput = filteredNonFlags.join(" ").trim();

  return {
    userInput,
    debugPrompt: flags.has("--debug-prompt"),
    debugBridge: flags.has("--debug-bridge"),
    debugDecision: flags.has("--debug-decision"),
    systemOverride,
  };
}

function outputJson(obj: object): void {
  console.log(JSON.stringify(obj));
}

function outputError(reason: string, detail?: string): never {
  const payload: Record<string, unknown> = { skip: true, reason };
  if (detail) payload.bridge_error_detail = detail;
  outputJson(payload);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const userInput = args.userInput;
  const systemOverride = args.systemOverride;

  if (!userInput) {
    outputError("skip_invalid_input", "empty input");
  }

  const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    outputError(
      "bridge_error",
      "API Key not set (XAI_API_KEY or OPENAI_API_KEY) — LLM required for canonical pipeline"
    );
  }

  const llmClient = withCircuitBreaker(createXAILLMClient());
  const deps = { llm: llmClient, botUserId: BOT_USER_ID_TERMINAL };
  
  // Apply system override to config if provided
  const config = { ...DEFAULT_CANONICAL_CONFIG };
  if (systemOverride) {
    (config as any).system_prompt_override = systemOverride;
  }

  // Apply test/aggressive mode flags from environment
  if (process.env.AGGRESSIVE_MODE === "analyst") {
    config.aggressive_mode = "analyst";
  } else if (process.env.AGGRESSIVE_MODE === "horny") {
    config.aggressive_mode = "horny";
  }
  
  if (process.env.TEST_MODE === "true") {
    config.test_mode = true;
  }

  if (process.env.FULL_SPECTRUM_PROMPT === "true") {
    config.full_spectrum_prompt = true;
  }

  let event: CanonicalEvent;
  try {
    event = createSimulatedMention(userInput);
  } catch (e) {
    outputError("skip_invalid_input", e instanceof Error ? e.message : String(e));
  }

  try {
    const startMs = Date.now();
    const result = await handleEvent(event, deps, config);
    const latencyMs = Date.now() - startMs;

    if (result.action === "skip") {
      outputJson({
        skip: true,
        reason: result.skip_reason,
        latency_ms: latencyMs,
      });
      return;
    }

    outputJson({
      skip: false,
      reply_text: result.reply_text,
      mode: result.mode,
      latency_ms: latencyMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    outputError(
      "bridge_error",
      `pipeline threw: ${msg}${stack ? `\n${stack}` : ""}`
    );
  }
}

main();
