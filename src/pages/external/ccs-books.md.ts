import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import { abs, ccsBookMdPath, markdownResponse } from '../../lib/markdown-export';

export const GET: APIRoute = async () => {
  const entries = await getCollection('ccsBooks');

  // Group chapters by book.
  const books = new Map<
    string,
    {
      slug: string;
      title: string;
      author?: string;
      year?: number;
      chapters: Awaited<ReturnType<typeof getCollection<'ccsBooks'>>>;
    }
  >();
  for (const entry of entries) {
    if (!books.has(entry.data.book_slug)) {
      books.set(entry.data.book_slug, {
        slug: entry.data.book_slug,
        title: entry.data.book_title,
        author: entry.data.author,
        year: entry.data.publication_year,
        chapters: [],
      });
    }
    books.get(entry.data.book_slug)!.chapters.push(entry);
  }
  for (const book of books.values()) {
    book.chapters.sort((a, b) => (a.data.chapter_number ?? 0) - (b.data.chapter_number ?? 0));
  }

  const fm = {
    type: 'external_source_index',
    source: 'ccs-books',
    title: 'CCS Books',
    description: 'Books published by the Centre for Civil Society, mirrored chapter-by-chapter for agent ingestion.',
    markdown_url: abs('/external/ccs-books.md'),
    book_count: books.size,
    chapter_count: entries.length,
  };

  const lines: string[] = [
    '# CCS Books',
    '',
    '> Books published by the Centre for Civil Society. Mirrored chapter-by-chapter for agent ingestion.',
    '',
  ];
  if (books.size === 0) {
    lines.push(
      '_No books ingested yet. The importer at `scripts/ingest/book.ts` will populate this once books are provided._',
      '',
    );
  } else {
    for (const book of books.values()) {
      const meta: string[] = [];
      if (book.author) meta.push(book.author);
      if (book.year) meta.push(String(book.year));
      const suffix = meta.length ? ` — ${meta.join(', ')}` : '';
      lines.push(`## ${book.title}${suffix}`, '');
      for (const ch of book.chapters) {
        const num = ch.data.chapter_number !== undefined ? `${ch.data.chapter_number}. ` : '';
        lines.push(`- ${num}[${ch.data.chapter_title}](${abs(ccsBookMdPath(ch))})`);
      }
      lines.push('');
    }
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
