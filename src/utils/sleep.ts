/**
 * Sleep utility
 *
 * Returns a Promise that resolves after the specified milliseconds.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
