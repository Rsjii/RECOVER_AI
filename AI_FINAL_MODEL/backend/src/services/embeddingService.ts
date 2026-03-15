/**
 * PHASE2_DISABLED — OpenAI vector embeddings for code search / similar PR detection
 * Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.
 *
 * Embedding Service - Generates vector embeddings for RAG
 * COPY from AI_IDENTITY - works as-is
 */

import OpenAI from 'openai';
import { config } from '../config/env';
import { logger } from '../config/logger';
import crypto from 'crypto';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_COST_PER_1K_TOKENS = 0.00002;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
  cost: number;
}

class EmbeddingService {
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private cacheMaxSize = 10000;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
      logger.info('Embedding Service initialized with OpenAI');
    } else {
      logger.warn('Embedding Service: No OpenAI API key, using fallback similarity');
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const cleanText = this.cleanTextForEmbedding(text);
    const cacheKey = this.getCacheKey(cleanText);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return {
        embedding: cached,
        model: 'cache',
        tokensUsed: 0,
        cost: 0,
      };
    }

    if (this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: cleanText,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        const embedding = response.data[0].embedding;
        const tokensUsed = response.usage?.total_tokens || 0;
        const cost = (tokensUsed / 1000) * EMBEDDING_COST_PER_1K_TOKENS;

        this.addToCache(cacheKey, embedding);
        logger.debug(`Generated embedding: ${tokensUsed} tokens, $${cost.toFixed(6)}`);

        return {
          embedding,
          model: EMBEDDING_MODEL,
          tokensUsed,
          cost,
        };
      } catch (error: any) {
        logger.error('OpenAI embedding failed, using fallback:', error.message);
        return this.generateFallbackEmbedding(cleanText);
      }
    }

    return this.generateFallbackEmbedding(cleanText);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openai || texts.length === 0) {
      return Promise.all(texts.map(t => this.generateFallbackEmbedding(t)));
    }

    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    texts.forEach((text, i) => {
      const cleanText = this.cleanTextForEmbedding(text);
      const cacheKey = this.getCacheKey(cleanText);
      const cached = this.embeddingCache.get(cacheKey);

      if (cached) {
        results[i] = {
          embedding: cached,
          model: 'cache',
          tokensUsed: 0,
          cost: 0,
        };
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(cleanText);
      }
    });

    if (uncachedTexts.length > 0) {
      try {
        const batchSize = 100;
        for (let i = 0; i < uncachedTexts.length; i += batchSize) {
          const batch = uncachedTexts.slice(i, i + batchSize);
          const batchIndices = uncachedIndices.slice(i, i + batchSize);

          const response = await this.openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
          });

          const tokensPerItem = Math.ceil((response.usage?.total_tokens || 0) / batch.length);
          const costPerItem = (tokensPerItem / 1000) * EMBEDDING_COST_PER_1K_TOKENS;

          response.data.forEach((item, j) => {
            const originalIndex = batchIndices[j];
            const embedding = item.embedding;
            const cacheKey = this.getCacheKey(batch[j]);
            this.addToCache(cacheKey, embedding);

            results[originalIndex] = {
              embedding,
              model: EMBEDDING_MODEL,
              tokensUsed: tokensPerItem,
              cost: costPerItem,
            };
          });
        }

        logger.info(`Generated batch embeddings: ${uncachedTexts.length} new, ${texts.length - uncachedTexts.length} cached`);
      } catch (error: any) {
        logger.error('Batch embedding failed, using fallback:', error.message);
        for (let i = 0; i < uncachedIndices.length; i++) {
          if (!results[uncachedIndices[i]]) {
            try {
              results[uncachedIndices[i]] = await this.generateFallbackEmbedding(uncachedTexts[i]);
            } catch (fallbackError: any) {
              logger.error(`Fallback embedding failed for text ${i}:`, fallbackError.message);
              results[uncachedIndices[i]] = {
                embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
                model: 'fallback-error',
                tokensUsed: 0,
                cost: 0,
              };
            }
          }
        }
      }
    }

    return results as EmbeddingResult[];
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      logger.warn('Embedding dimension mismatch, using fallback comparison');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  private cleanTextForEmbedding(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()'-]/g, '')
      .trim()
      .substring(0, 8000);
  }

  private getCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  private addToCache(key: string, embedding: number[]): void {
    if (this.embeddingCache.size >= this.cacheMaxSize) {
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) {
        this.embeddingCache.delete(firstKey);
      }
    }
    this.embeddingCache.set(key, embedding);
  }

  private async generateFallbackEmbedding(text: string): Promise<EmbeddingResult> {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const embedding = new Array(256).fill(0);

    words.forEach((word, i) => {
      const hash = this.simpleHash(word);
      const pos = hash % 256;
      const weight = 1 / Math.log(i + 2);
      embedding[pos] += weight;
    });

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return {
      embedding,
      model: 'fallback-tfidf',
      tokensUsed: 0,
      cost: 0,
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  isOpenAIAvailable(): boolean {
    return this.openai !== null;
  }

  getEmbeddingDimensions(): number {
    return this.openai ? EMBEDDING_DIMENSIONS : 256;
  }
}

export const embeddingService = new EmbeddingService();
