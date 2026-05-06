/**
 * Public search() API. Async-only.
 *
 * Awaits the index loader, tokenizes the query, scores every doc with
 * BM25, returns the top-k hits with snippets and citations. The cache
 * inside loadIndex() means every call after the first resolves on the
 * same microtask — no I/O, no measurable async overhead.
 */
import type { ContentKind, SearchHit, SearchOptions } from './types.js';
import { tokenize } from './tokenize.js';
import { scoreDoc } from './bm25.js';
import { extractSnippet } from './snippet.js';
import { loadIndex } from './load-index.js';

const MAX_K = 25;
const DEFAULT_K = 10;

export async function search(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const idx = await loadIndex();
  const k = Math.min(MAX_K, Math.max(1, opts.k ?? DEFAULT_K));
  const kindFilter: Set<ContentKind> | null = opts.kinds?.length
    ? new Set(opts.kinds)
    : null;

  const scored: Array<{ score: number; docIdx: number }> = [];
  for (let i = 0; i < idx.docs.length; i++) {
    const doc = idx.docs[i];
    if (kindFilter && !kindFilter.has(doc.kind)) continue;
    const score = scoreDoc(queryTokens, doc, idx.idf, idx.meta.avg_doc_length);
    if (score > 0) scored.push({ score, docIdx: i });
  }
  // Sort by score descending; tie-break by docIdx ascending so the order is
  // deterministic across runs and platforms (V8's sort is stable on modern
  // Node, but pinning the secondary key makes the contract explicit).
  scored.sort((a, b) => b.score - a.score || a.docIdx - b.docIdx);

  return scored.slice(0, k).map(({ score, docIdx }, i) => {
    const doc = idx.docs[docIdx];
    return {
      rank: i + 1,
      score,
      kind: doc.kind,
      title: doc.title,
      snippet: extractSnippet(doc.text, queryTokens),
      citation: doc.citation,
    };
  });
}
