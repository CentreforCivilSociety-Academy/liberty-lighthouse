/**
 * Liberty Lighthouse agent-search package.
 *
 * BM25 search over the markdown corpus. Index is built at deploy time
 * (npm run build:agent-index → src/lib/agent-search/_generated/index.json)
 * and loaded lazily at runtime. See docs/agents-api.md §9 for design.
 */
export * from './types.js';
export { tokenize } from './tokenize.js';
export { scoreDoc, computeIdf, DEFAULT_BM25, type BM25Opts } from './bm25.js';
