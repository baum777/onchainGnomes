import { describe, it, expect, vi } from "vitest";
import { withProviderFallback } from "../../src/clients/llmFallback.js";
import { createLLMError } from "../../src/clients/llmErrors.js";
import type { LLMClient } from "../../src/clients/llmClient.js";

describe("withProviderFallback", () => {
  it("uses fallback on retryable errors", async () => {
    const primary: LLMClient = {
      generateJSON: vi.fn().mockRejectedValue(
        createLLMError({
          provider: "openai",
          kind: "transient",
          message: "temporary failure",
        })
      ),
    };

    const secondary: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue({ reply: "ok" }),
    };

    const client = withProviderFallback(primary, secondary);
    await expect(client.generateJSON({ system: "s", developer: "d", user: "u" })).resolves.toEqual({ reply: "ok" });
  });

  it("does not use fallback on auth errors", async () => {
    const authErr = createLLMError({ provider: "openai", kind: "auth", message: "bad key" });
    const primary: LLMClient = { generateJSON: vi.fn().mockRejectedValue(authErr) };
    const secondary: LLMClient = { generateJSON: vi.fn().mockResolvedValue({ reply: "no" }) };

    const client = withProviderFallback(primary, secondary);
    await expect(client.generateJSON({ system: "s", developer: "d", user: "u" })).rejects.toBe(authErr);
    expect(secondary.generateJSON).not.toHaveBeenCalled();
  });
});
