export interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: SerializedError | string;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string | number; cause?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: withCode.code,
      cause: withCode.cause
        ? withCode.cause instanceof Error
          ? serializeError(withCode.cause)
          : String(withCode.cause)
        : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : "NonErrorObject",
      message: typeof obj.message === "string" ? obj.message : JSON.stringify(obj),
      stack: typeof obj.stack === "string" ? obj.stack : undefined,
      code: typeof obj.code === "string" || typeof obj.code === "number" ? obj.code : undefined,
      cause: obj.cause ? String(obj.cause) : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}
