import type { GnomeProfile } from "../../gnomes/types.js";
import type { PersonaEpisode, PersonaReflection } from "../memoryTypes.js";
import type { PersonaSemanticRecord } from "../types.js";

function containsAny(text: string, needles: string[]): boolean {
  const low = text.toLowerCase();
  return needles.some((n) => low.includes(n.toLowerCase()));
}

export function scoreInCharacter(episode: PersonaEpisode, profile: GnomeProfile): number {
  const facets = profile.semantic_facets ?? [];
  const style = profile.style_anchors ?? [];
  const candidate = `${episode.interactionText} ${episode.responseText}`;
  const facetHit = facets.length
    ? facets.filter((f) => containsAny(candidate, f.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 3))).length / facets.length
    : 0.5;
  const styleHit = style.length
    ? style.filter((s) => containsAny(candidate, s.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 3))).length / style.length
    : 0.5;
  return Math.min(1, 0.6 * facetHit + 0.4 * styleHit);
}

export function scoreUtility(episode: PersonaEpisode): number {
  let score = 0.35;
  if ((episode.responseText ?? "").length > 40) score += 0.2;
  if (episode.qualitySignals?.accepted) score += 0.2;
  if (episode.qualitySignals?.useful) score += 0.2;
  if ((episode.topicTags ?? []).length > 0) score += 0.05;
  return Math.min(1, score);
}

export function scoreDriftRisk(episode: PersonaEpisode, profile: GnomeProfile): number {
  const negativeAnchors = profile.negative_anchors ?? [];
  const boundaries = profile.safety_boundaries ?? [];
  const combined = [...negativeAnchors, ...boundaries];
  const response = episode.responseText ?? "";
  const boundaryViolation = combined.length ? combined.filter((b) => containsAny(response, [b])).length / combined.length : 0;
  const signalRisk = episode.qualitySignals?.driftRisk ?? 0.2;
  return Math.min(1, signalRisk + boundaryViolation * 0.6);
}

export function shouldRetainEpisode(reflection: Pick<PersonaReflection, "inCharacterScore" | "utilityScore" | "driftRisk">): boolean {
  return reflection.inCharacterScore >= 0.6 && reflection.utilityScore >= 0.55 && reflection.driftRisk <= 0.45;
}

export function shouldPromoteToSemanticRecord(reflection: Pick<PersonaReflection, "inCharacterScore" | "utilityScore" | "driftRisk">): boolean {
  return reflection.inCharacterScore >= 0.8 && reflection.utilityScore >= 0.7 && reflection.driftRisk <= 0.25;
}

export function reflectEpisode(episode: PersonaEpisode, profile: GnomeProfile): PersonaReflection {
  const inCharacterScore = scoreInCharacter(episode, profile);
  const utilityScore = scoreUtility(episode);
  const driftRisk = scoreDriftRisk(episode, profile);
  const qualityScore = Math.max(0, inCharacterScore * 0.5 + utilityScore * 0.35 + (1 - driftRisk) * 0.15);
  const retain = shouldRetainEpisode({ inCharacterScore, utilityScore, driftRisk });
  const promote = shouldPromoteToSemanticRecord({ inCharacterScore, utilityScore, driftRisk });

  return {
    episodeId: episode.id,
    voiceId: episode.voiceId,
    qualityScore,
    inCharacterScore,
    utilityScore,
    driftRisk,
    retentionDecision: retain ? "retain" : "discard",
    promotionState: promote ? "promoted" : "rejected",
    reasoning: [`inCharacter=${inCharacterScore.toFixed(2)}`, `utility=${utilityScore.toFixed(2)}`, `drift=${driftRisk.toFixed(2)}`],
    createdAt: new Date().toISOString(),
  };
}

export function promoteEpisodeToSemanticRecord(
  episode: PersonaEpisode,
  reflection: PersonaReflection,
  profile: GnomeProfile,
  version = "v1",
): PersonaSemanticRecord | null {
  if (reflection.promotionState !== "promoted") return null;
  return {
    id: `reflection:${episode.voiceId}:${episode.id}`,
    voiceId: episode.voiceId,
    namespace: "memory-episodic",
    docType: "voice_example",
    text: episode.responseText,
    metadata: {
      role: profile.role,
      archetype: profile.archetype,
      sourceType: "reflection",
      active: true,
      version,
      derivedFrom: episode.id,
      exampleQuality: "silver",
      retrievalPriority: profile.retrieval_priority,
    },
  };
}
