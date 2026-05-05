import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, plainTextResponse, wikiHtmlPath } from '../../lib/markdown-export';

export const GET: APIRoute = async () => {
  const entries = (await getCollection('wiki', ({ data }) => !data.draft)).sort((a, b) =>
    a.data.name.localeCompare(b.data.name, undefined, { sensitivity: 'base' }),
  );

  const lines: string[] = [
    '# Liberty Lighthouse — Wiki Full Content',
    '',
    '> All wiki entries (entities, topic summaries, comparisons) synthesised from the corpus by an LLM, in one file.',
    '',
    `Markdown index: ${abs('/wiki.md')}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('_No wiki entries yet._', '');
  } else {
    for (const entry of entries) {
      lines.push(`## ${entry.data.name} (${entry.data.type})`, '', `Source: ${abs(wikiHtmlPath(entry))}`, '');
      lines.push(entry.data.description, '');
      if (entry.body?.trim()) lines.push(entry.body.trim(), '');
      if (entry.data.sources.length) {
        lines.push('**Synthesised from:**', '');
        for (const s of entry.data.sources) lines.push(`- ${s}`);
        lines.push('');
      }
    }
  }

  return plainTextResponse(lines.join('\n'));
};
