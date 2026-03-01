/**
 * Phase 3 Semantic Intelligence — Module Exports
 */

// Types
export type { SemanticMode, SemanticResult, SemanticCluster, SemanticBrief, SemanticSignals, SemanticConfig } from './types.js';
export { getSemanticConfig } from './types.js';

// Embedder
export type { Embedder } from './embedder.js';

// Hash Embedder
export { HashEmbedder, createHashEmbedder } from './embedder.hash.js';

// XAI Embedder
export { XAIEmbedder, createXAIEmbedder } from './embedder.xai.js';

// Similarity
export { cosineSimilarity, normalize, safeCosine } from './similarity.js';

// Semantic Index
export { InMemorySemanticIndex } from './semanticIndex.js';

// Topic Clustering
export { greedyCluster } from './topicCluster.js';

// Semantic Ranker
export { buildSeedText, rankCandidates, computeAvgTop5 } from './semanticRanker.js';

// Semantic Timeline Scout
export { buildSemanticTimelineBrief } from './semanticTimelineScout.js';

// Semantic Memory
export { InMemorySemanticMemoryStore } from './semanticMemory.js';
