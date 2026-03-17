/**
 * LLM client contract (provider-agnostic port for business pipelines)
 */

export type LLMProvider = "xai" | "openai" | "anthropic";

export interface LLMRequest {
  system: string;
  developer: string;
  user: string;
  schemaHint?: string;
  /** Override temperature. */
  temperature?: number;
  /** Override max tokens. */
  max_tokens?: number;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LLMResponse<T> {
  data: T;
  provider: LLMProvider;
  model: string;
  usage?: LLMUsage;
}

export type LLMErrorKind =
  | "transient"
  | "auth"
  | "policy"
  | "rate_limit"
  | "invalid_response"
  | "unknown";

export interface LLMError extends Error {
  kind: LLMErrorKind;
  provider: LLMProvider;
  statusCode?: number;
  retryable: boolean;
}

export interface LLMClient {
  generateJSON<T>(input: LLMRequest): Promise<T>;
}
