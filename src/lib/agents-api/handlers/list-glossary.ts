/**
 * list_glossary handler.
 *
 * Reads the glossary collection from disk, applies an optional
 * substring filter (case-insensitive, against term and definition),
 * returns terms + citations.
 *
 * See docs/agents-api.md §5.4.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import type {
  GlossaryPayload,
  GlossaryTerm,
  ListGlossaryInput,
} from '../types.js';
import type { Citation } from '../../agent-search/types.js';

const DEFAULT_SITE = 'https://liberty-lighthouse.vercel.app';
// Anchored to this file's location — see read-index.ts for rationale.
const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

interface HandleOpts {
  contentDir?: string;
  siteUrl?: string;
}

export async function handleListGlossary(
  input: ListGlossaryInput,
  opts: HandleOpts = {},
): Promise<GlossaryPayload> {
  const contentDir = opts.contentDir ?? DEFAULT_CONTENT_DIR;
  const siteUrl = (opts.siteUrl ?? DEFAULT_SITE).replace(/\/$/, '');
  const dir = join(contentDir, 'glossary');

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));
  } catch {
    return { terms: [] };
  }

  const filter = input.filter?.trim().toLowerCase();
  const terms: GlossaryTerm[] = [];

  for (const f of files) {
    const slug = f.replace(/\.mdx?$/, '');
    const raw = readFileSync(join(dir, f), 'utf8');
    const { data } = matter(raw);
    const d = data as Record<string, unknown>;
    if (d.draft) continue;
    const term = (d.term as string) ?? slug;
    const definition = (d.definition as string) ?? '';
    if (filter) {
      const haystack = `${term} ${definition}`.toLowerCase();
      if (!haystack.includes(filter)) continue;
    }
    const citation: Citation = {
      canonical_url: `${siteUrl}/glossary/${slug}/`,
      markdown_url: `${siteUrl}/glossary/${slug}.md`,
      title: term,
      kind: 'glossary',
      last_modified:
        (d.updatedAt as string) ??
        new Date().toISOString().slice(0, 10),
    };
    terms.push({ term, short_definition: definition, citation });
  }

  return { terms };
}
