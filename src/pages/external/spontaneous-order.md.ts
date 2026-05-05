import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import { abs, markdownResponse, spontaneousOrderMdPath } from '../../lib/markdown-export';

export const GET: APIRoute = async () => {
  const entries = (await getCollection('spontaneousOrder')).sort(
    (a, b) => (b.data.published_at || '').localeCompare(a.data.published_at || ''),
  );

  const fm = {
    type: 'external_source_index',
    source: 'spontaneous-order',
    title: 'Spontaneous Order',
    description:
      "Posts from Spontaneous Order, the Centre for Civil Society's Substack on Indian classical-liberal thought.",
    canonical_url: 'https://spontaneousorder.in/',
    markdown_url: abs('/external/spontaneous-order.md'),
    post_count: entries.length,
  };

  const lines: string[] = [
    '# Spontaneous Order',
    '',
    "> Posts from Spontaneous Order, the Centre for Civil Society's Substack on Indian classical-liberal thought. Mirrored here for agent ingestion only — original posts at <https://spontaneousorder.in/>.",
    '',
  ];
  if (entries.length === 0) {
    lines.push(
      '_No posts ingested yet. The RSS workflow at `.github/workflows/rss-ingest.yml` and the importer at `scripts/ingest/spontaneous-order.ts` will populate this once configured._',
      '',
    );
  } else {
    for (const entry of entries) {
      const date = entry.data.published_at?.slice(0, 10) ?? '';
      const author = entry.data.author ? ` — ${entry.data.author}` : '';
      lines.push(`- [${entry.data.title}](${abs(spontaneousOrderMdPath(entry))}) (${date}${author})`);
    }
    lines.push('');
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
