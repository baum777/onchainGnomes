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
  }): Promise<T>;
}
