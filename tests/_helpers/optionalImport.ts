/**
 * Lets tests use real modules if they exist, otherwise fall back to mocks.
 */
export async function optionalImport<T = unknown>(path: string): Promise<T | null> {
  try {
     
    const mod = (await import(path)) as T;
    return mod;
  } catch {
    return null;
  }
}
