import { describe, it, expect } from "vitest";
import { greedyCluster } from "../../../src/context/semantic/topicCluster.js";
import type { SemanticResult } from "../../../src/context/semantic/types.js";

describe("greedyCluster", () => {
  it("clusters similar results together", () => {
    const results: SemanticResult[] = [
      { id: "1", sim: 0.95, snippet: "bitcoin price surge today" },
      { id: "2", sim: 0.92, snippet: "btc market analysis" },
      { id: "3", sim: 0.88, snippet: "ethereum staking rewards" },
      { id: "4", sim: 0.85, snippet: "eth layer 2 solutions" },
      { id: "5", sim: 0.7, snippet: "random unrelated text" },
    ];

    const clusters = greedyCluster(results, 0.8, 3);
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.length).toBeLessThanOrEqual(3);

    // First cluster should have the most similar items
    const topCluster = clusters[0]!;
    expect(topCluster.size).toBeGreaterThanOrEqual(1);
    expect(topCluster.label).toBeTruthy();
  });

  it("handles empty results", () => {
    const clusters = greedyCluster([], 0.8, 5);
    expect(clusters).toEqual([]);
  });

  it("handles single result", () => {
    const results: SemanticResult[] = [
      { id: "1", sim: 0.9, snippet: "only result here" },
    ];
    const clusters = greedyCluster(results, 0.8, 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.size).toBe(1);
  });

  it("generates meaningful labels", () => {
    const results: SemanticResult[] = [
      { id: "1", sim: 0.9, snippet: "crypto trading volume high today" },
      { id: "2", sim: 0.85, snippet: "market trading analysis" },
    ];
    const clusters = greedyCluster(results, 0.8, 5);
    expect(clusters[0]!.label).toMatch(/\w+/);
  });
});
