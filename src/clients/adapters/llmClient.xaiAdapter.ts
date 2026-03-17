import type { LLMClient } from "../llmClient.js";
import { createXAILLMClient } from "../llmClient.xai.js";

export function createXAIAdapterClient(params: { apiKey: string; model?: string }): LLMClient {
  return createXAILLMClient({ apiKey: params.apiKey, model: params.model });
}
