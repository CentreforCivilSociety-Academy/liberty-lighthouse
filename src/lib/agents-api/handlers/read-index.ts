/**
 * read_index handler.
 *
 * Returns the full text of /llms.txt + /AGENTS.md + a corpus_summary
 * derived from the BM25 index. Pure-Node — reads topics directly from
 * disk (mirrors astro.config.mjs:23-43), uses loadIndex() for counts.
 *
 * See docs/agents-api.md §5.1.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIndex } from '../../agent-search/load-index.js';
import { buildAgentsDoc } from '../../agents-doc.js';
import { buildLlmsTxt, type CorpusInputs } from '../index-content.js';
import type { IndexPayload, CorpusSummary } from '../types.js';

// Anchored to this file's location, NOT process.cwd() — Vercel functions
// have cwd = /var/task and src/content/ is bundled relative to the
// function's source location via vercel.json includeFiles.
// handlers/ → agents-api/ → lib/ → src/ → content/.
const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

interface HandleOpts {
  /** Override for tests. Defaults to the bundled src/content/ tree. */
  contentDir?: string;
}

function readTopicsFromDisk(contentDir: string): CorpusInputs['topics'] {
  const dir = join(contentDir, 'topics');
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((f) => {
    const raw = readFileSync(join(dir, f), 'utf8');
    const data = JSON.parse(raw) as {
      title: string;
      slug: string;
      description: string;
      order: number;
    };
    return { data };
  });
}

export async function handleReadIndex(
  opts: HandleOpts = {},
): Promise<IndexPayload> {
  const contentDir = opts.contentDir ?? DEFAULT_CONTENT_DIR;
  const idx = await loadIndex();

  // Counts by kind from the BM25 index.
  const counts: Record<string, number> = {};
  for (const doc of idx.docs) {
    counts[doc.kind] = (counts[doc.kind] ?? 0) + 1;
  }

  // We need topic listings (with description+order) for buildLlmsTxt.
  // The BM25 index doesn't preserve these fields, so read from disk.
  const topics = readTopicsFromDisk(contentDir);

  // For the `external` count split: we don't differentiate spontaneous-order
  // vs ccs-books in the kind label. Approximate by inspecting doc ids.
  const spontaneousOrderDocs = idx.docs.filter((d) =>
    d.id.startsWith('external/spontaneous-order/'),
  );
  const ccsBookDocs = idx.docs.filter((d) =>
    d.id.startsWith('external/ccs-books/'),
  );
  // Build minimal shape for buildLlmsTxt — it only inspects .data.book_slug.
  const ccsBooksInput = ccsBookDocs.map((d) => {
    const bookSlug = d.id.split('/')[2] ?? 'unknown';
    return { data: { book_slug: bookSlug } };
  });

  const llms_txt = buildLlmsTxt({
    topics,
    spontaneousOrder: spontaneousOrderDocs,
    ccsBooks: ccsBooksInput,
    wikiCount: counts.wiki ?? 0,
  });
  const agents_md = buildAgentsDoc();

  const corpus_summary: CorpusSummary = {
    topics: counts.topic ?? 0,
    faqs: counts.faq ?? 0,
    videos: counts.video ?? 0,
    glossary: counts.glossary ?? 0,
    wiki: counts.wiki ?? 0,
    external: counts.external ?? 0,
    last_updated: idx.meta.built_at.slice(0, 10),
  };

  return { llms_txt, agents_md, corpus_summary };
}
