import { describe, it, expect } from "vitest";
import { cosineSimilarity, normalize, safeCosine } from "../../../src/context/semantic/similarity.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = [1, 2, 3];
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("returns 0 for different length vectors", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("calculates similarity for similar vectors", () => {
    const a = [1, 1, 1];
    const b = [1, 1, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it("calculates similarity for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });
});

describe("normalize", () => {
  it("normalizes vectors to unit length", () => {
    const vec = [3, 4];
    const norm = normalize(vec);
    const length = Math.sqrt(norm.reduce((s, v) => s + v * v, 0));
    expect(length).toBeCloseTo(1, 5);
  });

  it("returns zero vector unchanged", () => {
    const vec = [0, 0, 0];
    expect(normalize(vec)).toEqual(vec);
  });

  it("normalizes unit vector to itself", () => {
    const vec = [1, 0, 0];
    expect(normalize(vec)).toEqual(vec);
  });

  it("handles single element vector", () => {
    const vec = [5];
    expect(normalize(vec)).toEqual([1]);
  });
});

describe("safeCosine", () => {
  it("returns similarity for valid vectors", () => {
    const a = [1, 1];
    const b = [1, 1];
    expect(safeCosine(a, b)).toBeCloseTo(1, 5);
  });

  it("returns 0 for mismatched dimensions", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(safeCosine(a, b)).toBe(0);
  });

  it("returns 0 for null/undefined inputs", () => {
    expect(safeCosine(null as unknown as number[], [1, 2])).toBe(0);
    expect(safeCosine([1, 2], undefined as unknown as number[])).toBe(0);
  });

  it("handles zero vectors gracefully", () => {
    expect(safeCosine([0, 0], [1, 2])).toBe(0);
  });
});
