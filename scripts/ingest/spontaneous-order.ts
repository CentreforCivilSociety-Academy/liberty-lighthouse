#!/usr/bin/env -S tsx
/**
 * Ingest Spontaneous Order Substack posts into src/content/external/spontaneous-order/.
 *
 * Two modes:
 *   1. RSS poll  — `tsx scripts/ingest/spontaneous-order.ts --rss-url <url>`
 *   2. Backlog   — `tsx scripts/ingest/spontaneous-order.ts --backlog-file <path-to-html-or-json>`
 *
 * Common flags:
 *   --dry-run    Print what would be written, don't touch the filesystem.
 *   --limit N    Process at most N items.
 *
 * Idempotent: each post's `source_hash` (SHA-256 of the raw HTML body) is
 * stored in frontmatter. On rerun, posts whose hash hasn't changed are
 * skipped without rewriting the file.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  htmlToMarkdown,
  loadFrontmatterHashes,
  logStep,
  logWarn,
  parseArgs,
  sha256,
  slugify,
  todayIso,
  writeMdxFile,
} from './lib';

const ROOT = resolve(process.cwd());
const OUT_DIR = join(ROOT, 'src/content/external/spontaneous-order');

interface IncomingPost {
  title: string;
  url: string;
  html: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  tags?: string[];
}

async function fetchRss(url: string): Promise<IncomingPost[]> {
  const mod = await import('rss-parser').catch(() => null);
  if (!mod) throw new Error('rss-parser is not installed. Run `npm install` first.');
  const Parser = (mod as any).default ?? mod;
  const parser = new Parser({
    customFields: {
      item: ['content:encoded', 'description', 'dc:creator'],
    },
  });
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map((item: any) => ({
    title: item.title ?? 'Untitled',
    url: item.link ?? '',
    html: item['content:encoded'] ?? item.content ?? item.description ?? '',
    author: item.creator ?? item['dc:creator'] ?? feed.title ?? undefined,
    publishedAt: item.isoDate ?? item.pubDate,
    excerpt: stripHtml(item.contentSnippet ?? item.description ?? '').slice(0, 280),
  }));
}

async function loadBacklog(path: string): Promise<IncomingPost[]> {
  const text = await readFile(path, 'utf8');
  // Accept JSON array of { title, url, html, ... } or single-post HTML files.
  // Format negotiation: try JSON first, fall back to single-HTML mode.
  if (text.trimStart().startsWith('[')) {
    return JSON.parse(text);
  }
  throw new Error(
    'Backlog file must be a JSON array of {title, url, html, author?, publishedAt?, excerpt?, tags?}. ' +
      'Single-HTML import is not yet supported.',
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function deriveSlug(post: IncomingPost): string {
  // Prefer the URL's last path segment; fall back to a slugified title.
  try {
    const u = new URL(post.url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) return slugify(last);
  } catch {}
  return slugify(post.title);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rssUrl = typeof args['rss-url'] === 'string' ? (args['rss-url'] as string) : null;
  const backlogFile =
    typeof args['backlog-file'] === 'string' ? (args['backlog-file'] as string) : null;
  const dryRun = Boolean(args['dry-run']);
  const limit =
    typeof args['limit'] === 'string' ? parseInt(args['limit'] as string, 10) : Infinity;

  if (!rssUrl && !backlogFile) {
    logWarn('Provide either --rss-url <url> or --backlog-file <path>. Nothing to do.');
    process.exit(1);
  }

  let incoming: IncomingPost[] = [];
  if (rssUrl) {
    logStep(`Fetching RSS from ${rssUrl}`);
    incoming = await fetchRss(rssUrl);
    logStep(`RSS returned ${incoming.length} item(s).`);
  } else if (backlogFile) {
    logStep(`Loading backlog from ${backlogFile}`);
    incoming = await loadBacklog(backlogFile);
    logStep(`Backlog has ${incoming.length} item(s).`);
  }

  const existingHashes = await loadFrontmatterHashes(OUT_DIR);
  let written = 0;
  let skipped = 0;
  let processed = 0;

  for (const post of incoming) {
    if (processed >= limit) break;
    processed++;

    const slug = deriveSlug(post);
    const hash = sha256(post.html || post.title);
    if (existingHashes.get(slug) === hash) {
      skipped++;
      continue;
    }

    const body = await htmlToMarkdown(post.html);
    const fm: Record<string, unknown> = {
      title: post.title,
      original_url: post.url,
      published_at: post.publishedAt ?? todayIso(),
      ingested_at: todayIso(),
      source_hash: hash,
    };
    if (post.author) fm.author = post.author;
    if (post.excerpt) fm.excerpt = post.excerpt;
    if (post.tags && post.tags.length) fm.tags = post.tags;

    const filePath = join(OUT_DIR, `${slug}.mdx`);
    if (dryRun) {
      logStep(`would write ${filePath} (${body.length} chars body)`);
    } else {
      await writeMdxFile(filePath, { frontmatter: fm, body });
      logStep(`wrote ${filePath}`);
    }
    written++;
  }

  logStep(`done. ${written} written, ${skipped} unchanged, ${incoming.length - processed} not processed.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
