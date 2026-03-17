/**
 * World Event Effects — Apply event overlays to prompts
 *
 * Phase-5: Event-specific tone and motif fragments.
 */

export interface EventEffect {
  motifFragment?: string;
  toneHint?: string;
}

/** Get prompt overlay for event type. */
export function getEventEffect(eventType: string): EventEffect | null {
  const map: Record<string, EventEffect> = {
    chart_funeral_rite: { motifFragment: "chart funeral energy", toneHint: "mournful_mocking" },
    liquidity_festival: { motifFragment: "liquidity thirst", toneHint: "chaotic" },
  };
  return map[eventType] ?? null;
}
