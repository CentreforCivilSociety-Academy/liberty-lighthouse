import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  abs,
  faqHtmlPath,
  glossaryHtmlPath,
  plainTextResponse,
  topicHtmlPath,
  videoHtmlPath,
} from '../lib/markdown-export';
import { getAllGlossary } from '../lib/collections';

export const GET: APIRoute = async () => {
  const [topics, faqs, videos, glossary] = await Promise.all([
    getCollection('topics'),
    getCollection('faqs', ({ data }) => !data.draft),
    getCollection('videos', ({ data }) => !data.draft),
    getAllGlossary(),
  ]);

  const sortedTopics = topics.sort((a, b) => a.data.order - b.data.order);

  const lines: string[] = [
    '# Liberty Lighthouse — Full Content',
    '',
    "> Complete content dump for LLM ingestion. All FAQs, videos, glossary, and syllabi from Liberty Lighthouse, a classical liberal resource for understanding India's policy landscape. A project of the Centre for Civil Society.",
    '',
    `Site: ${abs('/')}`,
    `Schema for agents: ${abs('/AGENTS.md')}`,
    `Curated index: ${abs('/llms.txt')}`,
    '',
  ];

  for (const topic of sortedTopics) {
    lines.push(`# ${topic.data.title}`, '', `Source: ${abs(topicHtmlPath(topic))}`, '', topic.data.description, '');

    const topicFaqs = faqs
      .filter((f) => f.data.topic === topic.data.slug)
      .sort((a, b) => a.data.order - b.data.order);

    if (topicFaqs.length > 0) {
      lines.push('## FAQs', '');
      for (const faq of topicFaqs) {
        lines.push(`### ${faq.data.question}`, '', `Source: ${abs(faqHtmlPath(faq))}`, '');
        if (faq.body && faq.body.trim()) {
          lines.push(faq.body.trim(), '');
        }
      }
    }

    const topicVideos = videos
      .filter((v) => v.data.topic === topic.data.slug)
      .sort((a, b) => a.data.order - b.data.order);

    if (topicVideos.length > 0) {
      lines.push('## Videos', '');
      for (const video of topicVideos) {
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
  }

  if (glossary.length > 0) {
    lines.push('# Glossary', '', `Source: ${abs('/glossary/')}`, '');
    for (const entry of glossary) {
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
  }

  return plainTextResponse(lines.join('\n'));
};
