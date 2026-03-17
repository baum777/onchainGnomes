/**
 * Interaction Writeback — Persist routing + interaction results
 *
 * Stores: selected gnome, user, intent, reply mode, reply text, safety, timestamp.
 * Fire-and-forget: never block publish. Phase-1: in-memory log; Phase-2: DB.
 */

import { getUserAffinityStore } from "../userAffinityStore.js";

export interface InteractionWritebackParams {
  event_id: string;
  user_id: string;
  user_handle: string;
  thread_id?: string;
  selected_gnome_id: string;
  response_mode: string;
  intent: string;
  topic?: string;
  reply_text: string;
  safety_passed: boolean;
  published: boolean;
}

/** Write interaction result. Non-blocking, fire-and-forget. */
export async function writeInteractionWriteback(
  params: InteractionWritebackParams,
): Promise<void> {
  try {
    const store = getUserAffinityStore();
    await store.recordInteraction(params.user_id, params.selected_gnome_id, {
      incrementFamiliarity: params.safety_passed && params.published,
    });
    // Phase-1: affinity update only. Phase-2 will add routing_decisions, interaction_events, reply_outcomes.
  } catch {
    // Never propagate; writeback is best-effort
  }
}
