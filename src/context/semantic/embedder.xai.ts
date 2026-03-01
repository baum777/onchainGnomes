import { Embedder } from './embedder.js';

interface XAIEmbeddingResponse {
  embeddings: number[][];
}

export class XAIEmbedder implements Embedder {
  readonly name = 'xai';
  private apiKey: string;
  private dimension: number;
  private baseUrl: string;

  constructor(apiKey: string, dimension: number = 1024) {
    this.apiKey = apiKey;
    this.dimension = dimension;
    this.baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
  }

  dim(): number {
    return this.dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'embedding-model',
        input: texts,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      throw new Error(`xAI embedding request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as XAIEmbeddingResponse;
    return data.embeddings;
  }
}

export function createXAIEmbedder(apiKey?: string, dimension?: number): XAIEmbedder {
  const key = apiKey || process.env.XAI_API_KEY;
  if (!key) {
    throw new Error('XAI API key is required. Set XAI_API_KEY environment variable.');
  }
  return new XAIEmbedder(key, dimension);
}
