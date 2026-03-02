export function pickTopQueryKeywords(keywords: string[], max: number): string[] {
  const tickers = keywords.filter((k) => k.startsWith("$"));
  const hashtags = keywords.filter((k) => !k.startsWith("$") && k.length <= 20);
  const rest = keywords.filter((k) => !tickers.includes(k) && !hashtags.includes(k));

  return [...tickers, ...hashtags, ...rest].slice(0, max);
}
