import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import { abs, markdownResponse, wikiMdPath } from '../lib/markdown-export';

export const GET: APIRoute = async () => {
  const entries = (await getCollection('wiki', ({ data }) => !data.draft)).sort((a, b) =>
    a.data.name.localeCompare(b.data.name, undefined, { sensitivity: 'base' }),
  );

  const fm = {
    type: 'wiki_index',
    title: 'Wiki',
    description:
      "Auto-generated entity pages, topic summaries, and comparisons synthesised from the Liberty Lighthouse corpus.",
    canonical_url: abs('/wiki/'),
    markdown_url: abs('/wiki.md'),
    entry_count: entries.length,
  };

  const lines: string[] = [
    '# Wiki',
    '',
    "> Auto-generated entity pages, topic summaries, and comparisons synthesised from the Liberty Lighthouse corpus by an LLM and refreshed in CI. Karpathy-style compounding wiki layer.",
    '',
  ];
  if (entries.length === 0) {
    lines.push(
      '_No wiki entries yet. The regeneration workflow at `.github/workflows/wiki-regen.yml` will populate this once configured._',
      '',
    );
  } else {
    const types: Array<['entity' | 'topic_summary' | 'comparison', string]> = [
      ['entity', 'Entities'],
      ['topic_summary', 'Topic summaries'],
      ['comparison', 'Comparisons'],
    ];
    for (const [type, heading] of types) {
      const subset = entries.filter((e) => e.data.type === type);
      if (subset.length === 0) continue;
      lines.push(`## ${heading}`, '');
      for (const e of subset) {
        lines.push(`- [${e.data.name}](${abs(wikiMdPath(e))}) — ${e.data.description}`);
      }
      lines.push('');
    }
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
