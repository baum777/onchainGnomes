/**
 * Continuity Resolver — Preserve gnome continuity within threads
 *
 * When GNOMES_ENABLED and GNOME_CONTINUITY_ENABLED are true, prefers to keep
 * the same gnome within a conversation thread to avoid persona flipping.
 * Overrides when thread tone strongly shifts.
 */

export interface ContinuityContext {
  threadId: string;
  priorGnomeId?: string;
  priorResponseMode?: string;
  messageCountInThread?: number;
}

export interface ContinuityResult {
  /** Gnome ID to use (may override selector when continuity applies) */
  gnomeId: string;
  /** Whether continuity was applied */
  applied: boolean;
  /** Reason for decision */
  reason: string;
}

/**
 * Resolve gnome continuity. If we have a prior gnome in this thread and
 * we're early in the conversation, prefer to keep the same gnome.
 * Phase-1: Simple pass-through; Phase-2 will add thread lookup.
 */
export function resolveContinuity(
  selectedGnomeId: string,
  context: ContinuityContext,
  opts?: { continuityEnabled?: boolean },
): ContinuityResult {
  const enabled = opts?.continuityEnabled ?? false;

  if (!enabled || !context.priorGnomeId) {
    return {
      gnomeId: selectedGnomeId,
      applied: false,
      reason: enabled ? "no_prior_gnome" : "continuity_disabled",
    };
  }

  const msgCount = context.messageCountInThread ?? 0;
  if (msgCount > 5) {
    return {
      gnomeId: selectedGnomeId,
      applied: false,
      reason: "thread_long_enough_to_switch",
    };
  }

  return {
    gnomeId: context.priorGnomeId,
    applied: true,
    reason: "continuity_preserved",
  };
}
