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
  loadEnv,
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

async function walkMdxFiles(
  dir: string,
  onFile: (filePath: string, relPath: string) => Promise<void>,
  base = dir,
): Promise<void> {
  const { readdir } = await import('node:fs/promises');
  let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = full.slice(base.length + 1);
    if (e.isDirectory()) await walkMdxFiles(full, onFile, base);
    else if (e.isFile() && (full.endsWith('.mdx') || full.endsWith('.md'))) {
      await onFile(full, rel);
    }
  }
}

async function collectSources(filter: string): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  const wanted = filter === 'all' ? Object.keys(SOURCE_DIRS) : [filter];
  const { readFile } = await import('node:fs/promises');

  for (const collection of wanted) {
    const rel = SOURCE_DIRS[collection];
    if (!rel) {
      logWarn(`unknown source: ${collection}`);
      continue;
    }
    const dir = join(ROOT, rel);
    const fmHashes = await loadFrontmatterHashes(dir);

    let count = 0;
    await walkMdxFiles(dir, async (path, relPath) => {
      const id = relPath.replace(/\.mdx?$/, '');
      const fmHash = fmHashes.get(id);
      // Prefer the source_hash recorded by the ingester (which hashes the
      // upstream HTML, so it survives reformatting). Fall back to hashing the
      // local file contents for hand-authored sources.
      const hash = fmHash ?? sha256(await readFile(path, 'utf8'));
      out.push({ collection, id, hash, path });
      count++;
    });

    logStep(`${collection}: ${count} source file(s)`);
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

const SYNTH_SYSTEM_PROMPT = `You are an autonomous wiki-builder for Liberty Lighthouse, a classical-liberal public-education project by the Centre for Civil Society in India. Your job is to read one source document at a time and propose distinct WIKI ENTITY pages — concepts, persons, institutions, policies, or events that deserve a standalone wiki entry because they appear (or are likely to appear) across multiple sources in the corpus.

Output a JSON array of entity objects. Schema for each:
{
  "slug": "kebab-case-slug",   // unique, stable across runs
  "name": "Canonical Name",     // human-readable
  "type": "entity",             // always "entity" for now
  "description": "One sentence (max 200 chars).",
  "body": "200-400 word markdown summary, neutral tone, no editorial framing beyond what the source provides.",
  "related_terms": ["related-glossary-slug-1", ...],   // optional
  "related_faqs": ["topic/faq-slug", ...]              // optional
}

Hard rules:
- Output ONLY a JSON array. No prose before or after. No markdown code fences.
- Do NOT propose entity pages for trivial mentions. Each entity should be substantive enough that an agent looking for it would expect a dedicated page.
- Aim for 0–4 entities per source. A source can legitimately produce zero.
- Body must be self-contained: an agent reading just the body should understand what the entity is.
- Slugs are kebab-case English, ASCII-only.
- Do not invent facts. If a source mentions an entity in passing without enough detail to write 200 words, skip it.

If the source contributes no new entities, return: []`;

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

async function readSourceText(source: SourceFile): Promise<string> {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(source.path, 'utf8');
    const matter = (await import('gray-matter')).default;
    const parsed = matter(raw);
    const fmText = JSON.stringify(parsed.data, null, 2);
    return `Source: ${source.collection}/${source.id}\n\n# Frontmatter\n${fmText}\n\n# Body\n${parsed.content}`;
  } catch (err) {
    logWarn(`could not read source ${source.path}: ${(err as Error).message}`);
    return '';
  }
}

function parseSynthOutput(raw: string): WikiEntry[] {
  // Lenient parser: tolerate code fences, leading/trailing prose, and a
  // single object instead of an array (some models will return that even
  // when asked for an array).
  let text = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) text = fence[1].trim();

  let parsed: unknown = null;
  // Try array first.
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      parsed = JSON.parse(text.slice(arrStart, arrEnd + 1));
    } catch {}
  }
  // Fall back to a single object.
  if (parsed === null) {
    const objStart = text.indexOf('{');
    const objEnd = text.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      try {
        const obj = JSON.parse(text.slice(objStart, objEnd + 1));
        // The model may wrap in {entities: [...]} too.
        if (obj && Array.isArray(obj.entities)) parsed = obj.entities;
        else if (obj) parsed = [obj];
      } catch {}
    }
  }
  if (parsed === null) return [];
  const list = Array.isArray(parsed) ? parsed : [parsed];

  return list
    .filter(
      (e: any) =>
        e &&
        typeof e.slug === 'string' &&
        typeof e.name === 'string' &&
        typeof e.description === 'string' &&
        typeof e.body === 'string',
    )
    .map((e: any) => ({
      type: e.type === 'topic_summary' || e.type === 'comparison' ? e.type : 'entity',
      slug: String(e.slug),
      name: String(e.name),
      description: String(e.description),
      body: String(e.body),
      related_terms: Array.isArray(e.related_terms) ? e.related_terms.map(String) : [],
      related_faqs: Array.isArray(e.related_faqs) ? e.related_faqs.map(String) : [],
      sources: [],
    }));
}

async function synthesise(
  source: SourceFile,
  model: string,
  apiKey: string | undefined,
): Promise<WikiEntry[]> {
  if (!apiKey) {
    logStep(`(no OPENROUTER_API_KEY set — skipping LLM synthesis for ${source.collection}/${source.id})`);
    return [];
  }
  const sourceText = await readSourceText(source);
  if (!sourceText) return [];

  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://liberty-lighthouse.vercel.app',
      'X-Title': 'Liberty Lighthouse wiki-regen',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYNTH_SYSTEM_PROMPT },
        { role: 'user', content: sourceText },
      ],
      temperature: 0.2,
      // We want an array; json_object would coerce some providers to a single
      // object. Rely on the prompt instead and parse leniently.
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    logWarn(`OpenRouter ${r.status} for ${source.collection}/${source.id}: ${text.slice(0, 200)}`);
    return [];
  }
  const data = (await r.json()) as OpenRouterResponse;
  if (data.error) {
    logWarn(`OpenRouter error for ${source.collection}/${source.id}: ${data.error.message}`);
    return [];
  }
  const content = data.choices?.[0]?.message?.content ?? '';
  if (process.env.WIKI_REGEN_DEBUG) {
    logStep(`raw LLM response for ${source.collection}/${source.id}:`);
    // eslint-disable-next-line no-console
    console.log(content);
  }
  const entries = parseSynthOutput(content);
  if (entries.length === 0) {
    logStep(`(no entities synthesised from ${source.collection}/${source.id})`);
  }
  return entries;
}

async function main() {
  await loadEnv();
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
