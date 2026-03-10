/**
 * Creates a CanonicalEvent from terminal input for X mention simulation.
 * Used by the CLI bridge to simulate production mention events.
 * Auto-prefixes @gorkypf (or BOT_USERNAME) when missing.
 */

import type { CanonicalEvent } from "./types.js";

const BOT_HANDLE = (process.env.BOT_USERNAME ?? "gorkypf").replace(/^@/, "");
const MENTION_PREFIX = `@${BOT_HANDLE}`;
const MENTION_PREFIX_REGEX = new RegExp(`^@${BOT_HANDLE}\\s+`, "i");

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

/** Ensures text starts with @gorkypf (or BOT_USERNAME) to simulate a real mention. */
function ensureMentionPrefix(text: string): string {
  const trimmed = text.trim();
  if (MENTION_PREFIX_REGEX.test(trimmed)) {
    return trimmed;
  }
  return `${MENTION_PREFIX} ${trimmed}`;
}

let terminalMentionCounter = 0;

/**
 * Creates a deterministic simulated mention event from terminal input.
 * Compatible with the production CanonicalEvent contract.
 */
export function createSimulatedMention(userInput: string): CanonicalEvent {
  const trimmed = userInput.trim();
  if (!trimmed) {
    throw new Error("createSimulatedMention requires non-empty input");
  }

  terminalMentionCounter += 1;
  const id = `terminal-mention-${String(terminalMentionCounter).padStart(4, "0")}`;
  const text = ensureMentionPrefix(trimmed);
  const now = new Date().toISOString();

  return {
    event_id: id,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@terminal_user",
    author_id: "terminal-user-1",
    text,
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: extractCashtags(text),
    hashtags: extractHashtags(text),
    urls: extractUrls(text),
    timestamp: now,
  };
}

/** Reset counter for tests. */
export function resetSimulatedMentionCounter(): void {
  terminalMentionCounter = 0;
}
