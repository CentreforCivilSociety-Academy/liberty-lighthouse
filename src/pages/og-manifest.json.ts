/**
 * The list of cards to render, with the slugs Astro actually publishes.
 *
 * The OG generator used to key cards on the source filename, and 17 of them
 * landed at paths no page requested: Astro strips non-ASCII punctuation when
 * it builds a slug, so a file containing ’ or ‑ or — or ₹ publishes under a
 * different name, and inconsistently enough that reproducing the rule offline
 * would be guesswork. Asking Astro is exact.
 *
 * Not indexed: it is listed in robots.txt as disallowed and excluded from the
 * sitemap. It exists for the build tooling, not for readers.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSlugFromId } from '../lib/collections';
import { themePalette } from '../lib/palette';

const PART_SUFFIX = /\s*\(\s*part\s*(\d+)\s*\)\s*$/i;

export const GET: APIRoute = async () => {
  const [topics, faqs, videos] = await Promise.all([
    getCollection('topics'),
    getCollection('faqs'),
    getCollection('videos').catch(() => []),
  ]);

  const palette = themePalette(topics.map((t) => t.data.slug));
  const titleOf = new Map(topics.map((t) => [t.data.slug, t.data.title.trim()]));
  const inkOf = (slug: string) => palette[slug]?.ink;

  const cards = [
    ...topics.map((t) => ({
      out: `topic/${t.data.slug}.png`,
      eyebrow: 'Liberty Lighthouse',
      title: t.data.title.trim(),
      accent: inkOf(t.data.slug),
      cta: 'Browse the questions',
    })),

    ...faqs
      .filter((f) => !f.data.draft)
      .map((f) => ({
        out: `faq/${f.data.topic}/${getSlugFromId(f.id)}.png`,
        eyebrow: titleOf.get(f.data.topic) ?? f.data.topic,
        title: f.data.question.replace(PART_SUFFIX, '').trim(),
        accent: inkOf(f.data.topic),
        cta: 'Read the answer',
      })),

    ...(videos as typeof faqs)
      .filter((v: any) => !v.data.draft)
      .map((v: any) => ({
        out: `video/${v.data.topic}/${getSlugFromId(v.id)}.png`,
        eyebrow: `${titleOf.get(v.data.topic) ?? v.data.topic} · Video`,
        title: String(v.data.title).trim(),
        accent: inkOf(v.data.topic),
        cta: 'Watch',
      })),

    // Standing pages. No counts anywhere: a cached card outlives the number.
    { out: 'page/home.png', eyebrow: 'Centre for Civil Society', title: 'Questions about how India is actually governed', cta: 'Open the index' },
    { out: 'page/about.png', eyebrow: 'About', title: 'A resource for understanding Indian policy', cta: 'Read about the project' },
    { out: 'page/glossary.png', eyebrow: 'Glossary', title: 'The words Indian policy argues in', cta: 'Look up a term' },
    { out: 'page/ai.png', eyebrow: 'AI and MCP access', title: 'The whole corpus, readable by an assistant', cta: 'Connect an assistant' },
    { out: 'page/search.png', eyebrow: 'Search', title: 'Search the questions on Indian policy', cta: 'Start searching' },
  ];

  return new Response(JSON.stringify({ cards }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
