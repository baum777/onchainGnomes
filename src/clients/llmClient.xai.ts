/**
 * xAI (Grok) LLM adapter — Calls xAI API via fetch
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

export function createXAILLMClient(opts?: {
  apiKey?: string;
  model?: string;
}): LLMClient {
  const apiKey = opts?.apiKey ?? process.env.XAI_API_KEY ?? "";
  const model = opts?.model ?? process.env.XAI_MODEL ?? "grok-2";

  return {
    async generateJSON<T>(input) {
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
        const err = await resp.text();
        throw new Error(`xAI API error ${resp.status}: ${err.slice(0, 200)}`);
      }
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      return extractJSON<T>(content);
    },
  };
}
