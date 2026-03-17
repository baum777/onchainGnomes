import type { LLMError, LLMErrorKind, LLMProvider } from "./llmClient.js";

export function createLLMError(params: {
  message: string;
  provider: LLMProvider;
  kind: LLMErrorKind;
  statusCode?: number;
  cause?: unknown;
}): LLMError {
  const err = new Error(params.message) as LLMError;
  err.name = "LLMError";
  err.provider = params.provider;
  err.kind = params.kind;
  err.statusCode = params.statusCode;
  err.retryable = params.kind === "transient" || params.kind === "rate_limit";
  (err as Error & { cause?: unknown }).cause = params.cause;
  return err;
}

export function classifyHttpError(provider: LLMProvider, statusCode: number, message: string): LLMError {
  if (statusCode === 401 || statusCode === 403) {
    return createLLMError({ message, provider, kind: "auth", statusCode });
  }
  if (statusCode === 429) {
    return createLLMError({ message, provider, kind: "rate_limit", statusCode });
  }
  if (statusCode >= 500) {
    return createLLMError({ message, provider, kind: "transient", statusCode });
  }
  return createLLMError({ message, provider, kind: "unknown", statusCode });
}

export function isRetryableLLMError(err: unknown): boolean {
  const e = err as Partial<LLMError>;
  return Boolean(e?.retryable);
}
