import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, plainTextResponse } from '../../../lib/markdown-export';

export const GET: APIRoute = async () => {
  const entries = await getCollection('ccsBooks');
  // Group by book.
  const books = new Map<string, Awaited<ReturnType<typeof getCollection<'ccsBooks'>>>>();
  for (const entry of entries) {
    if (!books.has(entry.data.book_slug)) books.set(entry.data.book_slug, []);
    books.get(entry.data.book_slug)!.push(entry);
  }
  for (const chapters of books.values()) {
    chapters.sort((a, b) => (a.data.chapter_number ?? 0) - (b.data.chapter_number ?? 0));
  }

  const lines: string[] = [
    '# CCS Books — Full Content',
    '',
    '> Books published by the Centre for Civil Society, mirrored chapter-by-chapter.',
    '',
    `Markdown index: ${abs('/external/ccs-books.md')}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('_No books ingested yet._', '');
  } else {
    for (const [, chapters] of books) {
      const first = chapters[0];
      lines.push(`# ${first.data.book_title}`, '');
      const meta: string[] = [];
      if (first.data.author) meta.push(`Author: ${first.data.author}`);
      if (first.data.publisher) meta.push(`Publisher: ${first.data.publisher}`);
      if (first.data.publication_year) meta.push(`Year: ${first.data.publication_year}`);
      if (meta.length) lines.push(meta.join(' · '), '');

      for (const ch of chapters) {
        const num = ch.data.chapter_number !== undefined ? `Chapter ${ch.data.chapter_number}: ` : '';
        lines.push(`## ${num}${ch.data.chapter_title}`, '');
        if (ch.body?.trim()) lines.push(ch.body.trim(), '');
      }
    }
  }

  return plainTextResponse(lines.join('\n'));
};
