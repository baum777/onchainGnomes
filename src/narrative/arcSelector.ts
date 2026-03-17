/**
 * Narrative Arc Selector — Choose relevant arc for context
 *
 * Phase-4: Maps interaction context to active arcs.
 */

import type { NarrativeArc } from "./arcStateStore.js";
import type { ClassifierOutput } from "../canonical/types.js";

/** Map intent/topic to likely arc type. */
export function selectRelevantArc(
  arcs: NarrativeArc[],
  cls: ClassifierOutput,
  _topic?: string,
): NarrativeArc | null {
  if (!arcs.length) return null;
  const intent = cls.intent;
  let found: NarrativeArc | undefined;
  if (["hype_claim", "performance_claim", "launch_announcement"].includes(intent))
    found = arcs.find((a) => a.arc_type === "market_funeral" || a.arc_type === "degen_celebration");
  else if (intent === "accusation" || intent === "bait")
    found = arcs.find((a) => a.arc_type === "fake_builder_exposed" || a.arc_type === "copium_intervention");
  else
    found = arcs[0];
  return (found ?? arcs[0]) ?? null;
}
