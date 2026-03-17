import type { PersonaEpisode, PersonaReflection } from "../memoryTypes.js";

export class EpisodicMemoryStore {
  private readonly episodes: PersonaEpisode[] = [];
  private readonly reflections: PersonaReflection[] = [];

  addEpisode(episode: PersonaEpisode): void {
    this.episodes.push(episode);
  }

  addReflection(reflection: PersonaReflection): void {
    this.reflections.push(reflection);
  }

  getEpisodesByVoice(voiceId: string): PersonaEpisode[] {
    return this.episodes.filter((e) => e.voiceId === voiceId);
  }

  getRetainedEpisodes(voiceId: string): PersonaEpisode[] {
    const retainedIds = new Set(
      this.reflections
        .filter((r) => r.voiceId === voiceId && r.retentionDecision === "retain")
        .map((r) => r.episodeId),
    );
    return this.episodes.filter((e) => retainedIds.has(e.id));
  }
}
