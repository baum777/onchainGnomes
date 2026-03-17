/**
 * xAI (Grok) LLM adapter — Calls xAI API via fetch
 * Model allowlist, TTL-based fallback on 403, soft-degrade when all models fail
 */

import type { LLMClient } from "./llmClient.js";
import { safeExtractJSON } from "./llmJson.js";

type LLMInput = {
  system?: string;
  developer?: string;
  user: string;
  schemaHint?: string;
  temperature?: number;
  max_tokens?: number;
};

const XAI_API = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
const MODEL_UNAVAILABLE_TTL_MS = 15 * 60 * 1000; // 15 min
const CANNED_REPLY =
  "Chart observation in progress. My circuits are recalibrating — try again in a moment.";

/** Models that returned 403; skip until TTL expires */
const unavailableUntil = new Map<string, number>();


export { safeExtractJSON };

function extractJSON<T>(text: string): T {
  return safeExtractJSON<T>(text);
}

function isPermissionError(err: unknown): boolean {
  const e = err as { message?: string; status?: number; statusCode?: number };
  return (
    !!e?.message?.includes("permission") ||
    e?.status === 403 ||
    e?.statusCode === 403
  );
}

function isRetryableError(err: unknown): boolean {
  const e = err as { status?: number; statusCode?: number };
  const s = e?.status ?? e?.statusCode ?? 0;
  return s === 429 || s >= 500;
}

function markUnavailable(model: string): void {
  unavailableUntil.set(model, Date.now() + MODEL_UNAVAILABLE_TTL_MS);
}

function isAvailable(model: string): boolean {
  const until = unavailableUntil.get(model);
  if (!until) return true;
  if (Date.now() >= until) {
    unavailableUntil.delete(model);
    return true;
  }
  return false;
}

function getModelPriority(): string[] {
  const primary = process.env.XAI_MODEL_PRIMARY ?? process.env.XAI_MODEL ?? "";
  const fallbacksRaw = process.env.XAI_MODEL_FALLBACKS ?? "";
  const fallbacks = fallbacksRaw
    ? fallbacksRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["grok-3", "grok-3-mini"];

  const priority: string[] = [];
  if (primary && !priority.includes(primary)) priority.push(primary);
  for (const m of fallbacks) {
    if (m && !priority.includes(m)) priority.push(m);
  }
  if (priority.length === 0) {
    priority.push("grok-3", "grok-3-mini");
  }
  return priority;
}

async function tryGenerateJSON<T>(
  apiKey: string,
  model: string,
  input: LLMInput
): Promise<{ success: boolean; result?: T; error?: unknown }> {
  try {
    const system = [input.system, input.developer].filter(Boolean).join("\n\n");
    const resp = await fetch(`${XAI_API}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input.user },
        ],
        max_tokens: input.max_tokens ?? 350,
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      const error = {
        message: `xAI API error ${resp.status}: ${errText.slice(0, 200)}`,
        status: resp.status,
        statusCode: resp.status,
      };
      return { success: false, error };
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const result = extractJSON<T>(content);
    return { success: true, result };
  } catch (error) {
    return { success: false, error };
  }
}

export function createXAILLMClient(opts?: {
  apiKey?: string;
  model?: string;
}): LLMClient {
  const apiKey = opts?.apiKey ?? process.env.XAI_API_KEY ?? "";
  const overrideModel = opts?.model;

  return {
    async generateJSON<T>(input: LLMInput & { temperature?: number; max_tokens?: number }): Promise<T> {
      const allModels = overrideModel ? [overrideModel] : getModelPriority();
      const models = allModels.filter(isAvailable);
      let lastError: unknown;

      for (const model of models) {
        const attempt = await tryGenerateJSON<T>(apiKey, model, input);

        if (attempt.success && attempt.result !== undefined) {
          return attempt.result;
        }

        lastError = attempt.error;

        if (isPermissionError(lastError)) {
          markUnavailable(model);
          console.warn(
            `[xAI] Model ${model} 403/permission; marked unavailable for ${MODEL_UNAVAILABLE_TTL_MS / 60000}min, trying fallback...`
          );
          continue;
        }
        if (isRetryableError(lastError)) {
          console.warn(
            `[xAI] Model ${model} failed (rate limit/server), trying fallback...`
          );
          continue;
        }

        throw new Error(
          (lastError as Error)?.message ?? `Unknown error with model ${model}`
        );
      }

      // All models failed — soft-degrade: return safe canned reply
      console.warn(
        `[xAI] All models failed. Last: ${(lastError as Error)?.message ?? "unknown"}. Returning canned reply.`
      );
      return {
        reply_text: CANNED_REPLY,
        style_label: "degraded",
      } as T;
    },
  };
}
