/**
 * withTimeout Utility
 *
 * Wraps a promise with a timeout. Clean, minimal, works with Node 20.
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation"
): Promise<T> {
  let t: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (t) clearTimeout(t);
  }
}
