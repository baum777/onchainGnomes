/**
 * LLM Client interface — Abstraction for JSON-capable LLM calls
 */

export interface LLMClient {
  generateJSON<T>(input: {
    system: string;
    developer: string;
    user: string;
    schemaHint?: string;
  }): Promise<T>;
}
