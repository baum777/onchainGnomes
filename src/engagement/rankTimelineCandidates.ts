import { scoreTimelineCandidate } from "./scoreTimelineCandidate.js";
import type { TimelineCandidate, TimelineSelectionResult } from "./types.js";

export function rankTimelineCandidates(candidates: TimelineCandidate[]): TimelineCandidate[] {
  return candidates
    .map((candidate) => scoreTimelineCandidate(candidate))
    .sort((a, b) => b.finalScore - a.finalScore || b.contextStrengthScore - a.contextStrengthScore);
}

export function selectTopTimelineCandidates(
  ranked: TimelineCandidate[],
  maxPerRun: number
): TimelineSelectionResult {
  const selected: TimelineCandidate[] = [];
  const rejected: TimelineCandidate[] = [];
  const usedConversations = new Set<string>();
  const usedAuthors = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= maxPerRun) {
      candidate.rejectedBecause.push("run_cap_reached");
      rejected.push(candidate);
      continue;
    }
    if (usedConversations.has(candidate.conversationId)) {
      candidate.rejectedBecause.push("same_conversation_in_run");
      rejected.push(candidate);
      continue;
    }
    if (usedAuthors.has(candidate.authorId)) {
      candidate.rejectedBecause.push("same_author_in_run");
      rejected.push(candidate);
      continue;
    }

    candidate.selectedBecause.push("top_ranked_candidate");
    selected.push(candidate);
    usedConversations.add(candidate.conversationId);
    usedAuthors.add(candidate.authorId);
  }

  return { selected, rejected };
}
