import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import {
  abs,
  glossaryMdPath,
  markdownResponse,
} from '../lib/markdown-export';
import { getAllGlossary } from '../lib/collections';

export const GET: APIRoute = async () => {
  const entries = await getAllGlossary();

  const fm = {
    type: 'glossary_index',
    title: 'Glossary',
    canonical_url: abs('/glossary/'),
    markdown_url: abs('/glossary.md'),
    term_count: entries.length,
  };

  const lines: string[] = [
    '# Glossary',
    '',
    'Definitions of policy, economics, and civil-society terms used across Liberty Lighthouse.',
    '',
  ];
  if (entries.length === 0) {
    lines.push('_No glossary entries yet._', '');
  } else {
    for (const entry of entries) {
      const aliases = entry.data.aliases.length ? ` *(also: ${entry.data.aliases.join(', ')})*` : '';
      lines.push(`- [${entry.data.term}](${abs(glossaryMdPath(entry))})${aliases} — ${entry.data.definition}`);
    }
    lines.push('');
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
