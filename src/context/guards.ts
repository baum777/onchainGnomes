import type { ContextBundle } from "./types.js";

export interface GuardResult {
  ok: boolean;
  reason?: string;
  public_label?: string;
}

export function preLLMGuards(bundle: ContextBundle): GuardResult {
  const text = bundle.mention.text ?? "";
  if (!text.trim()) return { ok: false, reason: "empty_mention", public_label: "no-content" };

  const hasPII = /\b\d{3,}\b/.test(text) && /address|phone|email/i.test(text);
  if (hasPII) return { ok: false, reason: "pii_detected", public_label: "nope" };

  return { ok: true };
}

export function postLLMGuards(replyText: string): GuardResult {
  const t = replyText.trim();
  if (!t) return { ok: false, reason: "empty_reply" };
  if (t.length > 280) return { ok: false, reason: "reply_too_long" };
  const slurs = /\b(nigg|fagg|retard)\b/i;
  if (slurs.test(t)) return { ok: false, reason: "identity_slur" };
  return { ok: true };
}
