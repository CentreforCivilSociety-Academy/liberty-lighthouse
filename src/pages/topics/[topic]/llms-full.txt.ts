import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  abs,
  faqHtmlPath,
  plainTextResponse,
  topicHtmlPath,
  videoHtmlPath,
} from '../../../lib/markdown-export';
import { getFaqsByTopic, getVideosByTopic } from '../../../lib/collections';

export async function getStaticPaths() {
  const topics = await getCollection('topics');
  return topics.map((topic) => ({
    params: { topic: topic.data.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props as { topic: Awaited<ReturnType<typeof getCollection<'topics'>>>[number] };
  const [faqs, videos] = await Promise.all([
    getFaqsByTopic(topic.data.slug),
    getVideosByTopic(topic.data.slug),
  ]);

  const lines: string[] = [
    `# ${topic.data.title} — Full Content`,
    '',
    `> All ${topic.data.title} FAQs, videos, and guided syllabus from Liberty Lighthouse.`,
    '',
    `Source: ${abs(topicHtmlPath(topic))}`,
    `Markdown index: ${abs(`/topics/${topic.data.slug}.md`)}`,
    '',
    topic.data.description,
    '',
  ];

  if (faqs.length > 0) {
    lines.push('## FAQs', '');
    for (const faq of faqs) {
      lines.push(`### ${faq.data.question}`, '', `Source: ${abs(faqHtmlPath(faq))}`, '');
      if (faq.body && faq.body.trim()) lines.push(faq.body.trim(), '');
    }
  }

  if (videos.length > 0) {
    lines.push('## Videos', '');
    for (const video of videos) {
      lines.push(`### ${video.data.title}`, '', `Source: ${abs(videoHtmlPath(video))}`, '');
      if (video.data.duration) lines.push(`Duration: ${video.data.duration}`, '');
      if (video.data.speaker) lines.push(`Speaker: ${video.data.speaker}`, '');
      if (video.data.description) lines.push(video.data.description, '');
      if (video.body && video.body.trim()) lines.push(video.body.trim(), '');
    }
  }

  if (topic.data.guidedSyllabus && topic.data.guidedSyllabus.trim()) {
    lines.push('## Guided Syllabus', '');
    lines.push(topic.data.guidedSyllabus.trim(), '');
  }

  return plainTextResponse(lines.join('\n'));
};
