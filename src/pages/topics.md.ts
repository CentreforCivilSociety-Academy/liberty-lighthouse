import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import { abs, markdownResponse, topicMdPath } from '../lib/markdown-export';

export const GET: APIRoute = async () => {
  const topics = (await getCollection('topics')).sort((a, b) => a.data.order - b.data.order);

  const fm = {
    type: 'topic_index',
    title: 'Topics',
    canonical_url: abs('/topics/'),
    markdown_url: abs('/topics.md'),
    topic_count: topics.length,
  };

  const lines: string[] = [
    '# Topics',
    '',
    "India's policy questions, organised by domain. Each topic provides FAQs, video curricula, and a guided reading list.",
    '',
  ];
  for (const topic of topics) {
    lines.push(`## [${topic.data.title}](${abs(topicMdPath(topic))})`);
    lines.push('');
    lines.push(topic.data.description);
    lines.push('');
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
