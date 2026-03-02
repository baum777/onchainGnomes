import { Embedder } from './embedder.js';
import { type SemanticResult } from './types.js';
import { safeCosine } from './similarity.js';

interface CandidateDoc {
  id: string;
  text: string;
}

export function buildSeedText(context: {
  mention?: string;
  thread?: string;
  timeline?: string;
}): string {
  const parts: string[] = [];
  if (context.mention) parts.push(context.mention);
  if (context.thread) parts.push(context.thread);
  if (context.timeline) parts.push(context.timeline);
  return parts.join('\n');
}

export async function rankCandidates(
  embedder: Embedder,
  seedVec: number[],
  candidateDocs: CandidateDoc[],
  topK: number = 20
): Promise<SemanticResult[]> {
  if (candidateDocs.length === 0) return [];

  const candidateEmbeddings = await embedder.embed(candidateDocs.map(c => c.text));

  const results: SemanticResult[] = [];
  for (let i = 0; i < candidateDocs.length; i++) {
    const sim = safeCosine(seedVec, candidateEmbeddings[i]!);
    results.push({
      id: candidateDocs[i]!.id,
      sim,
      snippet: candidateDocs[i]!.text.slice(0, 140),
    });
  }

  results.sort((a, b) => b.sim - a.sim);
  return results.slice(0, topK);
}

export function computeAvgTop5(results: SemanticResult[]): number {
  const top5 = results.slice(0, 5);
  if (top5.length === 0) return 0;
  return top5.reduce((sum, r) => sum + r.sim, 0) / top5.length;
}
