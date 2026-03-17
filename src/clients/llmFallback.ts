import type { LLMClient } from "./llmClient.js";
import { isRetryableLLMError } from "./llmErrors.js";

export function withProviderFallback(primary: LLMClient, secondary?: LLMClient): LLMClient {
  if (!secondary) return primary;

  return {
    async generateJSON<T>(input: Parameters<LLMClient["generateJSON"]>[0]): Promise<T> {
      try {
        return await primary.generateJSON<T>(input);
      } catch (error) {
        if (!isRetryableLLMError(error)) {
          throw error;
        }
        return secondary.generateJSON<T>(input);
      }
    },
  };
}
