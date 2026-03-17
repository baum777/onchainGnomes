import { getGnome } from "./registry.js";
import type { GnomeProfile, GnomeSigil } from "./types.js";

const GLOBAL_FALLBACK_SIGIL = "[GNOME]";

function isUsableChar(char: string | undefined): char is string {
  return typeof char === "string" && char.trim().length > 0;
}

export function resolveSigil(profileOrId: GnomeProfile | string | undefined): GnomeSigil {
  const profile = typeof profileOrId === "string" ? getGnome(profileOrId) : profileOrId;
  const fallback = profile?.sigil?.fallback?.trim() || GLOBAL_FALLBACK_SIGIL;
  return {
    char: isUsableChar(profile?.sigil?.char) ? profile!.sigil.char.trim() : fallback,
    code: profile?.sigil?.code?.trim() || "fallback",
    fallback,
  };
}

export function getSigilForGnome(id: string): string {
  return resolveSigil(id).char;
}

export function getFallbackSigil(id: string): string {
  return resolveSigil(id).fallback;
}
