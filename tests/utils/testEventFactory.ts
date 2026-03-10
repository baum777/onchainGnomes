import type { CanonicalEvent } from "../../src/canonical/types.js";

export interface SimulationOptions {
  parent_text?: string | null;
  quoted_text?: string | null;
  conversation_context?: string[];
  /** Full-Spectrum-Thread-Beschreibung */
  context?: string;
  thesis?: string;
  relevance_score?: number;
  sentiment_intensity?: number;
  is_simulated?: boolean;
}

const BOT_HANDLE = (process.env.BOT_USERNAME ?? "gorkypf").replace(/^@/, "");
const MENTION_PREFIX = `@${BOT_HANDLE}`;
const MENTION_PREFIX_REGEX = new RegExp(`^@${BOT_HANDLE}\\s+`, "i");

function ensureMentionPrefix(text: string): string {
  const trimmed = text.trim();
  if (MENTION_PREFIX_REGEX.test(trimmed)) return trimmed;
  return `${MENTION_PREFIX} ${trimmed}`;
}

function extractCashtags(text: string): string[] {
  const matches = text.match(/\$([A-Za-z0-9]{1,15})\b/g);
  return matches ? [...new Set(matches.map((m) => m.slice(1).toUpperCase()))] : [];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g);
  return matches ? [...new Set(matches.map((m) => m.slice(1)))] : [];
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+/g);
  return matches ?? [];
}

/**
 * Erstellt ein simuliertes CanonicalEvent für Tests und Konversations-Simulationen.
 * Unterstützt parent_text, conversation_context und alle optionalen Full-Spectrum-Felder.
 */
export function createSimulatedCanonicalEvent(
  userInput: string,
  authorHandle: string = "@testuser",
  options: SimulationOptions = {},
): CanonicalEvent {
  const text = ensureMentionPrefix(userInput);
  const hasParent = !!options.parent_text;

  return {
    event_id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    platform: "twitter",
    trigger_type: hasParent ? "reply" : "mention",
    author_handle: authorHandle.startsWith("@") ? authorHandle : `@${authorHandle}`,
    author_id: "sim-author-123456789",
    text,
    parent_text: options.parent_text ?? null,
    quoted_text: options.quoted_text ?? null,
    conversation_context: options.conversation_context ?? [],
    cashtags: extractCashtags(text),
    hashtags: extractHashtags(text),
    urls: extractUrls(text),
    timestamp: new Date().toISOString(),
    context: options.context,
    thesis: options.thesis,
    relevance_score: options.relevance_score,
    sentiment_intensity: options.sentiment_intensity,
    is_simulated: options.is_simulated ?? true,
  };
}
