export function safeExtractJSON<T>(raw: string): T {
  let text = raw
    .trim()
    .replace(/```json|```/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();

  const match = text.match(/(\{[\s\S]*?\}(?=\s*$|\s*[,}\]]))/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as T;
    } catch {
      // continue
    }
  }

  text = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  return JSON.parse(text) as T;
}
