#!/usr/bin/env -S tsx
/**
 * Regenerate the LLM-synthesised wiki layer at src/content/wiki/.
 *
 * Workflow (Karpathy "compounding artifact"):
 *   1. Hash every source file in faqs/, videos/, glossary/, and external/.
 *   2. Read existing wiki entries; their `source_hashes` frontmatter records
 *      which sources each entry was synthesised from and at what version.
 *   3. Compute the set of *changed* sources (new, modified, deleted).
 *   4. For each changed source, ask the LLM (via OpenRouter) to extract or
 *      update the entity pages this source contributes to.
 *   5. Write/update wiki MDX files. Hash-skip means unchanged sources cost
 *      zero LLM calls — token spend grows with churn, not corpus size.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... tsx scripts/ingest/wiki-regen.ts \
 *     [--source faqs|videos|glossary|spontaneous-order|ccs-books|all] \
 *     [--limit N] \
 *     [--model x-ai/grok-4.1-fast] \
 *     [--dry-run]
 *
 * SCAFFOLD STATUS: This script has the hash-skip + file I/O wired up.
 * The LLM call is intentionally a placeholder — see the `synthesise()`
 * function below. When the user is ready to enable wiki regen, swap in
 * the real OpenRouter call there.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import {
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
const SOURCE_DIRS: Record<string, string> = {
  faqs: 'src/content/faqs',
  videos: 'src/content/videos',
  glossary: 'src/content/glossary',
  'spontaneous-order': 'src/content/external/spontaneous-order',
  'ccs-books': 'src/content/external/ccs-books',
};
const WIKI_DIR = join(ROOT, 'src/content/wiki');

interface SourceFile {
  collection: string;
  id: string;
  hash: string;
  path: string;
}

async function collectSources(filter: string): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  const wanted =
    filter === 'all' ? Object.keys(SOURCE_DIRS) : [filter];
  for (const collection of wanted) {
    const rel = SOURCE_DIRS[collection];
    if (!rel) {
      logWarn(`unknown source: ${collection}`);
      continue;
    }
    const dir = join(ROOT, rel);
    const hashes = await loadFrontmatterHashes(dir);
    // For sources without source_hash in frontmatter (e.g. internal collections
    // we authored by hand), hash the raw file content instead.
    const idsSeen = new Set(hashes.keys());
    for (const [id, hash] of hashes) {
      out.push({ collection, id, hash, path: join(dir, `${id}.mdx`) });
    }
    // Note: this scaffold does not walk the directory for files missing
    // source_hash. The wiki regen on the internal corpus would need to
    // hash file contents directly — left as a TODO until the LLM call lands.
    if (idsSeen.size === 0) {
      logStep(`(${collection}: no source_hash entries — internal-corpus hashing is a TODO)`);
    }
  }
  return out;
}

interface WikiEntry {
  type: 'entity' | 'topic_summary' | 'comparison';
  slug: string;
  name: string;
  description: string;
  body: string;
  related_terms?: string[];
  related_faqs?: string[];
  sources: string[];
}

/**
 * Placeholder: synthesise wiki entries from a source file.
 *
 * Real implementation should:
 *   - Load OpenRouter API key from env (OPENROUTER_API_KEY).
 *   - POST to https://openrouter.ai/api/v1/chat/completions with a system
 *     prompt asking for a JSON array of WikiEntry objects.
 *   - Parse, validate, and return.
 *
 * Until that's wired up, this stub returns [] so the rest of the pipeline
 * (hash-skip, file I/O) can be exercised end-to-end without spending tokens.
 */
async function synthesise(
  source: SourceFile,
  _model: string,
  apiKey: string | undefined,
): Promise<WikiEntry[]> {
  if (!apiKey) {
    logStep(`(no OPENROUTER_API_KEY set — skipping LLM synthesis for ${source.collection}/${source.id})`);
    return [];
  }
  // TODO: implement OpenRouter call. See scripts/ingest/README.md for the
  // prompt design once finalised.
  logStep(`(synthesise stub — would call LLM for ${source.collection}/${source.id})`);
  return [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filter = (args.source as string) || 'all';
  const limit =
    typeof args.limit === 'string' ? parseInt(args.limit as string, 10) : Infinity;
  const model =
    (args.model as string) || process.env.OPENROUTER_MODEL || 'x-ai/grok-4.1-fast';
  const dryRun = Boolean(args['dry-run']);
  const apiKey = process.env.OPENROUTER_API_KEY;

  logStep(`source filter: ${filter}, limit: ${limit}, model: ${model}, dry-run: ${dryRun}`);

  const sources = await collectSources(filter);
  if (sources.length === 0) {
    logStep('no sources found. nothing to do.');
    return;
  }

  // Load existing wiki entries and their source_hashes.
  const existingByPath = new Map<
    string,
    { fm: Record<string, unknown>; body: string }
  >();
  await walkMdx(WIKI_DIR, async (path) => {
    const raw = await readFile(path, 'utf8');
    const parsed = matter(raw);
    existingByPath.set(path, { fm: parsed.data, body: parsed.content });
  });

  // Build a "this source is referenced by these wiki pages" reverse index.
  const referencedBy = new Map<string, Set<string>>();
  for (const [path, { fm }] of existingByPath) {
    const hashes = (fm.source_hashes ?? {}) as Record<string, string>;
    for (const sourceKey of Object.keys(hashes)) {
      if (!referencedBy.has(sourceKey)) referencedBy.set(sourceKey, new Set());
      referencedBy.get(sourceKey)!.add(path);
    }
  }

  let processed = 0;
  let synthesised = 0;
  for (const source of sources) {
    if (processed >= limit) break;
    const sourceKey = `${source.collection}/${source.id}`;
    const referencingPages = referencedBy.get(sourceKey) ?? new Set();

    // Hash-skip: if every wiki page that references this source already has
    // the matching hash recorded, this source is up-to-date.
    let allUpToDate = referencingPages.size > 0;
    for (const wikiPath of referencingPages) {
      const fm = existingByPath.get(wikiPath)!.fm;
      const hashes = (fm.source_hashes ?? {}) as Record<string, string>;
      if (hashes[sourceKey] !== source.hash) {
        allUpToDate = false;
        break;
      }
    }
    if (allUpToDate) {
      processed++;
      continue;
    }

    processed++;
    const entries = await synthesise(source, model, apiKey);
    for (const entry of entries) {
      const slug = slugify(entry.slug || entry.name);
      const filePath = join(WIKI_DIR, `${slug}.mdx`);

      // Merge: if a wiki page already exists for this slug, update its
      // source_hashes; otherwise create a new one.
      const existing = existingByPath.get(filePath);
      const sourceHashes = ((existing?.fm.source_hashes ?? {}) as Record<string, string>);
      sourceHashes[sourceKey] = source.hash;
      const sources_list = Array.from(
        new Set([...(existing?.fm.sources as string[] ?? []), sourceKey, ...(entry.sources ?? [])]),
      );

      const fm: Record<string, unknown> = {
        type: entry.type,
        name: entry.name,
        description: entry.description,
        sources: sources_list,
        related_terms: entry.related_terms ?? [],
        related_faqs: entry.related_faqs ?? [],
        last_regen: todayIso(),
        source_hashes: sourceHashes,
      };

      if (dryRun) {
        logStep(`would write ${filePath}`);
      } else {
        await writeMdxFile(filePath, { frontmatter: fm, body: entry.body });
        logStep(`wrote ${filePath}`);
      }
      synthesised++;
    }
  }

  logStep(`done. processed ${processed} sources, synthesised ${synthesised} wiki entries.`);
}

async function walkMdx(dir: string, onFile: (path: string) => Promise<void>): Promise<void> {
  const { readdir } = await import('node:fs/promises');
  let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walkMdx(full, onFile);
    else if (e.isFile() && full.endsWith('.mdx')) await onFile(full);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
