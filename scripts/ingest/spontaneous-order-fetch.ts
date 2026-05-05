#!/usr/bin/env -S tsx
/**
 * Walk the Spontaneous Order Substack archive (public endpoints) and emit a
 * backlog.json that the existing scripts/ingest/spontaneous-order.ts script
 * consumes via its --backlog-file flag.
 *
 * Substack's RSS only exposes the most recent ~20 posts; the archive endpoint
 * is the only path to the full ~1,000-post historical backlog. The endpoints
 * are undocumented but stable across Substack publications.
 *
 * Output shape MUST match the IncomingPost interface in spontaneous-order.ts:
 *   { title, url, html, author?, publishedAt?, excerpt?, tags? }
 *
 * No authentication. Public publication, public API.
 *
 * Usage:
 *   tsx scripts/ingest/spontaneous-order-fetch.ts \
 *     [--out ./backlog.json] \
 *     [--base https://www.spontaneousorder.in] \
 *     [--rate 1] \
 *     [--limit N] \
 *     [--skip-from-dir src/content/external/spontaneous-order] \
 *     [--dry-run]
 *
 * Resumable: any slug already in --out OR present as <slug>.mdx in
 * --skip-from-dir is skipped. To force a full re-fetch, delete the output
 * file (or run with a fresh --out path).
 *
 * Verification: after the crawl, fetches /sitemap.xml (recursing into a
 * sitemap-index if encountered), extracts post slugs, and compares to the
 * slug set in the backlog. Any sitemap slug missing from the backlog causes
 * a non-zero exit so CI fails loudly. --dry-run skips this step.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { logStep, logWarn, parseArgs, slugify } from './lib';

interface IncomingPost {
  title: string;
  url: string;
  html: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  tags?: string[];
}

const USER_AGENT =
  'liberty-lighthouse-fetcher/1.0 (+https://liberty-lighthouse.vercel.app)';

interface ArchiveItem {
  // The fields we actually rely on. Substack returns more; we only read what
  // we need so a schema drift in unrelated fields doesn't break the script.
  slug: string;
  canonical_url?: string;
  title?: string;
  audience?: string;
}

interface PostDetail {
  title?: string;
  slug?: string;
  canonical_url?: string;
  body_html?: string;
  post_date?: string;
  publishedBylines?: Array<{ name?: string; handle?: string }>;
  byline?: string;
  subtitle?: string;
  description?: string;
  postTags?: Array<{ name?: string; slug?: string }>;
  post_tags?: Array<{ name?: string; slug?: string }>;
}

function slugFromUrl(u: string): string | null {
  try {
    const parsed = new URL(u);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    return last ? slugify(last) : null;
  } catch {
    return null;
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJSON(url: string): Promise<any> {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!r.ok) {
    throw new Error(`GET ${url} → ${r.status} ${r.statusText}`);
  }
  return r.json();
}

async function getText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) {
    throw new Error(`GET ${url} → ${r.status} ${r.statusText}`);
  }
  return r.text();
}

function mapToIncoming(detail: PostDetail, fallbackBase: string): IncomingPost | null {
  const slug = detail.slug ?? (detail.canonical_url ? slugFromUrl(detail.canonical_url) : null);
  if (!slug) return null;
  const url = detail.canonical_url ?? `${fallbackBase}/p/${slug}`;
  const html = detail.body_html ?? '';
  const title = detail.title ?? slug;

  const author =
    detail.byline ??
    (detail.publishedBylines && detail.publishedBylines[0]?.name) ??
    undefined;
  const publishedAt = detail.post_date ?? undefined;

  const tags = (detail.postTags ?? detail.post_tags ?? [])
    .map((t) => t?.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  const excerptRaw = detail.subtitle ?? detail.description ?? '';
  const excerpt = stripHtml(excerptRaw).slice(0, 280) || undefined;

  const post: IncomingPost = { title, url, html };
  if (author) post.author = author;
  if (publishedAt) post.publishedAt = publishedAt;
  if (excerpt) post.excerpt = excerpt;
  if (tags.length) post.tags = tags;
  return post;
}

async function buildSkipSet(opts: {
  outFile: string;
  skipFromDir: string | null;
}): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const raw = await readFile(opts.outFile, 'utf8');
    const items = JSON.parse(raw) as IncomingPost[];
    for (const item of items) {
      const slug = slugFromUrl(item.url);
      if (slug) set.add(slug);
    }
  } catch {
    // missing or invalid file — empty contribution
  }
  if (opts.skipFromDir) {
    try {
      const entries = await readdir(opts.skipFromDir);
      for (const e of entries) {
        if (e.endsWith('.mdx')) set.add(e.replace(/\.mdx$/, ''));
      }
    } catch {
      // dir doesn't exist — empty contribution
    }
  }
  return set;
}

async function fetchArchivePage(
  base: string,
  offset: number,
  limit: number,
): Promise<ArchiveItem[]> {
  const url = `${base}/api/v1/archive?sort=new&limit=${limit}&offset=${offset}`;
  const data = await getJSON(url);
  if (!Array.isArray(data)) {
    throw new Error(`Archive at offset ${offset} did not return an array.`);
  }
  return data as ArchiveItem[];
}

async function fetchPost(base: string, slug: string): Promise<PostDetail> {
  return getJSON(`${base}/api/v1/posts/${slug}`);
}

async function extractSlugsFromSitemap(base: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  const seen = new Set<string>();

  async function walk(url: string) {
    if (seen.has(url)) return;
    seen.add(url);
    let xml: string;
    try {
      xml = await getText(url);
    } catch (err) {
      logWarn(`sitemap fetch failed: ${url} (${(err as Error).message})`);
      return;
    }
    // Sitemap-index: contains <sitemap><loc>...</loc></sitemap> entries.
    const isIndex = /<sitemapindex[\s>]/i.test(xml);
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) =>
      m[1].trim(),
    );
    if (isIndex) {
      for (const loc of locs) {
        await walk(loc);
      }
      return;
    }
    // Regular sitemap: each <loc> is a content URL. Filter to /p/<slug>.
    for (const loc of locs) {
      const slug = slugFromPostUrl(loc);
      if (slug) slugs.add(slug);
    }
  }

  await walk(`${base}/sitemap.xml`);
  return slugs;
}

function slugFromPostUrl(u: string): string | null {
  try {
    const parsed = new URL(u);
    const parts = parsed.pathname.split('/').filter(Boolean);
    // Substack post URLs: /p/<slug>
    if (parts.length >= 2 && parts[0] === 'p') return slugify(parts[1]);
    return null;
  } catch {
    return null;
  }
}

async function writeAtomic(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, text, 'utf8');
  // Rename is atomic on the same filesystem.
  const { rename } = await import('node:fs/promises');
  await rename(tmp, path);
}

async function loadExistingBacklog(path: string): Promise<IncomingPost[]> {
  try {
    const raw = await readFile(path, 'utf8');
    const items = JSON.parse(raw);
    if (Array.isArray(items)) return items as IncomingPost[];
  } catch {}
  return [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base =
    typeof args.base === 'string'
      ? (args.base as string).replace(/\/$/, '')
      : 'https://www.spontaneousorder.in';
  const outArg = typeof args.out === 'string' ? (args.out as string) : './backlog.json';
  const out = resolve(process.cwd(), outArg);
  const skipFromDirArg =
    typeof args['skip-from-dir'] === 'string' ? (args['skip-from-dir'] as string) : null;
  const skipFromDir = skipFromDirArg ? resolve(process.cwd(), skipFromDirArg) : null;
  const rate = typeof args.rate === 'string' ? parseFloat(args.rate as string) : 1;
  const limit =
    typeof args.limit === 'string' ? parseInt(args.limit as string, 10) : Infinity;
  const dryRun = Boolean(args['dry-run']);
  const archivePageSize = 50;

  const delayMs = rate > 0 ? Math.max(0, Math.floor(1000 / rate)) : 0;

  logStep(`base: ${base}`);
  logStep(`out: ${out}`);
  if (skipFromDir) logStep(`skip-from-dir: ${skipFromDir}`);
  logStep(`rate: ${rate} req/s (${delayMs} ms between requests)`);
  if (Number.isFinite(limit)) logStep(`limit: ${limit}`);
  if (dryRun) logStep('mode: DRY RUN — no write, no sitemap verify');

  if (dryRun) {
    logStep(`fetching archive page offset=0`);
    const page = await fetchArchivePage(base, 0, archivePageSize);
    if (page.length === 0) {
      logWarn('archive empty at offset 0. Nothing to verify.');
      return;
    }
    const first = page[0];
    const firstSlug = first.slug ?? (first.canonical_url ? slugFromUrl(first.canonical_url) : null);
    if (!firstSlug) {
      throw new Error('first archive item has no resolvable slug');
    }
    logStep(`fetching post detail for slug=${firstSlug}`);
    const detail = await fetchPost(base, firstSlug);
    const mapped = mapToIncoming(detail, base);
    if (!mapped) {
      throw new Error('first post could not be mapped to IncomingPost');
    }
    // Truncate the html field for readability — full body would dominate the output.
    const preview = {
      ...mapped,
      html:
        mapped.html.length > 500
          ? mapped.html.slice(0, 500) + `\n... [truncated, ${mapped.html.length} chars total]`
          : mapped.html,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(preview, null, 2));
    logStep('dry run complete.');
    return;
  }

  // Real run.
  const skipSet = await buildSkipSet({ outFile: out, skipFromDir });
  logStep(`skip set has ${skipSet.size} slug(s).`);

  const existing = await loadExistingBacklog(out);
  const knownSlugs = new Set(existing.map((p) => slugFromUrl(p.url)).filter(Boolean) as string[]);
  const collected: IncomingPost[] = [...existing];

  // Walk archive pages.
  let offset = 0;
  let added = 0;
  let processed = 0;
  outer: while (true) {
    let page: ArchiveItem[];
    try {
      page = await fetchArchivePage(base, offset, archivePageSize);
    } catch (err) {
      logWarn(`archive page offset=${offset} failed: ${(err as Error).message}`);
      break;
    }
    if (page.length === 0) {
      logStep(`archive exhausted at offset=${offset}`);
      break;
    }
    logStep(`archive page offset=${offset} has ${page.length} item(s)`);

    for (const item of page) {
      if (added >= limit) break outer;
      const slug = item.slug ?? (item.canonical_url ? slugFromUrl(item.canonical_url) : null);
      if (!slug) {
        logWarn(`archive item has no slug, skipping: ${JSON.stringify(item).slice(0, 120)}`);
        continue;
      }
      if (skipSet.has(slug) || knownSlugs.has(slug)) {
        continue;
      }
      processed++;
      try {
        if (delayMs) await sleep(delayMs);
        const detail = await fetchPost(base, slug);
        const post = mapToIncoming(detail, base);
        if (!post) {
          logWarn(`could not map post slug=${slug}`);
          continue;
        }
        collected.push(post);
        knownSlugs.add(slug);
        added++;
        logStep(`+ ${slug} (${added} new)`);
      } catch (err) {
        logWarn(`fetch failed for slug=${slug}: ${(err as Error).message}`);
      }
    }
    offset += archivePageSize;
  }

  if (added > 0) {
    await writeAtomic(out, JSON.stringify(collected, null, 2));
    logStep(`wrote ${out} (${collected.length} total entries; ${added} new)`);
  } else {
    logStep(`nothing new. ${collected.length} entries already on disk.`);
  }
  logStep(`processed ${processed} fetch attempts.`);

  // Verification: compare backlog slugs to sitemap slugs.
  logStep(`verifying against ${base}/sitemap.xml`);
  const sitemapSlugs = await extractSlugsFromSitemap(base);
  logStep(`sitemap has ${sitemapSlugs.size} post URL(s).`);

  const backlogSlugs = new Set(collected.map((p) => slugFromUrl(p.url)).filter(Boolean) as string[]);

  // skipFromDir contributes to the "we already have this" set for verification.
  const haveSet = new Set([...backlogSlugs, ...skipSet]);
  const missing: string[] = [];
  for (const s of sitemapSlugs) {
    if (!haveSet.has(s)) missing.push(s);
  }

  if (missing.length === 0) {
    logStep(`verification OK. All ${sitemapSlugs.size} sitemap slugs present.`);
  } else {
    logWarn(`verification FAILED. ${missing.length} slug(s) in sitemap but not in backlog or content dir:`);
    for (const s of missing.slice(0, 50)) logWarn(`  missing: ${s}`);
    if (missing.length > 50) logWarn(`  ... and ${missing.length - 50} more`);
    process.exit(2);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
