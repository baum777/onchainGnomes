/**
 * Autonomy Signals — Triggers for autonomous multi-gnome behavior
 *
 * Phase-4: Detects when characters may respond beyond explicit routing.
 */

export interface AutonomySignals {
  extremeAbsurdity: boolean;
  viralThread: boolean;
  recurringUser: boolean;
  narrativeArcContinuation: boolean;
}

/** Collect autonomy signals from context (stub). */
export function collectAutonomySignals(_ctx: {
  absurdityScore?: number;
  threadLength?: number;
  userInteractionCount?: number;
  activeArcId?: string;
}): AutonomySignals {
  const absurdity = _ctx.absurdityScore ?? 0;
  const threadLen = _ctx.threadLength ?? 0;
  return {
    extremeAbsurdity: absurdity > 0.85,
    viralThread: threadLen > 5,
    recurringUser: (_ctx.userInteractionCount ?? 0) > 3,
    narrativeArcContinuation: !!_ctx.activeArcId,
  };
}
