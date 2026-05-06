/**
 * Per-kind collection specifications for the agent-search reader.
 *
 * Each CollectionSpec defines how a single Astro content collection
 * (topics, faqs, videos, glossary, wiki, external/spontaneous-order,
 * external/ccs-books) maps from on-disk markdown/JSON to an IndexedDoc's
 * id, title, citation URLs, and last_modified date.
 *
 * Splitting these specs out keeps read-collections.ts focused on the
 * filesystem walk + frontmatter parse + tokenization machinery; this
 * file holds the per-kind URL/title rules that change with content
 * conventions but not with reader implementation.
 *
 * URL format reference: src/lib/markdown-export.ts:11-60.
 * External canonical URL handling: docs/agents-api.md §6.
 */
import type { ContentKind } from './types.js';

export interface CollectionSpec {
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

export interface ParsedEntry {
  /** Slug-style relative path under the collection's directory, e.g. "msp" or
   *  "agriculture/why-msp". Always forward-slash separated, even on Windows. */
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

export const COLLECTIONS: CollectionSpec[] = [
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
      const parts = relPath.split('/');
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
      const parts = relPath.split('/');
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
