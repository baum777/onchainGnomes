/**
 * Lore Activation Policy — When lore may influence prompts
 *
 * Phase-5: Only active lore influences runtime.
 */

export type LoreStatus = "candidate" | "reviewed" | "approved" | "active" | "archived" | "rejected";

/** Only active lore may influence prompts. */
export function mayInfluencePrompts(status: LoreStatus): boolean {
  return status === "active";
}
