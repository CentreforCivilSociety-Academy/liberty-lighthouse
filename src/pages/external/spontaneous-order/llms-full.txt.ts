import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, plainTextResponse, spontaneousOrderMdPath } from '../../../lib/markdown-export';

export const GET: APIRoute = async () => {
  const entries = (await getCollection('spontaneousOrder')).sort(
    (a, b) => (b.data.published_at || '').localeCompare(a.data.published_at || ''),
  );

  const lines: string[] = [
    '# Spontaneous Order — Full Content',
    '',
    "> Posts from Spontaneous Order, the Centre for Civil Society's Substack. Originals at <https://spontaneousorder.in/>.",
    '',
    `Markdown index: ${abs('/external/spontaneous-order.md')}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('_No posts ingested yet._', '');
  } else {
    for (const entry of entries) {
      lines.push(`## ${entry.data.title}`, '', `Original: ${entry.data.original_url}`, '');
      if (entry.data.author) lines.push(`Author: ${entry.data.author}`, '');
      if (entry.data.published_at) lines.push(`Published: ${entry.data.published_at}`, '');
      if (entry.data.topics?.length) lines.push(`Topics: ${entry.data.topics.join(', ')}`, '');
      if (entry.data.excerpt) lines.push(`> ${entry.data.excerpt}`, '');
      if (entry.data.summary) lines.push('**Summary:**', '', entry.data.summary, '');
      if (entry.data.key_points?.length) {
        lines.push('**Key points:**', '');
        for (const p of entry.data.key_points) lines.push(`- ${p}`);
        lines.push('');
      }
      if (entry.body?.trim()) lines.push(entry.body.trim(), '');
    }
  }

  return plainTextResponse(lines.join('\n'));
};
