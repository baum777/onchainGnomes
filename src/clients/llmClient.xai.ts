/**
 * xAI (Grok) LLM adapter — Calls xAI API via fetch
 * Includes automatic model fallback for permission/rate-limit errors
 */

import type { LLMClient } from "./llmClient.js";

const XAI_API = "https://api.x.ai/v1";

function extractJSON<T>(text: string): T {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start)
    throw new Error("No JSON object in response");
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

function isPermissionError(err: any): boolean {
  return err?.message?.includes("permission") || err?.status === 403 || err?.statusCode === 403;
}

function isRetryableError(err: any): boolean {
  return err?.status === 429 || err?.status >= 500 || err?.statusCode === 429 || err?.statusCode >= 500;
}

function getModelPriority(): string[] {
  const userModel = process.env.XAI_MODEL;
  const forceGrok4 = process.env.XAI_FORCE === "true";

  const priority: string[] = [];

  if (userModel && userModel !== "grok-4") {
    priority.push(userModel);
  } else if (userModel === "grok-4" && forceGrok4) {
    priority.push("grok-4");
  }

  if (!priority.includes("grok-3")) {
    priority.push("grok-3");
  }
  if (!priority.includes("grok-3-mini")) {
    priority.push("grok-3-mini");
  }

  return priority;
}

async function tryGenerateJSON<T>(
  apiKey: string,
  model: string,
  input: { system?: string; developer?: string; user: string }
): Promise<{ success: boolean; result?: T; error?: any }> {
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
        max_tokens: 350,
        temperature: 0.7,
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
    async generateJSON<T>(input) {
      const models = overrideModel ? [overrideModel] : getModelPriority();
      let lastError: any;

      for (const model of models) {
        const attempt = await tryGenerateJSON<T>(apiKey, model, input);

        if (attempt.success && attempt.result !== undefined) {
          return attempt.result;
        }

        lastError = attempt.error;

        if (isPermissionError(lastError) || isRetryableError(lastError)) {
          console.warn(`[xAI] Model ${model} failed (${lastError.status || "unknown"}), trying fallback...`);
          continue;
        }

        throw new Error(lastError?.message || `Unknown error with model ${model}`);
      }

      throw new Error(
        lastError?.message || `All models failed. Tried: ${models.join(", ")}`
      );
    },
  };
}
