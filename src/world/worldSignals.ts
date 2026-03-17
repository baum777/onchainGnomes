/**
 * World Signals — Collect signals for world-state updates
 *
 * Phase-5: Market patterns, narrative prevalence, energy.
 */

export interface WorldSignals {
  marketEnergy: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  dominantIntent?: string;
  narrativePrevalence?: Record<string, number>;
  globalHeatLevel: number;
  timestamp: string;
}

/** Collect world signals from interaction context (stub). */
export function collectWorldSignals(_ctx: {
  energyLevel?: string;
  intent?: string;
  narrativeCounts?: Record<string, number>;
}): WorldSignals {
  return {
    marketEnergy: (_ctx.energyLevel as WorldSignals["marketEnergy"]) ?? "MEDIUM",
    dominantIntent: _ctx.intent,
    narrativePrevalence: _ctx.narrativeCounts,
    globalHeatLevel: 0.5,
    timestamp: new Date().toISOString(),
  };
}
