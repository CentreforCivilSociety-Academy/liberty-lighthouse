/**
 * BM25 scorer.
 *
 * Pure functions. Inputs: query tokens, a single IndexedDoc, an IDF table,
 * and the corpus average doc length. Output: a non-negative score. Caller
 * ranks by score and slices the top-k.
 *
 * Parameters k1=1.5, b=0.75 (Lucene defaults). See:
 * https://en.wikipedia.org/wiki/Okapi_BM25
 */
import type { IndexedDoc } from './types.js';

export interface BM25Opts {
  k1: number;
  b: number;
}

export const DEFAULT_BM25: BM25Opts = { k1: 1.5, b: 0.75 };

/**
 * Compute the IDF table for a corpus.
 *
 * IDF(term) = ln(1 + (N - df + 0.5) / (df + 0.5))
 * where N is corpus size and df is the number of docs containing the term.
 */
export function computeIdf(docs: IndexedDoc[]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const doc of docs) {
    for (const term of Object.keys(doc.tf)) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }
  const N = docs.length;
  const idf: Record<string, number> = {};
  for (const term of Object.keys(df)) {
    idf[term] = Math.log(1 + (N - df[term] + 0.5) / (df[term] + 0.5));
  }
  return idf;
}

/**
 * Score one doc against a tokenized query. Returns 0 when no overlap.
 */
export function scoreDoc(
  queryTokens: string[],
  doc: IndexedDoc,
  idf: Record<string, number>,
  avgDocLength: number,
  opts: BM25Opts = DEFAULT_BM25,
): number {
  let score = 0;
  const { k1, b } = opts;
  const lengthNorm = 1 - b + b * (doc.length / (avgDocLength || 1));
  for (const term of queryTokens) {
    const tf = doc.tf[term];
    if (!tf) continue;
    const termIdf = idf[term] ?? 0;
    const num = tf * (k1 + 1);
    const den = tf + k1 * lengthNorm;
    score += termIdf * (num / den);
  }
  return score;
}
