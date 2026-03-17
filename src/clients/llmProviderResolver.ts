import type { LLMClient, LLMProvider } from "./llmClient.js";
import { createAnthropicLLMClient } from "./adapters/llmClient.anthropic.js";
import { createOpenAILLMClient } from "./adapters/llmClient.openai.js";
import { createXAIAdapterClient } from "./adapters/llmClient.xaiAdapter.js";
import { withProviderFallback } from "./llmFallback.js";

export interface LLMRuntimeConfig {
  provider: LLMProvider;
  fallbackProvider?: LLMProvider;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

function toNum(v: string | undefined, parser: (value: string) => number): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = parser(v);
  return Number.isFinite(n) ? n : undefined;
}

export function resolveLLMRuntimeConfigFromEnv(): LLMRuntimeConfig {
  const provider = ((process.env.LLM_PROVIDER as LLMProvider | undefined) ?? (process.env.XAI_API_KEY ? "xai" : "openai"));
  const fallbackProvider = process.env.LLM_FALLBACK_PROVIDER as LLMProvider | undefined;
  return {
    provider,
    fallbackProvider,
    defaultTemperature: toNum(process.env.LLM_TEMPERATURE, Number.parseFloat),
    defaultMaxTokens: toNum(process.env.LLM_MAX_TOKENS, (v) => Number.parseInt(v, 10)),
  };
}

function getProviderClient(provider: LLMProvider, defaults: Pick<LLMRuntimeConfig, "defaultMaxTokens" | "defaultTemperature">): LLMClient {
  if (provider === "xai") {
    return createXAIAdapterClient({
      apiKey: process.env.XAI_API_KEY ?? "",
      model: process.env.XAI_MODEL_PRIMARY || process.env.XAI_MODEL,
    });
  }

  if (provider === "openai") {
    return createOpenAILLMClient({
      apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      defaultTemperature: defaults.defaultTemperature,
      defaultMaxTokens: defaults.defaultMaxTokens,
    });
  }

  return createAnthropicLLMClient({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
    baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
    defaultTemperature: defaults.defaultTemperature,
    defaultMaxTokens: defaults.defaultMaxTokens,
  });
}

export function createLLMClientFromEnv(): LLMClient {
  const cfg = resolveLLMRuntimeConfigFromEnv();
  const primary = getProviderClient(cfg.provider, cfg);

  if (!cfg.fallbackProvider || cfg.fallbackProvider === cfg.provider) {
    return primary;
  }

  const secondary = getProviderClient(cfg.fallbackProvider, cfg);
  return withProviderFallback(primary, secondary);
}
