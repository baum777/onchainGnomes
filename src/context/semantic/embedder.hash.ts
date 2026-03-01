import crypto from 'crypto';
import { Embedder } from './embedder.js';

export class HashEmbedder implements Embedder {
  readonly name = 'hash';
  private dimension: number;

  constructor(dimension: number = 128) {
    this.dimension = dimension;
  }

  dim(): number {
    return this.dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.hashToVector(text));
  }

  private hashToVector(text: string): number[] {
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const vector: number[] = [];

    for (let i = 0; i < this.dimension; i++) {
      const hashIndex = (i * 2) % hash.length;
      const value = parseInt(hash.slice(hashIndex, hashIndex + 2), 16);
      vector.push(value / 255);
    }

    return vector;
  }
}

export function createHashEmbedder(dimension?: number): HashEmbedder {
  return new HashEmbedder(dimension);
}
