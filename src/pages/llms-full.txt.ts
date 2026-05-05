import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  abs,
  faqHtmlPath,
  glossaryHtmlPath,
  plainTextResponse,
  topicHtmlPath,
  videoHtmlPath,
  wikiHtmlPath,
} from '../lib/markdown-export';
import { getAllGlossary } from '../lib/collections';

export const GET: APIRoute = async () => {
  const [topics, faqs, videos, glossary, spontaneousOrder, ccsBooks, wiki] = await Promise.all([
    getCollection('topics'),
    getCollection('faqs', ({ data }) => !data.draft),
    getCollection('videos', ({ data }) => !data.draft),
    getAllGlossary(),
    getCollection('spontaneousOrder'),
    getCollection('ccsBooks'),
    getCollection('wiki', ({ data }) => !data.draft),
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

  if (wiki.length > 0) {
    lines.push('# Wiki', '', `Source: ${abs('/wiki/')}`, '');
    for (const entry of wiki) {
      lines.push(`## ${entry.data.name} (${entry.data.type})`, '', `Source: ${abs(wikiHtmlPath(entry))}`, '');
      lines.push(entry.data.description, '');
      if (entry.body?.trim()) lines.push(entry.body.trim(), '');
    }
  }

  if (spontaneousOrder.length > 0) {
    const sorted = [...spontaneousOrder].sort(
      (a, b) => (b.data.published_at || '').localeCompare(a.data.published_at || ''),
    );
    lines.push('# Spontaneous Order (federated)', '', `Source: <https://spontaneousorder.in/>`, '');
    for (const entry of sorted) {
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

  if (ccsBooks.length > 0) {
    const byBook = new Map<string, Awaited<ReturnType<typeof getCollection<'ccsBooks'>>>>();
    for (const ch of ccsBooks) {
      if (!byBook.has(ch.data.book_slug)) byBook.set(ch.data.book_slug, []);
      byBook.get(ch.data.book_slug)!.push(ch);
    }
    for (const chapters of byBook.values()) {
      chapters.sort((a, b) => (a.data.chapter_number ?? 0) - (b.data.chapter_number ?? 0));
    }
    lines.push('# CCS Books (federated)', '');
    for (const [, chapters] of byBook) {
      const first = chapters[0];
      lines.push(`# ${first.data.book_title}`, '');
      if (first.data.author) lines.push(`Author: ${first.data.author}`, '');
      if (first.data.publication_year) lines.push(`Year: ${first.data.publication_year}`, '');
      lines.push('');
      for (const ch of chapters) {
        const num = ch.data.chapter_number !== undefined ? `Chapter ${ch.data.chapter_number}: ` : '';
        lines.push(`## ${num}${ch.data.chapter_title}`, '');
        if (ch.body?.trim()) lines.push(ch.body.trim(), '');
      }
    }
  }

  return plainTextResponse(lines.join('\n'));
};
