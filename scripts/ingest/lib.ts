import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';

// Shared helpers for all ingestion scripts in scripts/ingest/.

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// Lazy-loaded turndown so this lib doesn't error at import time if the dep
// hasn't been installed yet. Returns null if turndown isn't available.
let _turndown: any = null;
export async function htmlToMarkdown(html: string): Promise<string> {
  if (!html || !html.trim()) return '';
  if (!_turndown) {
    const mod = await import('turndown').catch(() => null);
    if (!mod) {
      throw new Error('turndown is not installed. Run `npm install` first.');
    }
    const TurndownService = (mod as any).default ?? mod;
    _turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-',
    });
  }
  return _turndown.turndown(html).trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface MdxFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

export async function writeMdxFile(filePath: string, file: MdxFile): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const text = matter.stringify(file.body.trimEnd() + '\n', file.frontmatter);
  await writeFile(filePath, text, 'utf8');
}

// Read every .mdx file in a directory tree and return { id -> source_hash }
// based on the source_hash frontmatter field. Used for change detection in
// the RSS poller and wiki regen scripts.
export async function loadFrontmatterHashes(rootDir: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await walk(rootDir, async (filePath, relPath) => {
    if (!filePath.endsWith('.mdx')) return;
    const raw = await readFile(filePath, 'utf8');
    const { data } = matter(raw);
    if (typeof data.source_hash === 'string') {
      const id = relPath.replace(/\.mdx$/, '');
      map.set(id, data.source_hash);
    }
  });
  return map;
}

async function walk(
  dir: string,
  onFile: (filePath: string, relPath: string) => Promise<void>,
  base = dir,
): Promise<void> {
  let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = full.slice(base.length + 1);
    if (entry.isDirectory()) {
      await walk(full, onFile, base);
    } else if (entry.isFile()) {
      await onFile(full, rel);
    }
  }
}

export function todayIso(): string {
  return new Date().toISOString();
}

export function logStep(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log('[ingest]', ...args);
}

export function logWarn(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.warn('[ingest]', ...args);
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}
