import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnthropicLLMClient } from "../../src/clients/adapters/llmClient.anthropic.js";

const originalFetch = global.fetch;

describe("Anthropic adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("normalizes JSON response content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '{"reply":"hello"}' }],
      }),
    } as Response);

    const client = createAnthropicLLMClient({
      apiKey: "key",
      model: "claude",
      baseURL: "https://api.anthropic.com/v1",
    });

    const result = await client.generateJSON<{ reply: string }>({
      system: "s",
      developer: "d",
      user: "u",
    });

    expect(result).toEqual({ reply: "hello" });
  });

  it("throws normalized auth error on 401", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    } as Response);

    const client = createAnthropicLLMClient({
      apiKey: "bad",
      model: "claude",
      baseURL: "https://api.anthropic.com/v1",
    });

    await expect(
      client.generateJSON({ system: "s", developer: "d", user: "u" })
    ).rejects.toMatchObject({ kind: "auth", provider: "anthropic" });
  });
});
