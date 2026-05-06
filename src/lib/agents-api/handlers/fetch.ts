/**
 * fetch handler.
 *
 * Fetches the markdown for any URL on the lighthouse domain (or localhost
 * in dev), parses frontmatter into a citation block, returns
 * {markdown, citation}. Refuses off-site URLs.
 *
 * See docs/agents-api.md §5.3. Mirrors mcp/server.ts:get_page.
 */
import matter from 'gray-matter';
import { AgentError } from '../errors.js';
import type { FetchInput, FetchPayload } from '../types.js';
import type { Citation, ContentKind } from '../../agent-search/types.js';

const DEFAULT_BASE = 'https://liberty-lighthouse.vercel.app';

function getBaseHostname(): string {
  const base = process.env.LIGHTHOUSE_BASE_URL ?? DEFAULT_BASE;
  return new URL(base).hostname;
}

function isOnSite(url: string): boolean {
  try {
    const u = new URL(url);
    const allowed = new Set([
      getBaseHostname(),
      'localhost',
      '127.0.0.1',
    ]);
    return allowed.has(u.hostname);
  } catch {
    return false;
  }
}

function citationFromFrontmatter(data: Record<string, unknown>): Citation {
  const canonical_url = data.canonical_url as string | undefined;
  const markdown_url = data.markdown_url as string | undefined;
  const title = data.title as string | undefined;
  if (!canonical_url || !markdown_url || !title) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      'fetched markdown missing required frontmatter (canonical_url/markdown_url/title)',
    );
  }
  // Type guess: try to infer kind from URL shape.
  const kind: ContentKind = inferKind(canonical_url);
  const last_modified =
    (data.last_modified as string | undefined) ??
    (data.updatedAt as string | undefined) ??
    (data.published_at as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  return { canonical_url, markdown_url, title, kind, last_modified };
}

function inferKind(url: string): ContentKind {
  if (url.includes('/glossary/')) return 'glossary';
  if (url.includes('/wiki/')) return 'wiki';
  if (url.includes('/external/')) return 'external';
  if (url.includes('/faq/')) return 'faq';
  if (url.includes('/videos/')) return 'video';
  if (url.includes('/topics/')) return 'topic';
  return 'topic';
}

export async function handleFetch(input: FetchInput): Promise<FetchPayload> {
  const url = (input.url ?? '').trim();
  if (!url) {
    throw new AgentError('BAD_REQUEST', 'query parameter "url" is required');
  }
  if (!isOnSite(url)) {
    throw new AgentError(
      'BAD_REQUEST',
      'url must be on the Liberty Lighthouse domain',
      { url },
    );
  }

  let res: Response;
  try {
    res = await globalThis.fetch(url, {
      headers: { 'User-Agent': 'liberty-lighthouse-api/0.1.0' },
    });
  } catch (err) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      `fetch failed: ${(err as Error).message}`,
    );
  }
  if (res.status === 404) {
    throw new AgentError('NOT_FOUND', `upstream 404: ${url}`);
  }
  if (!res.ok) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      `upstream ${res.status}: ${res.statusText}`,
    );
  }
  const markdown = await res.text();
  const { data } = matter(markdown);
  const citation = citationFromFrontmatter(
    data as Record<string, unknown>,
  );
  return { markdown, citation };
}
