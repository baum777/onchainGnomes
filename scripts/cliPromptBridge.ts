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
} {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const nonFlags = args.filter((a) => !a.startsWith("--"));
  const userInput = nonFlags.join(" ").trim();

  return {
    userInput,
    debugPrompt: flags.has("--debug-prompt"),
    debugBridge: flags.has("--debug-bridge"),
    debugDecision: flags.has("--debug-decision"),
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
  const { userInput, debugPrompt, debugBridge, debugDecision } = parseArgs();

  if (!userInput) {
    outputError("skip_invalid_input", "empty input");
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    outputError(
      "bridge_error",
      "XAI_API_KEY not set — LLM required for canonical pipeline"
    );
  }

  const llmClient = withCircuitBreaker(createXAILLMClient());
  const deps = { llm: llmClient, botUserId: BOT_USER_ID_TERMINAL };
  const config = DEFAULT_CANONICAL_CONFIG;

  let event: CanonicalEvent;
  try {
    event = createSimulatedMention(userInput);
  } catch (e) {
    outputError("skip_invalid_input", e instanceof Error ? e.message : String(e));
  }

  const debug: Record<string, unknown> = {};
  if (debugBridge) {
    debug.simulated_mention = {
      event_id: event.event_id,
      text: event.text,
      author_handle: event.author_handle,
      author_id: event.author_id,
      platform: event.platform,
      trigger_type: event.trigger_type,
      timestamp: event.timestamp,
    };
  }

  try {
    const startMs = Date.now();
    const result = await handleEvent(event, deps, config);
    const latencyMs = Date.now() - startMs;

    if (result.action === "skip") {
      if (debugDecision || debugBridge) {
        debug.skip_reason = result.skip_reason;
        debug.audit_path = result.audit?.path;
        debug.audit_eligibility_trace = result.audit?.eligibility_trace;
        debug.audit_policy_trace = result.audit?.policy_trace;
      }
      if (debugDecision && result.audit) {
        debug.classifier = {
          intent: result.audit.classifier_output.intent,
          target: result.audit.classifier_output.target,
          policy_blocked: result.audit.classifier_output.policy_blocked,
          policy_severity: result.audit.classifier_output.policy_severity,
        };
        debug.scores = result.audit.score_bundle;
        debug.mode = result.audit.mode;
        debug.thesis = result.audit.thesis?.primary ?? null;
      }

      outputJson({
        skip: true,
        reason: result.skip_reason,
        latency_ms: latencyMs,
        ...(Object.keys(debug).length > 0 ? { debug } : {}),
      });
      return;
    }

    if (debugDecision || debugBridge) {
      debug.mode = result.mode;
      debug.thesis = result.thesis.primary;
    }
    if (debugPrompt && result.audit) {
      debug.prompt_hash = result.audit.prompt_hash;
    }

    outputJson({
      skip: false,
      reply_text: result.reply_text,
      mode: result.mode,
      latency_ms: latencyMs,
      ...(Object.keys(debug).length > 0 ? { debug } : {}),
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
