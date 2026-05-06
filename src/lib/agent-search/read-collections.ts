/**
 * Read all relevant Astro content collections from disk and produce
 * IndexedDoc[] for the BM25 builder.
 *
 * We can't use `astro:content` here — the build script runs in plain Node
 * via tsx, and astro:content is only available inside Astro pages or
 * integrations. So we walk the filesystem and parse frontmatter with
 * gray-matter, mirroring astro.config.mjs:23-43.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import matter from 'gray-matter';
import type { IndexedDoc, Citation } from './types.js';
import { tokenize } from './tokenize.js';
import {
  COLLECTIONS,
  type CollectionSpec,
  type ParsedEntry,
} from './collection-specs.js';

export type { CollectionSpec, ParsedEntry };

const DEFAULT_SITE_URL = 'https://liberty-lighthouse.vercel.app';

interface ReaderOpts {
  /** Root directory containing topics/, faqs/, glossary/, etc. */
  contentDir: string;
  /** Site origin used for canonical_url + markdown_url. */
  siteUrl?: string;
}

function* walk(root: string, exts: readonly string[]): Generator<string> {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(root, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      yield* walk(full, exts);
    } else if (exts.some((e) => name.endsWith(e))) {
      yield full;
    }
  }
}

export function readCollections(opts: ReaderOpts): IndexedDoc[] {
  const siteUrl = (opts.siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, '');
  const out: IndexedDoc[] = [];

  // Deliberately not indexed: 'comments' (user-generated, moderation-gated,
  // not authoritative content) and 'settings' (site-config singletons, not
  // searchable content). Adding a new content collection? Add a CollectionSpec
  // to ./collection-specs.ts; this loop picks it up automatically.
  for (const spec of COLLECTIONS) {
    const dirRoot = join(opts.contentDir, spec.dir);
    for (const fullPath of walk(dirRoot, spec.exts)) {
      const raw = readFileSync(fullPath, 'utf8');
      const parsed =
        spec.exts.includes('.json')
          ? { data: JSON.parse(raw) as Record<string, unknown>, content: '' }
          : matter(raw);
      const data = parsed.data as Record<string, unknown>;
      if (data.draft) continue;
      const relRaw = relative(dirRoot, fullPath);
      // Strip extension AND normalize to forward slashes for URL safety on Windows
      // (where `relative()` returns backslash separators that would otherwise get
      // percent-encoded when fed to new URL()).
      const relPath = relRaw.replace(/\.(mdx?|json)$/, '').split(sep).join('/');
      const entry: ParsedEntry = {
        relPath,
        fullPath,
        data,
        body: typeof parsed.content === 'string' ? parsed.content : '',
        siteUrl,
      };
      const meta = spec.shape(entry);
      const text = `${meta.title}\n${entry.body}`.trim();
      const tokens = tokenize(text);
      const tf: Record<string, number> = {};
      for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
      const citation: Citation = {
        canonical_url: meta.canonical_url,
        markdown_url: meta.markdown_url,
        title: meta.title,
        kind: spec.kind,
        last_modified: meta.last_modified,
      };
      out.push({
        id: meta.id,
        kind: spec.kind,
        title: meta.title,
        tf,
        length: tokens.length,
        text,
        citation,
      });
    }
  }
  return out;
}
