#!/usr/bin/env -S tsx
/**
 * Ingest a CCS book chapter-by-chapter into src/content/external/ccs-books/.
 *
 * Usage:
 *   tsx scripts/ingest/book.ts \
 *     --book-slug freedom-and-classical-liberalism \
 *     --book-title "Freedom and Classical Liberalism" \
 *     --author "Parth Shah" \
 *     --year 2018 \
 *     --source <path-to-book>
 *
 * Source format (TBD when first book arrives — current scaffold supports a
 * JSON manifest):
 *   { "chapters": [
 *       { "number": 1, "title": "Introduction", "html": "<p>...</p>" },
 *       ...
 *     ]
 *   }
 *
 * Emits one .mdx per chapter at:
 *   src/content/external/ccs-books/<book-slug>/<chapter-slug>.mdx
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  htmlToMarkdown,
  loadEnv,
  logStep,
  logWarn,
  parseArgs,
  sha256,
  slugify,
  todayIso,
  writeMdxFile,
} from './lib';

const ROOT = resolve(process.cwd());
const OUT_BASE = join(ROOT, 'src/content/external/ccs-books');

interface IncomingChapter {
  number?: number;
  title: string;
  html: string;
}

interface BookManifest {
  chapters: IncomingChapter[];
}

async function main() {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const bookSlug = args['book-slug'];
  const bookTitle = args['book-title'];
  const author = typeof args.author === 'string' ? (args.author as string) : undefined;
  const year =
    typeof args.year === 'string' ? parseInt(args.year as string, 10) : undefined;
  const sourcePath = args.source;
  const publisher =
    typeof args.publisher === 'string' ? (args.publisher as string) : 'Centre for Civil Society';
  const dryRun = Boolean(args['dry-run']);

  if (typeof bookSlug !== 'string' || typeof bookTitle !== 'string' || typeof sourcePath !== 'string') {
    logWarn('Required: --book-slug, --book-title, --source <path-to-manifest-json>');
    process.exit(1);
  }

  const text = await readFile(sourcePath, 'utf8');
  const manifest = JSON.parse(text) as BookManifest;

  if (!Array.isArray(manifest.chapters)) {
    throw new Error('Manifest must have a `chapters` array.');
  }

  const outDir = join(OUT_BASE, bookSlug);
  let written = 0;
  for (const ch of manifest.chapters) {
    const chapterSlug = slugify(ch.title || `chapter-${ch.number ?? written + 1}`);
    const body = await htmlToMarkdown(ch.html);
    const fm: Record<string, unknown> = {
      book_slug: bookSlug,
      book_title: bookTitle,
      chapter_title: ch.title,
      publisher,
      ingested_at: todayIso(),
      source_hash: sha256(ch.html || ch.title),
    };
    if (ch.number !== undefined) fm.chapter_number = ch.number;
    if (author) fm.author = author;
    if (year) fm.publication_year = year;

    const filePath = join(outDir, `${chapterSlug}.md`);
    if (dryRun) {
      logStep(`would write ${filePath} (${body.length} chars body)`);
    } else {
      await writeMdxFile(filePath, { frontmatter: fm, body });
      logStep(`wrote ${filePath}`);
    }
    written++;
  }

  logStep(`done. ${written} chapters written for ${bookTitle}.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
