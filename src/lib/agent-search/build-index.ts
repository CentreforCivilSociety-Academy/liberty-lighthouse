/**
 * Build the BM25 index from the content collections on disk.
 *
 * Library export: buildIndex({ contentDir, siteUrl }) -> AgentIndex
 * CLI: tsx src/lib/agent-search/build-index.ts [--out <path>] [--site-url <url>]
 *
 * Run via: npm run build:agent-index
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AgentIndex } from './types.js';
import { readCollections } from './read-collections.js';
import { computeIdf } from './bm25.js';

interface BuildOpts {
  contentDir: string;
  siteUrl?: string;
}

export function buildIndex(opts: BuildOpts): AgentIndex {
  const docs = readCollections(opts);
  const idf = computeIdf(docs);
  const totalLength = docs.reduce((s, d) => s + d.length, 0);
  const avg = docs.length ? totalLength / docs.length : 0;
  return {
    docs,
    idf,
    meta: {
      built_at: new Date().toISOString(),
      corpus_count: docs.length,
      avg_doc_length: avg,
    },
  };
}

function parseArgs(argv: string[]): { out?: string; siteUrl?: string } {
  const out: { out?: string; siteUrl?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--site-url') out.siteUrl = argv[++i];
  }
  return out;
}

// Run as CLI when invoked directly. tsx may rewrite paths, so compare
// the resolved file URL rather than a raw string.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const cwd = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const contentDir = resolve(cwd, 'src/content');
  const out = resolve(cwd, args.out ?? 'src/lib/agent-search/_generated/index.json');
  const idx = buildIndex({ contentDir, siteUrl: args.siteUrl });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(idx));
  // eslint-disable-next-line no-console
  console.error(
    `[agent-search] built index: ${idx.meta.corpus_count} docs, ` +
      `${Object.keys(idx.idf).length} terms → ${out}`,
  );
}
