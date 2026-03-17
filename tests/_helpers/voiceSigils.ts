export function stripVoiceSigils(text: string): string {
  return text
    .replace(/\n\n--voice-sigils--\n/g, "")
    .replace(/^\S+\s+/, "")
    .replace(/\s+\S+$/s, "")
    .trim();
}

export function hasVoiceSigilMarker(text: string): boolean {
  return text.includes("--voice-sigils--");
}
