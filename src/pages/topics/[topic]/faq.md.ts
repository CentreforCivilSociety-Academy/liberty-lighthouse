import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import {
  abs,
  faqMdPath,
  markdownResponse,
} from '../../../lib/markdown-export';
import { getFaqsByTopic } from '../../../lib/collections';

export async function getStaticPaths() {
  const topics = await getCollection('topics');
  return topics.map((topic) => ({
    params: { topic: topic.data.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props as { topic: Awaited<ReturnType<typeof getCollection<'topics'>>>[number] };
  const faqs = await getFaqsByTopic(topic.data.slug);

  const fm = {
    type: 'faq_index',
    topic: topic.data.slug,
    topic_title: topic.data.title,
    canonical_url: abs(`/topics/${topic.data.slug}/faq/`),
    markdown_url: abs(`/topics/${topic.data.slug}/faq.md`),
    faq_count: faqs.length,
  };

  const lines: string[] = [
    `# ${topic.data.title} — FAQs`,
    '',
    `Frequently asked questions on ${topic.data.title.toLowerCase()} policy in India.`,
    '',
  ];
  if (faqs.length === 0) {
    lines.push('_No FAQs available yet._', '');
  } else {
    for (const faq of faqs) {
      lines.push(`- [${faq.data.question}](${abs(faqMdPath(faq))})`);
    }
    lines.push('');
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
