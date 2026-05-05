import matter from 'gray-matter';
import type { CollectionEntry } from 'astro:content';
import { getSlugFromId } from './collections';

export const SITE_URL = 'https://liberty-lighthouse.vercel.app';

export function abs(path: string): string {
  return new URL(path, SITE_URL).href;
}

export function faqHtmlPath(faq: CollectionEntry<'faqs'>): string {
  return `/topics/${faq.data.topic}/faq/${getSlugFromId(faq.id)}/`;
}

export function faqMdPath(faq: CollectionEntry<'faqs'>): string {
  return `/topics/${faq.data.topic}/faq/${getSlugFromId(faq.id)}.md`;
}

export function videoHtmlPath(video: CollectionEntry<'videos'>): string {
  return `/topics/${video.data.topic}/videos/${getSlugFromId(video.id)}/`;
}

export function videoMdPath(video: CollectionEntry<'videos'>): string {
  return `/topics/${video.data.topic}/videos/${getSlugFromId(video.id)}.md`;
}

export function glossaryHtmlPath(term: CollectionEntry<'glossary'>): string {
  return `/glossary/${getSlugFromId(term.id)}/`;
}

export function glossaryMdPath(term: CollectionEntry<'glossary'>): string {
  return `/glossary/${getSlugFromId(term.id)}.md`;
}

export function topicHtmlPath(topic: CollectionEntry<'topics'>): string {
  return `/topics/${topic.data.slug}/`;
}

export function topicMdPath(topic: CollectionEntry<'topics'>): string {
  return `/topics/${topic.data.slug}.md`;
}

// External content has no HTML page — only .md endpoints. Slug is derived
// from the file ID: e.g. "post-slug" or "book-slug/chapter-slug".
export function spontaneousOrderMdPath(entry: CollectionEntry<'spontaneousOrder'>): string {
  return `/external/spontaneous-order/${entry.id}.md`;
}

export function ccsBookMdPath(entry: CollectionEntry<'ccsBooks'>): string {
  // entry.id is "book-slug/chapter-slug" (the glob preserves directory structure).
  return `/external/ccs-books/${entry.id}.md`;
}

// Wiki content renders both HTML and .md.
export function wikiHtmlPath(entry: CollectionEntry<'wiki'>): string {
  return `/wiki/${entry.id}/`;
}

export function wikiMdPath(entry: CollectionEntry<'wiki'>): string {
  return `/wiki/${entry.id}.md`;
}

export interface ExportContext {
  faqs: CollectionEntry<'faqs'>[];
  videos: CollectionEntry<'videos'>[];
  glossary: CollectionEntry<'glossary'>[];
  topics: CollectionEntry<'topics'>[];
}

export async function buildExportContext(): Promise<ExportContext> {
  const { getCollection } = await import('astro:content');
  const [faqs, videos, glossary, topics] = await Promise.all([
    getCollection('faqs', ({ data }) => !data.draft),
    getCollection('videos', ({ data }) => !data.draft),
    getCollection('glossary', ({ data }) => !data.draft),
    getCollection('topics'),
  ]);
  return { faqs, videos, glossary, topics };
}

function resolveFaqs(ids: string[], all: CollectionEntry<'faqs'>[]): CollectionEntry<'faqs'>[] {
  return ids
    .map((id) => all.find((f) => f.id === id))
    .filter((x): x is CollectionEntry<'faqs'> => Boolean(x));
}

function resolveVideos(ids: string[], all: CollectionEntry<'videos'>[]): CollectionEntry<'videos'>[] {
  return ids
    .map((id) => all.find((v) => v.id === id))
    .filter((x): x is CollectionEntry<'videos'> => Boolean(x));
}

function resolveTermsBySlug(slugs: string[], all: CollectionEntry<'glossary'>[]): CollectionEntry<'glossary'>[] {
  const set = new Set(slugs);
  return all.filter((g) => set.has(getSlugFromId(g.id)));
}

function relatedSection(parts: string[]): string {
  if (parts.length === 0) return '';
  return ['---', '', '## Related', '', ...parts, ''].join('\n');
}

export function buildFaqMarkdown(entry: CollectionEntry<'faqs'>, ctx: ExportContext): string {
  const relatedFaqs = resolveFaqs(entry.data.relatedFAQs, ctx.faqs);
  const relatedVideos = resolveVideos(entry.data.relatedVideos, ctx.videos);
  const topic = ctx.topics.find((t) => t.data.slug === entry.data.topic);

  const fm: Record<string, unknown> = {
    type: 'faq',
    question: entry.data.question,
    topic: entry.data.topic,
    topic_title: topic?.data.title ?? entry.data.topic,
    topic_url: abs(`/topics/${entry.data.topic}/`),
    canonical_url: abs(faqHtmlPath(entry)),
    markdown_url: abs(faqMdPath(entry)),
  };
  if (entry.data.author) fm.author = entry.data.author;
  if (entry.data.updatedAt) fm.updated_at = entry.data.updatedAt;
  if (relatedFaqs.length) fm.related_faqs = relatedFaqs.map((f) => abs(faqMdPath(f)));
  if (relatedVideos.length) fm.related_videos = relatedVideos.map((v) => abs(videoMdPath(v)));

  const lines: string[] = [`# ${entry.data.question}`, ''];
  if (entry.body?.trim()) lines.push(entry.body.trim(), '');

  const refs: string[] = [];
  for (const f of relatedFaqs) refs.push(`- FAQ: [${f.data.question}](${abs(faqMdPath(f))})`);
  for (const v of relatedVideos) refs.push(`- Video: [${v.data.title}](${abs(videoMdPath(v))})`);
  const related = relatedSection(refs);
  if (related) lines.push(related);

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildVideoMarkdown(entry: CollectionEntry<'videos'>, ctx: ExportContext): string {
  const relatedFaqs = resolveFaqs(entry.data.relatedFAQs, ctx.faqs);
  const relatedVideos = resolveVideos(entry.data.relatedVideos, ctx.videos);
  const topic = ctx.topics.find((t) => t.data.slug === entry.data.topic);

  const fm: Record<string, unknown> = {
    type: 'video',
    title: entry.data.title,
    topic: entry.data.topic,
    topic_title: topic?.data.title ?? entry.data.topic,
    topic_url: abs(`/topics/${entry.data.topic}/`),
    canonical_url: abs(videoHtmlPath(entry)),
    markdown_url: abs(videoMdPath(entry)),
    youtube_id: entry.data.youtubeId,
    youtube_url: `https://www.youtube.com/watch?v=${entry.data.youtubeId}`,
    format: entry.data.format,
    orientation: entry.data.orientation,
  };
  if (entry.data.duration) fm.duration = entry.data.duration;
  if (entry.data.speaker) fm.speaker = entry.data.speaker;
  if (entry.data.updatedAt) fm.updated_at = entry.data.updatedAt;
  if (relatedFaqs.length) fm.related_faqs = relatedFaqs.map((f) => abs(faqMdPath(f)));
  if (relatedVideos.length) fm.related_videos = relatedVideos.map((v) => abs(videoMdPath(v)));

  const lines: string[] = [`# ${entry.data.title}`, ''];
  if (entry.data.description) lines.push(entry.data.description.trim(), '');
  if (entry.body?.trim()) lines.push(entry.body.trim(), '');

  const refs: string[] = [];
  for (const f of relatedFaqs) refs.push(`- FAQ: [${f.data.question}](${abs(faqMdPath(f))})`);
  for (const v of relatedVideos) refs.push(`- Video: [${v.data.title}](${abs(videoMdPath(v))})`);
  const related = relatedSection(refs);
  if (related) lines.push(related);

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildGlossaryMarkdown(entry: CollectionEntry<'glossary'>, ctx: ExportContext): string {
  const relatedTerms = resolveTermsBySlug(entry.data.relatedTerms, ctx.glossary);
  const relatedFaqs = resolveFaqs(entry.data.relatedFAQs, ctx.faqs);
  const relatedVideos = resolveVideos(entry.data.relatedVideos, ctx.videos);

  const fm: Record<string, unknown> = {
    type: 'glossary_term',
    term: entry.data.term,
    canonical_url: abs(glossaryHtmlPath(entry)),
    markdown_url: abs(glossaryMdPath(entry)),
    definition: entry.data.definition,
  };
  if (entry.data.aliases.length) fm.aliases = entry.data.aliases;
  if (entry.data.updatedAt) fm.updated_at = entry.data.updatedAt;
  if (relatedTerms.length) fm.related_terms = relatedTerms.map((t) => abs(glossaryMdPath(t)));
  if (relatedFaqs.length) fm.related_faqs = relatedFaqs.map((f) => abs(faqMdPath(f)));
  if (relatedVideos.length) fm.related_videos = relatedVideos.map((v) => abs(videoMdPath(v)));
  if (entry.data.citations.length) {
    fm.citations = entry.data.citations.map((c) => ({
      title: c.title,
      url: c.url,
      ...(c.author && { author: c.author }),
    }));
  }

  const lines: string[] = [`# ${entry.data.term}`, ''];
  if (entry.data.aliases.length) {
    lines.push(`*Also known as: ${entry.data.aliases.join(', ')}*`, '');
  }
  lines.push(entry.data.definition, '');
  if (entry.body?.trim()) lines.push(entry.body.trim(), '');

  if (entry.data.citations.length) {
    lines.push('## Recommended reading', '');
    for (const c of entry.data.citations) {
      const author = c.author ? ` — ${c.author}` : '';
      lines.push(`- [${c.title}](${c.url})${author}`);
    }
    lines.push('');
  }

  const refs: string[] = [];
  for (const t of relatedTerms) refs.push(`- Term: [${t.data.term}](${abs(glossaryMdPath(t))}) — ${t.data.definition}`);
  for (const f of relatedFaqs) refs.push(`- FAQ: [${f.data.question}](${abs(faqMdPath(f))})`);
  for (const v of relatedVideos) refs.push(`- Video: [${v.data.title}](${abs(videoMdPath(v))})`);
  const related = relatedSection(refs);
  if (related) lines.push(related);

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildTopicMarkdown(topic: CollectionEntry<'topics'>, ctx: ExportContext): string {
  const topicFaqs = ctx.faqs
    .filter((f) => f.data.topic === topic.data.slug)
    .sort((a, b) => a.data.order - b.data.order);
  const topicVideos = ctx.videos
    .filter((v) => v.data.topic === topic.data.slug)
    .sort((a, b) => a.data.order - b.data.order);
  const hasSyllabus = Boolean(topic.data.guidedSyllabus?.trim());

  const fm: Record<string, unknown> = {
    type: 'topic',
    title: topic.data.title,
    slug: topic.data.slug,
    canonical_url: abs(topicHtmlPath(topic)),
    markdown_url: abs(topicMdPath(topic)),
    description: topic.data.description,
    faq_count: topicFaqs.length,
    video_count: topicVideos.length,
    has_syllabus: hasSyllabus,
    faq_index_url: abs(`/topics/${topic.data.slug}/faq.md`),
    video_index_url: abs(`/topics/${topic.data.slug}/videos.md`),
  };
  if (hasSyllabus) fm.syllabus_url = abs(`/topics/${topic.data.slug}/syllabus.md`);

  const lines: string[] = [
    `# ${topic.data.title}`,
    '',
    topic.data.description,
    '',
    '## Resources',
    '',
  ];
  if (topicFaqs.length) {
    lines.push(`- [FAQs (${topicFaqs.length})](${abs(`/topics/${topic.data.slug}/faq.md`)}) — Curated question-answer pairs.`);
  }
  if (topicVideos.length) {
    lines.push(`- [Videos (${topicVideos.length})](${abs(`/topics/${topic.data.slug}/videos.md`)}) — Video curriculum.`);
  }
  if (hasSyllabus) {
    lines.push(`- [Guided Syllabus](${abs(`/topics/${topic.data.slug}/syllabus.md`)}) — Reading list of books, papers, and articles.`);
  }
  lines.push('', `Full topic dump (single file): ${abs(`/topics/${topic.data.slug}/llms-full.txt`)}`, '');

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildSyllabusMarkdown(topic: CollectionEntry<'topics'>): string {
  const fm: Record<string, unknown> = {
    type: 'syllabus',
    topic: topic.data.slug,
    topic_title: topic.data.title,
    topic_url: abs(topicHtmlPath(topic)),
    canonical_url: abs(`/topics/${topic.data.slug}/syllabus/`),
    markdown_url: abs(`/topics/${topic.data.slug}/syllabus.md`),
  };

  const lines: string[] = [`# ${topic.data.title} — Guided Syllabus`, ''];
  const body = topic.data.guidedSyllabus?.trim();
  if (body) lines.push(body, '');
  else lines.push('_No guided syllabus available yet._', '');

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildSpontaneousOrderMarkdown(entry: CollectionEntry<'spontaneousOrder'>): string {
  const fm: Record<string, unknown> = {
    type: 'external_post',
    source: 'spontaneous-order',
    title: entry.data.title,
    canonical_url: entry.data.original_url,
    markdown_url: abs(spontaneousOrderMdPath(entry)),
    published_at: entry.data.published_at,
    ingested_at: entry.data.ingested_at,
  };
  if (entry.data.author) fm.author = entry.data.author;
  if (entry.data.excerpt) fm.excerpt = entry.data.excerpt;
  if (entry.data.tags.length) fm.tags = entry.data.tags;

  const lines: string[] = [`# ${entry.data.title}`, ''];
  if (entry.data.author) lines.push(`*By ${entry.data.author}*`, '');
  lines.push(`Original: <${entry.data.original_url}>`, '');
  if (entry.data.excerpt) lines.push(`> ${entry.data.excerpt}`, '');
  if (entry.body?.trim()) lines.push(entry.body.trim(), '');

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildCcsBookMarkdown(entry: CollectionEntry<'ccsBooks'>): string {
  const fm: Record<string, unknown> = {
    type: 'external_book_chapter',
    source: 'ccs-books',
    book_slug: entry.data.book_slug,
    book_title: entry.data.book_title,
    chapter_title: entry.data.chapter_title,
    markdown_url: abs(ccsBookMdPath(entry)),
    publisher: entry.data.publisher,
    ingested_at: entry.data.ingested_at,
  };
  if (entry.data.author) fm.author = entry.data.author;
  if (entry.data.publication_year) fm.publication_year = entry.data.publication_year;
  if (entry.data.chapter_number !== undefined) fm.chapter_number = entry.data.chapter_number;

  const lines: string[] = [
    `# ${entry.data.chapter_title}`,
    '',
    `*From ${entry.data.book_title}${entry.data.author ? ` by ${entry.data.author}` : ''}, published by ${entry.data.publisher}*`,
    '',
  ];
  if (entry.body?.trim()) lines.push(entry.body.trim(), '');

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function buildWikiMarkdown(entry: CollectionEntry<'wiki'>): string {
  const fm: Record<string, unknown> = {
    type: `wiki_${entry.data.type}`,
    name: entry.data.name,
    canonical_url: abs(wikiHtmlPath(entry)),
    markdown_url: abs(wikiMdPath(entry)),
    description: entry.data.description,
    last_regen: entry.data.last_regen,
  };
  if (entry.data.sources.length) fm.sources = entry.data.sources;
  if (entry.data.related_terms.length) fm.related_terms = entry.data.related_terms;
  if (entry.data.related_faqs.length) fm.related_faqs = entry.data.related_faqs;

  const lines: string[] = [`# ${entry.data.name}`, '', entry.data.description, ''];
  if (entry.body?.trim()) lines.push(entry.body.trim(), '');

  if (entry.data.sources.length) {
    lines.push('---', '', '## Sources', '');
    for (const s of entry.data.sources) lines.push(`- ${s}`);
    lines.push('');
  }

  return matter.stringify(lines.join('\n').trimEnd() + '\n', fm);
}

export function markdownResponse(text: string): Response {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export function plainTextResponse(text: string): Response {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
