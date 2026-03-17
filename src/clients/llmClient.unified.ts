import type { LLMClient } from "./llmClient.js";
import { createLLMClientFromEnv, resolveLLMRuntimeConfigFromEnv } from "./llmProviderResolver.js";

const CANNED_FALLBACK =
  process.env.LLM_CANNED_FALLBACK ||
  "Sorry, gerade keine Antwort möglich 😅";

const runtimeConfig = resolveLLMRuntimeConfigFromEnv();

export const currentModel =
  runtimeConfig.provider === "xai"
    ? process.env.XAI_MODEL_PRIMARY || "grok-3"
    : runtimeConfig.provider === "openai"
    ? process.env.OPENAI_MODEL || "gpt-4o-mini"
    : process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

/**
 * Compatibility helper for places that expect a plain text generation API.
 */
export async function generateResponse(prompt: string): Promise<string> {
  try {
    const client = createLLMClientFromEnv();
    const res = await client.generateJSON<{ reply?: string; reply_text?: string }>({
      system: "You are a concise assistant.",
      developer: "Return JSON: { \"reply\": \"string\" }",
      user: prompt,
      schemaHint: '{ "reply": "string" }',
    });
    return (res.reply ?? res.reply_text ?? CANNED_FALLBACK).trim();
  } catch (e) {
    console.error("[LLM] generateResponse failed:", e);
    return CANNED_FALLBACK;
  }
}

export function createUnifiedLLMClient(): LLMClient {
  return createLLMClientFromEnv();
}
