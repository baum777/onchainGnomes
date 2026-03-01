import type { Embedder } from './embedder.js';
import { SemanticMode, SemanticBrief, SemanticResult, SemanticCluster } from './types.js';
import { InMemorySemanticIndex } from './semanticIndex.js';
import { greedyCluster } from './topicCluster.js';
import { buildSeedText, rankCandidates, computeAvgTop5 } from './semanticRanker.js';
import crypto from 'crypto';

interface BuildSemanticBriefParams {
  mode: SemanticMode;
  embedder: Embedder;
  index: InMemorySemanticIndex;
  seedText: string;
  candidates: string[];
  topK: number;
  clusterSim: number;
}

export async function buildSemanticTimelineBrief(
  params: BuildSemanticBriefParams
): Promise<SemanticBrief> {
  const { mode, embedder, seedText, candidates, topK, clusterSim } = params;

  // Create hash of seed for tracking
  const seed_hash = crypto.createHash('sha256').update(seedText).digest('hex').slice(0, 16);

  if (candidates.length === 0) {
    return { enabled: true, mode, seed_hash };
  }

  // Embed seed and candidates
  const seedEmbeddings = await embedder.embed([seedText]);
  const seedVec = seedEmbeddings[0]!;

  // Build candidate docs
  const candidateDocs = candidates.map((text, i) => ({
    id: `cand-${i}`,
    text: text.slice(0, 280),
  }));

  // Rank candidates
  const topResults = await rankCandidates(embedder, seedVec, candidateDocs, topK);

  // Compute avg top5 sim
  const avg_top5_sim = computeAvgTop5(topResults);

  // Cluster results
  const clusters = greedyCluster(topResults, clusterSim, 5);

  // Get top topic
  const top_topic = clusters[0]?.label;

  // Build brief
  const brief: SemanticBrief = {
    enabled: true,
    mode,
    seed_hash,
    top_topic,
    top_results: topResults.map(r => ({ id: r.id, sim: r.sim, snippet: r.snippet })),
    clusters: clusters.map(c => ({ label: c.label, size: c.size })),
    avg_top5_sim,
  };

  return brief;
}
