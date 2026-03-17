/**
 * Routing Writeback — Persist routing_decisions, interaction_events, reply_outcomes
 *
 * Phase-2: Appends to JSONL files in DATA_DIR. Fire-and-forget.
 * Structured for future SQL backfill if migration 004 tables are activated.
 */

import { appendFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "../../config/dataDir.js";

const ROUTING_FILE = "gnomes_routing.jsonl";

export interface RoutingDecisionRecord {
  type: "routing_decision";
  event_id: string;
  user_id?: string;
  user_handle?: string;
  selected_gnome_id: string;
  alternative_candidates: Array<{ gnomeId: string; score: number }>;
  response_mode: string;
  reasoning: string[];
  created_at: string;
}

export interface InteractionEventRecord {
  type: "interaction_event";
  event_id: string;
  user_id?: string;
  user_handle?: string;
  gnome_id?: string;
  intent?: string;
  topic?: string;
  created_at: string;
}

export interface ReplyOutcomeRecord {
  type: "reply_outcome";
  event_id: string;
  reply_text?: string;
  safety_passed: boolean;
  published: boolean;
  created_at: string;
}

function ts(): string {
  return new Date().toISOString();
}

async function appendLine(record: object): Promise<void> {
  try {
    await access(DATA_DIR).catch(async () => {
      await mkdir(DATA_DIR, { recursive: true });
    });
    const path = join(DATA_DIR, ROUTING_FILE);
    const line = JSON.stringify(record) + "\n";
    await appendFile(path, line, "utf-8");
  } catch {
    // Fire-and-forget; never propagate
  }
}

/** Persist routing decision (call after gnome selection, before generation). */
export function writeRoutingDecision(params: {
  event_id: string;
  user_id?: string;
  user_handle?: string;
  selected_gnome_id: string;
  alternative_candidates: Array<{ gnomeId: string; score: number }>;
  response_mode: string;
  reasoning: string[];
}): void {
  const record: RoutingDecisionRecord = {
    type: "routing_decision",
    event_id: params.event_id,
    user_id: params.user_id,
    user_handle: params.user_handle,
    selected_gnome_id: params.selected_gnome_id,
    alternative_candidates: params.alternative_candidates,
    response_mode: params.response_mode,
    reasoning: params.reasoning,
    created_at: ts(),
  };
  appendLine(record).catch(() => {});
}

/** Persist interaction event (call with event context). */
export function writeInteractionEvent(params: {
  event_id: string;
  user_id?: string;
  user_handle?: string;
  gnome_id?: string;
  intent?: string;
  topic?: string;
}): void {
  const record: InteractionEventRecord = {
    type: "interaction_event",
    event_id: params.event_id,
    user_id: params.user_id,
    user_handle: params.user_handle,
    gnome_id: params.gnome_id,
    intent: params.intent,
    topic: params.topic,
    created_at: ts(),
  };
  appendLine(record).catch(() => {});
}

/** Persist reply outcome (call after publish decision). */
export function writeReplyOutcome(params: {
  event_id: string;
  reply_text?: string;
  safety_passed: boolean;
  published: boolean;
}): void {
  const record: ReplyOutcomeRecord = {
    type: "reply_outcome",
    event_id: params.event_id,
    reply_text: params.reply_text,
    safety_passed: params.safety_passed,
    published: params.published,
    created_at: ts(),
  };
  appendLine(record).catch(() => {});
}
