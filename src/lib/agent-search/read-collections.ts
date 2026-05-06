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
import type { ContentKind, IndexedDoc, Citation } from './types.js';
import { tokenize } from './tokenize.js';

const DEFAULT_SITE_URL = 'https://liberty-lighthouse.vercel.app';

interface ReaderOpts {
  /** Root directory containing topics/, faqs/, glossary/, etc. */
  contentDir: string;
  /** Site origin used for canonical_url + markdown_url. */
  siteUrl?: string;
}

interface CollectionSpec {
  /** Subdirectory under contentDir. */
  dir: string;
  /** Kind label on the resulting IndexedDoc. */
  kind: ContentKind;
  /** File patterns to include. */
  exts: readonly string[];
  /** Builds id, canonical url, markdown url, and title for each entry. */
  shape: (entry: ParsedEntry) => {
    id: string;
    title: string;
    canonical_url: string;
    markdown_url: string;
    last_modified: string;
  };
}

interface ParsedEntry {
  /** Slug-style relative path under the collection's directory, e.g. "msp" or "agriculture/why-msp". */
  relPath: string;
  /** Full filesystem path. */
  fullPath: string;
  /** Parsed frontmatter. */
  data: Record<string, unknown>;
  /** Markdown body. */
  body: string;
  /** Site origin to use when building URLs. */
  siteUrl: string;
}

function joinUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl + '/').href;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const COLLECTIONS: CollectionSpec[] = [
  {
    dir: 'topics',
    kind: 'topic',
    exts: ['.json'],
    shape: ({ relPath, data, siteUrl }) => {
      const slug = (data.slug as string) ?? relPath;
      return {
        id: `topic/${slug}`,
        title: (data.title as string) ?? slug,
        canonical_url: joinUrl(siteUrl, `/topics/${slug}/`),
        markdown_url: joinUrl(siteUrl, `/topics/${slug}.md`),
        last_modified: (data.updatedAt as string) ?? today(),
      };
    },
  },
  {
    dir: 'glossary',
    kind: 'glossary',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => ({
      id: `glossary/${relPath}`,
      title: (data.term as string) ?? relPath,
      canonical_url: joinUrl(siteUrl, `/glossary/${relPath}/`),
      markdown_url: joinUrl(siteUrl, `/glossary/${relPath}.md`),
      last_modified: (data.updatedAt as string) ?? today(),
    }),
  },
  {
    dir: 'faqs',
    kind: 'faq',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => {
      // FAQs live as "<topic>/<slug>" — exactly two path segments. URL
      // construction below assumes flat; deeper nesting would produce
      // 404'ing canonical URLs. Assert and fail loudly.
      const parts = relPath.split(sep);
      if (parts.length !== 2) {
        throw new Error(
          `agent-search: unexpected faq path "${relPath}" — ` +
            `faqs must live as "<topic>/<slug>". Found ${parts.length} segments.`,
        );
      }
      const [topicFromPath, slug] = parts;
      const topic = (data.topic as string) ?? topicFromPath;
      return {
        id: `faq/${topic}/${slug}`,
        title: (data.question as string) ?? slug,
        canonical_url: joinUrl(siteUrl, `/topics/${topic}/faq/${slug}/`),
        markdown_url: joinUrl(siteUrl, `/topics/${topic}/faq/${slug}.md`),
        last_modified: (data.updatedAt as string) ?? today(),
      };
    },
  },
  {
    dir: 'videos',
    kind: 'video',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => {
      const parts = relPath.split(sep);
      if (parts.length !== 2) {
        throw new Error(
          `agent-search: unexpected video path "${relPath}" — ` +
            `videos must live as "<topic>/<slug>". Found ${parts.length} segments.`,
        );
      }
      const [topicFromPath, slug] = parts;
      const topic = (data.topic as string) ?? topicFromPath;
      return {
        id: `video/${topic}/${slug}`,
        title: (data.title as string) ?? slug,
        canonical_url: joinUrl(siteUrl, `/topics/${topic}/videos/${slug}/`),
        markdown_url: joinUrl(siteUrl, `/topics/${topic}/videos/${slug}.md`),
        last_modified: (data.updatedAt as string) ?? today(),
      };
    },
  },
  {
    dir: 'wiki',
    kind: 'wiki',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => ({
      id: `wiki/${relPath}`,
      title: (data.name as string) ?? relPath,
      canonical_url: joinUrl(siteUrl, `/wiki/${relPath}/`),
      markdown_url: joinUrl(siteUrl, `/wiki/${relPath}.md`),
      last_modified: (data.last_regen as string) ?? today(),
    }),
  },
  {
    dir: 'external/spontaneous-order',
    kind: 'external',
    exts: ['.md'],
    shape: ({ relPath, data, siteUrl }) => {
      // Spontaneous Order has a real upstream URL — citations send humans
      // to the original publisher per docs/agents-api.md §6.
      const originalUrl = data.original_url as string | undefined;
      const markdownUrl = joinUrl(
        siteUrl,
        `/external/spontaneous-order/${relPath}.md`,
      );
      return {
        id: `external/spontaneous-order/${relPath}`,
        title: (data.title as string) ?? relPath,
        canonical_url: originalUrl ?? markdownUrl,
        markdown_url: markdownUrl,
        last_modified: (data.published_at as string) ?? today(),
      };
    },
  },
  {
    dir: 'external/ccs-books',
    kind: 'external',
    exts: ['.md'],
    shape: ({ relPath, data, siteUrl }) => {
      // CCS Books have no public HTML page. Per docs/agents-api.md §6,
      // canonical_url falls back to the markdown URL itself.
      const markdownUrl = joinUrl(siteUrl, `/external/ccs-books/${relPath}.md`);
      return {
        id: `external/ccs-books/${relPath}`,
        title: (data.chapter_title as string) ?? relPath,
        canonical_url: markdownUrl,
        markdown_url: markdownUrl,
        last_modified: (data.ingested_at as string) ?? today(),
      };
    },
  },
];

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
