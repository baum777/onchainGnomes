import type { LLMClient, LLMRequest } from "../llmClient.js";
import { classifyHttpError, createLLMError } from "../llmErrors.js";
import { safeExtractJSON } from "../llmJson.js";

const CANNED_FALLBACK =
  process.env.LLM_CANNED_FALLBACK ||
  "Sorry, gerade keine Antwort möglich 😅";

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
}

export function createAnthropicLLMClient(params: {
  apiKey: string;
  model: string;
  baseURL: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}): LLMClient {
  return {
    async generateJSON<T>(input: LLMRequest): Promise<T> {
      try {
        const resp = await fetch(`${params.baseURL}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": params.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: params.model,
            max_tokens: input.max_tokens ?? params.defaultMaxTokens ?? 350,
            temperature: input.temperature ?? params.defaultTemperature ?? 0.7,
            system: [input.system, input.developer].filter(Boolean).join("\n\n"),
            messages: [{ role: "user", content: input.user }],
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          throw classifyHttpError(
            "anthropic",
            resp.status,
            `Anthropic API error ${resp.status}: ${body.slice(0, 200)}`,
          );
        }

        const data = (await resp.json()) as AnthropicResponse;
        const content = data.content
          ?.filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text)
          .join("\n") ?? "";

        try {
          return safeExtractJSON<T>(content);
        } catch {
          return {
            reply_text: content.trim() || CANNED_FALLBACK,
            style_label: "degraded",
          } as T;
        }
      } catch (error) {
        if ((error as { name?: string }).name === "LLMError") {
          throw error;
        }
        throw createLLMError({
          message: "Anthropic request failed",
          provider: "anthropic",
          kind: "transient",
          cause: error,
        });
      }
    },
  };
}
