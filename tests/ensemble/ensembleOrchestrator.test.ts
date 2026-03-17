/**
 * Phase-4: Ensemble orchestrator and character graph tests
 */
import { describe, it, expect } from "vitest";
import { orchestrate } from "../../src/ensemble/ensembleOrchestrator.js";
import { getRelationship, getCameoLikelihood } from "../../src/ensemble/characterInteractionGraph.js";

describe("ensembleOrchestrator", () => {
  it("returns single mode when energy low", () => {
    const r = orchestrate({
      primaryGnomeId: "gorky",
      conversationEnergy: 0.5,
      absurdityScore: 0.8,
      availableGnomes: ["gorky", "spark", "moss"],
      cameoCandidates: ["spark"],
    });
    expect(r.responseMode).toBe("single");
    expect(r.cameoSpeakers).toHaveLength(0);
  });

  it("returns swarm when energy high and cameos available", () => {
    const r = orchestrate({
      primaryGnomeId: "gorky",
      conversationEnergy: 0.85,
      absurdityScore: 0.7,
      availableGnomes: ["gorky", "spark", "moss"],
      cameoCandidates: ["spark", "moss"],
    });
    expect(r.responseMode).toBe("swarm");
    expect(r.cameoSpeakers.length).toBeGreaterThan(0);
    expect(r.primarySpeaker).toBe("gorky");
  });
});

describe("characterInteractionGraph", () => {
  it("returns relationship for known pair", () => {
    const r = getRelationship("gorky", "spark");
    expect(r).not.toBeNull();
    expect(r?.type).toBe("teasing");
  });

  it("returns null for unknown pair", () => {
    const r = getRelationship("unknown", "other");
    expect(r).toBeNull();
  });

  it("getCameoLikelihood returns higher score for known pairs", () => {
    const known = getCameoLikelihood("gorky", "spark");
    const unknown = getCameoLikelihood("gorky", "unknown_gnome");
    expect(known).toBeGreaterThanOrEqual(unknown);
  });
});