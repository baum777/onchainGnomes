import OpenAI from "openai";
import type { LLMClient } from "./llmClient.js";

const provider =
  (process.env.LLM_PROVIDER as "xai" | "openai" | "anthropic" | undefined) ??
  (process.env.XAI_API_KEY ? "xai" : "openai");

const apiKey =
  provider === "xai"
    ? process.env.XAI_API_KEY
    : provider === "openai"
    ? process.env.OPENAI_API_KEY
    : process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.XAI_API_KEY;

if (!apiKey) {
  // We keep this non-throwing so that tests which don't hit the LLM path can still run.
  // The launch env validator will already enforce presence of a key in real runs.
  console.warn("[LLM] No API key found for provider", provider);
}

const baseURL =
  provider === "xai"
    ? process.env.XAI_BASE_URL ?? "https://api.x.ai/v1"
    : process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export const currentModel =
  provider === "xai"
    ? process.env.XAI_MODEL_PRIMARY || "grok-3"
    : process.env.OPENAI_MODEL || "gpt-4o-mini";

const LLM_TEMPERATURE =
  process.env.LLM_TEMPERATURE !== undefined
    ? Number.parseFloat(process.env.LLM_TEMPERATURE)
    : undefined;

const LLM_MAX_TOKENS =
  process.env.LLM_MAX_TOKENS !== undefined
    ? Number.parseInt(process.env.LLM_MAX_TOKENS, 10)
    : undefined;

const LLM_SYSTEM_PROMPT = process.env.LLM_SYSTEM_PROMPT;

const CANNED_FALLBACK =
  process.env.LLM_CANNED_FALLBACK ||
  "Sorry, gerade keine Antwort möglich 😅";

const client =
  apiKey &&
  new OpenAI({
    apiKey,
    baseURL,
  });

export async function generateResponse(prompt: string): Promise<string> {
  if (!client) {
    console.error("[LLM] generateResponse called without configured client.");
    return CANNED_FALLBACK;
  }

  try {
    const res = await client.chat.completions.create({
      model: currentModel,
      messages: [
        ...(LLM_SYSTEM_PROMPT
          ? [{ role: "system" as const, content: LLM_SYSTEM_PROMPT }]
          : []),
        { role: "user" as const, content: prompt },
      ],
      temperature: LLM_TEMPERATURE ?? 0.92,
      max_tokens: LLM_MAX_TOKENS ?? 280,
    });

    return res.choices[0]?.message?.content?.trim() || CANNED_FALLBACK;
  } catch (e) {
    console.error("[LLM] generateResponse failed:", e);
    return CANNED_FALLBACK;
  }
}

/**
 * LLMClient-Implementierung auf Basis des OpenAI-kompatiblen Clients.
 * Nutzt dieselbe Instanz wie generateResponse, respektiert ENV-Overrides
 * für Temperatur, Max Tokens und optionalen System-Prompt.
 */
export function createUnifiedLLMClient(): LLMClient {
  if (!client) {
    console.warn("[LLM] createUnifiedLLMClient without configured client, falling back to canned replies.");
  }

  return {
    async generateJSON<T>(input: Parameters<LLMClient["generateJSON"]>[0]): Promise<T> {
      if (!client) {
        return {
          reply_text: CANNED_FALLBACK,
          style_label: "degraded",
        } as unknown as T;
      }

      const systemParts: string[] = [];
      if (LLM_SYSTEM_PROMPT) {
        systemParts.push(LLM_SYSTEM_PROMPT);
      }
      if (input.system) {
        systemParts.push(input.system);
      }
      if (input.developer) {
        systemParts.push(input.developer);
      }

      const system = systemParts.join("\n\n");

      try {
        const res = await client.chat.completions.create({
          model: currentModel,
          messages: [
            { role: "system", content: system },
            { role: "user", content: input.user },
          ],
          temperature: input.temperature ?? LLM_TEMPERATURE ?? 0.7,
          max_tokens: input.max_tokens ?? LLM_MAX_TOKENS ?? 350,
        });

        const content = res.choices[0]?.message?.content ?? "";
        // Wir delegieren die eigentliche JSON-Extraktion an den Aufrufer,
        // der bereits auf strukturierte Antworten trimmt, oder nutzen einen
        // einfachen JSON.parse-Fallback.
        try {
          return JSON.parse(content) as T;
        } catch {
          // Wenn kein valides JSON zurückkommt, geben wir eine einfache
          // Hülle mit reply_text zurück, um den Bot nicht abstürzen zu lassen.
          return {
            reply_text: typeof content === "string" && content.trim()
              ? content.trim()
              : CANNED_FALLBACK,
          } as unknown as T;
        }
      } catch (error) {
        console.error("[LLM] unified generateJSON failed:", error);
        return {
          reply_text: CANNED_FALLBACK,
          style_label: "degraded",
        } as unknown as T;
      }
    },
  };
}

