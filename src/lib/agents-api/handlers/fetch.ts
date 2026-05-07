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
import { getDefaultSite } from '../site.js';
import type { FetchInput, FetchPayload } from '../types.js';
import type { Citation, ContentKind } from '../../agent-search/types.js';

function getBaseHostname(): string {
  return new URL(getDefaultSite()).hostname;
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

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function citationFromFrontmatter(data: Record<string, unknown>): Citation {
  const canonical_url = pickString(data, ['canonical_url']);
  const markdown_url = pickString(data, ['markdown_url']);
  // Title varies by content kind:
  //   topic/video/spontaneous-order: title
  //   glossary: term
  //   faq: question
  //   wiki: name
  //   ccs-books: chapter_title
  const title = pickString(data, [
    'title',
    'term',
    'question',
    'name',
    'chapter_title',
  ]);
  if (!canonical_url || !markdown_url || !title) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      'fetched markdown missing required frontmatter (canonical_url/markdown_url/title)',
    );
  }
  const kind: ContentKind = inferKind(canonical_url);
  // Date varies too:
  //   most pages: updated_at (snake_case in YAML)
  //   external/spontaneous-order: published_at
  //   already-built citations passing through: last_modified
  //   legacy/camelCase: updatedAt
  const last_modified =
    pickString(data, [
      'last_modified',
      'updated_at',
      'updatedAt',
      'published_at',
    ]) ?? new Date().toISOString().slice(0, 10);
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
