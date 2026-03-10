/**
 * LLM Client interface — Abstraction for JSON-capable LLM calls
 */

export interface LLMClient {
  generateJSON<T>(input: {
    system: string;
    developer: string;
    user: string;
    schemaHint?: string;
    /** Override temperature (xAI). Default 0.7; use 0.9 for refine/aggressive replies. */
    temperature?: number;
    /** Override max_tokens (xAI). Default 350; use 400 for refine pass. */
    max_tokens?: number;
  }): Promise<T>;
}
