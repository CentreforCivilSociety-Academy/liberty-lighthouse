import type { APIRoute } from 'astro';
import { abs, glossaryHtmlPath, plainTextResponse } from '../../lib/markdown-export';
import { getAllGlossary } from '../../lib/collections';

export const GET: APIRoute = async () => {
  const entries = await getAllGlossary();

  const lines: string[] = [
    '# Liberty Lighthouse — Glossary',
    '',
    '> Definitions of policy, economics, and civil-society terms used across Liberty Lighthouse, with cross-references and recommended reading.',
    '',
    `Source: ${abs('/glossary/')}`,
    `Markdown index: ${abs('/glossary.md')}`,
    '',
  ];

  for (const entry of entries) {
    lines.push(`## ${entry.data.term}`, '', `Source: ${abs(glossaryHtmlPath(entry))}`, '');
    if (entry.data.aliases.length) {
      lines.push(`*Also known as: ${entry.data.aliases.join(', ')}*`, '');
    }
    lines.push(entry.data.definition, '');
    if (entry.body && entry.body.trim()) lines.push(entry.body.trim(), '');
    if (entry.data.citations.length) {
      lines.push('**Recommended reading:**', '');
      for (const c of entry.data.citations) {
        const author = c.author ? ` — ${c.author}` : '';
        lines.push(`- [${c.title}](${c.url})${author}`);
      }
      lines.push('');
    }
  }

  return plainTextResponse(lines.join('\n'));
};
