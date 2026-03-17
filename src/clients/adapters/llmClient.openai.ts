import OpenAI from "openai";
import type { LLMClient, LLMRequest } from "../llmClient.js";
import { classifyHttpError, createLLMError } from "../llmErrors.js";
import { safeExtractJSON } from "../llmJson.js";

const CANNED_FALLBACK =
  process.env.LLM_CANNED_FALLBACK ||
  "Sorry, gerade keine Antwort möglich 😅";

export function createOpenAILLMClient(params: {
  apiKey: string;
  model: string;
  baseURL: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}): LLMClient {
  const client = new OpenAI({
    apiKey: params.apiKey,
    baseURL: params.baseURL,
  });

  return {
    async generateJSON<T>(input: LLMRequest): Promise<T> {
      try {
        const res = await client.chat.completions.create({
          model: params.model,
          messages: [
            { role: "system", content: [input.system, input.developer].filter(Boolean).join("\n\n") },
            { role: "user", content: input.user },
          ],
          temperature: input.temperature ?? params.defaultTemperature ?? 0.7,
          max_tokens: input.max_tokens ?? params.defaultMaxTokens ?? 350,
        });

        const content = res.choices[0]?.message?.content ?? "";
        try {
          return safeExtractJSON<T>(content);
        } catch {
          return {
            reply_text: content.trim() || CANNED_FALLBACK,
            style_label: "degraded",
          } as T;
        }
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "status" in error
          ? Number((error as { status?: number }).status)
          : 0;
        if (statusCode > 0) {
          throw classifyHttpError("openai", statusCode, `OpenAI API error ${statusCode}`);
        }
        throw createLLMError({
          message: "OpenAI request failed",
          provider: "openai",
          kind: "transient",
          cause: error,
        });
      }
    },
  };
}
