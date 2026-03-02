import { SemanticCluster, type SemanticResult } from './types.js';
import { safeCosine } from './similarity.js';

interface ClusterItem {
  id: string;
  embedding: number[];
  text: string;
  sim: number;
}

function toClusterItem(r: SemanticResult, embedding?: number[]): ClusterItem {
  return {
    id: r.id,
    embedding: embedding ?? [r.sim, r.sim > 0.8 ? 1 : 0, r.sim > 0.9 ? 1 : 0],
    text: r.snippet,
    sim: r.sim,
  };
}

export function greedyCluster(
  results: SemanticResult[],
  similarityThreshold: number = 0.75,
  maxClusters: number = 10,
  embeddings?: Map<string, number[]>
): SemanticCluster[] {
  const items = results.map(r => toClusterItem(r, embeddings?.get(r.id)));
  if (items.length === 0) {
    return [];
  }

  const clusters: SemanticCluster[] = [];
  const assigned = new Set<string>();

  for (const item of items) {
    if (assigned.has(item.id)) {
      continue;
    }

    let bestCluster: SemanticCluster | null = null;
    let bestScore = -1;

    for (const cluster of clusters) {
      const score = safeCosine(item.embedding, cluster.centroid);
      if (score > similarityThreshold && score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.members.push({ id: item.id, sim: 1.0, snippet: item.text });
      bestCluster.size = bestCluster.members.length;
      assigned.add(item.id);
      bestCluster.centroid = updateCentroid(bestCluster.centroid, item.embedding, bestCluster.members.length);
    } else if (clusters.length < maxClusters) {
      clusters.push({
        label: generateLabel(item.text),
        centroid: [...item.embedding],
        members: [{ id: item.id, sim: 1.0, snippet: item.text }],
        size: 1,
      });
      assigned.add(item.id);
    }
  }

  for (const cluster of clusters) {
    (cluster as { score?: number }).score = calculateClusterScore(cluster, items);
  }

  clusters.sort((a, b) => ((b as { score?: number }).score ?? 0) - ((a as { score?: number }).score ?? 0));
  return clusters;
}

function updateCentroid(current: number[], newVector: number[], count: number): number[] {
  const weight = 1 / count;
  return current.map((val, i) => val * (1 - weight) + (newVector[i] ?? 0) * weight);
}

function calculateClusterScore(cluster: SemanticCluster, items: ClusterItem[]): number {
  const clusterItems = items.filter(item => cluster.members.some(m => m.id === item.id));
  if (clusterItems.length === 0) {
    return 0;
  }

  let totalScore = 0;
  for (const item of clusterItems) {
    if (item?.embedding && cluster?.centroid) {
      totalScore += safeCosine(item.embedding, cluster.centroid);
    }
  }

  return clusterItems.length > 0 ? totalScore / clusterItems.length : 0;
}

function generateLabel(text: string | undefined): string {
  if (!text) return 'topic';
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 3);

  return words.join('_') || 'topic';
}
