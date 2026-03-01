/**
 * Phase 3 Semantic Intelligence — Types
 */

export type SemanticMode = "shadow" | "assist" | "full";

export interface SemanticResult {
  id: string;
  sim: number;
  snippet: string;
}

export interface SemanticCluster {
  label: string;
  size: number;
  centroid: number[];
  members: SemanticResult[];
}

export interface SemanticBrief {
  enabled: boolean;
  mode: SemanticMode;
  seed_hash: string;
  top_topic?: string;
  top_results?: SemanticResult[];
  clusters?: Array<{ label: string; size: number }>;
  avg_top5_sim?: number;
}

export interface SemanticSignals {
  avg_top5_sim?: number;
  top_topic?: string;
  mode?: SemanticMode;
}

export interface SemanticConfig {
  enabled: boolean;
  mode: SemanticMode;
  topK: number;
  clusterSim: number;
  queryMaxResults: number;
  memoryTtlDays: number;
  indexTtlDays: number;
  indexMaxDocs: number;
}

export function getSemanticConfig(): SemanticConfig {
  return {
    enabled: process.env.SEMANTIC_ENABLED === "true",
    mode: (process.env.SEMANTIC_MODE ?? "shadow") as SemanticMode,
    topK: Number(process.env.SEMANTIC_TOPK ?? 20),
    clusterSim: Number(process.env.SEMANTIC_CLUSTER_SIM ?? 0.82),
    queryMaxResults: Number(process.env.SEMANTIC_QUERY_MAX_RESULTS ?? 50),
    memoryTtlDays: Number(process.env.SEMANTIC_MEMORY_TTL_DAYS ?? 14),
    indexTtlDays: Number(process.env.SEMANTIC_INDEX_TTL_DAYS ?? 7),
    indexMaxDocs: Number(process.env.SEMANTIC_INDEX_MAX_DOCS ?? 2000),
  };
}
