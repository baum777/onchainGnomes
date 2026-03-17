/**
 * Ensemble Orchestrator — Decide single vs multi-gnome reply
 *
 * Phase-4: Uses interaction graph, energy, narrative arc.
 */

import { getEnsemblePolicy } from "./ensemblePolicy.js";
import { getCameoLikelihood } from "./characterInteractionGraph.js";

export interface OrchestrationInput {
  primaryGnomeId: string;
  conversationEnergy: number;
  absurdityScore: number;
  narrativeArc?: string;
  availableGnomes: string[];
  cameoCandidates?: string[];
}

export interface OrchestrationResult {
  primarySpeaker: string;
  cameoSpeakers: string[];
  narrativeArc?: string;
  responseMode: "single" | "swarm";
}

/** Decide if reply is single-gnome or swarm. */
export function orchestrate(input: OrchestrationInput): OrchestrationResult {
  const policy = getEnsemblePolicy();
  const useSwarm =
    input.conversationEnergy >= policy.minEnergyForSwarm &&
    (input.cameoCandidates?.length ?? 0) > 0 &&
    policy.maxCameos > 0;

  if (!useSwarm) {
    return {
      primarySpeaker: input.primaryGnomeId,
      cameoSpeakers: [],
      narrativeArc: input.narrativeArc,
      responseMode: "single",
    };
  }

  const ranked = (input.cameoCandidates ?? [])
    .map((id) => ({ id, score: getCameoLikelihood(input.primaryGnomeId, id) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, policy.maxCameos)
    .map((x) => x.id);

  return {
    primarySpeaker: input.primaryGnomeId,
    cameoSpeakers: ranked,
    narrativeArc: input.narrativeArc,
    responseMode: "swarm",
  };
}
