import { describe, it, expect, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadResolver() {
  return import("../../src/clients/llmProviderResolver.js");
}

describe("LLM provider resolver", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("selects xai provider from env", async () => {
    process.env.LLM_PROVIDER = "xai";
    const { resolveLLMRuntimeConfigFromEnv } = await loadResolver();
    expect(resolveLLMRuntimeConfigFromEnv().provider).toBe("xai");
  });

  it("selects openai provider from env", async () => {
    process.env.LLM_PROVIDER = "openai";
    const { resolveLLMRuntimeConfigFromEnv } = await loadResolver();
    expect(resolveLLMRuntimeConfigFromEnv().provider).toBe("openai");
  });

  it("reads fallback provider from env", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_FALLBACK_PROVIDER = "anthropic";
    const { resolveLLMRuntimeConfigFromEnv } = await loadResolver();
    expect(resolveLLMRuntimeConfigFromEnv().fallbackProvider).toBe("anthropic");
  });
});
