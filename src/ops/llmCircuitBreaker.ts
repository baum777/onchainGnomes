/**
 * LLM Circuit Breaker
 *
 * After 3 consecutive JSON parse failures, opens circuit and returns
 * safe refusal until cooldown expires.
 */

import type { LLMClient } from "../clients/llmClient.js";
import { withTimeout } from "../utils/withTimeout.js";

const CONSECUTIVE_FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000; // 1 min
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 30_000;

const REFUSAL_REPLY = "Chart observation in progress. My circuits are recalibrating — try again in a moment.";

let consecutiveJsonFailures = 0;
let circuitOpenedAt: number | null = null;

export function isCircuitOpen(): boolean {
  if (circuitOpenedAt === null) return false;
  if (Date.now() - circuitOpenedAt >= COOLDOWN_MS) {
    circuitOpenedAt = null;
    consecutiveJsonFailures = 0;
    return false;
  }
  return true;
}

function recordJsonFailure(): void {
  consecutiveJsonFailures += 1;
  if (consecutiveJsonFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
    circuitOpenedAt = Date.now();
    console.warn(
      `[LLM] Circuit breaker opened after ${CONSECUTIVE_FAILURE_THRESHOLD} JSON failures. Cooldown ${COOLDOWN_MS}ms.`
    );
  }
}

function recordJsonSuccess(): void {
  consecutiveJsonFailures = 0;
}

function isJsonParseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /JSON|parse|No JSON/i.test(msg);
}

/**
 * Wraps an LLM client with circuit breaker and hard timeout.
 */
export function withCircuitBreaker(client: LLMClient): LLMClient {
  return {
    async generateJSON<T>(input: Parameters<LLMClient["generateJSON"]>[0]): Promise<T> {
      if (isCircuitOpen()) {
        return { reply_text: REFUSAL_REPLY } as T;
      }

      try {
        const result = await withTimeout(
          client.generateJSON<T>(input),
          LLM_TIMEOUT_MS,
          "LLM.generateJSON"
        );
        recordJsonSuccess();
        return result;
      } catch (error) {
        if (isJsonParseError(error)) {
          recordJsonFailure();
        }
        throw error;
      }
    },
  };
}
