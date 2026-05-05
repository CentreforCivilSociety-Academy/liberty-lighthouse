import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const topics = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    order: z.number(),
    guidedSyllabus: z.string().default(""),
  }),
});

const faqs = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/faqs' }),
  schema: z.object({
    question: z.string(),
    topic: z.string(),
    order: z.number(),
    author: z.string().optional(),
    relatedVideos: z.array(z.string()).default([]),
    relatedFAQs: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.string().optional(),
  }),
});

const videos = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/videos' }),
  schema: z.object({
    title: z.string(),
    topic: z.string(),
    youtubeId: z.string(),
    format: z.enum(["video", "short"]).default("video"),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
    duration: z.string().optional(),
    order: z.number(),
    speaker: z.string().optional(),
    description: z.string(),
    relatedFAQs: z.array(z.string()).default([]),
    relatedVideos: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.string().optional(),
  }),
});

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string().min(1),
    definition: z.string().min(1).max(280),
    aliases: z.array(z.string().min(1).max(60)).default([]),
    relatedTerms: z.array(z.string()).default([]),
    relatedFAQs: z.array(z.string()).default([]),
    relatedVideos: z.array(z.string()).default([]),
    citations: z.array(z.object({
      title: z.string(),
      url: z.string().url(),
      author: z.string().optional(),
    })).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.string().optional(),
  }),
});

const settings = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/settings' }),
  schema: z.object({}).passthrough(),
});

// Federated external corpora. Content is ingested from external sites by
// scripts/ingest/* (one-shot importers + GitHub Actions cron). These entries
// are NOT rendered to public HTML pages — they appear only in agent-readable
// .md endpoints and llms.txt aggregations. Rationale: avoid SEO duplication
// with the original sources while still making the content queryable for the
// agentic wiki.
const spontaneousOrder = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/external/spontaneous-order' }),
  schema: z.object({
    title: z.string(),
    original_url: z.string().url(),
    author: z.string().optional(),
    published_at: z.string(),
    ingested_at: z.string(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    source_hash: z.string().optional(),
  }),
});

const ccsBooks = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/external/ccs-books' }),
  schema: z.object({
    book_slug: z.string(),
    book_title: z.string(),
    chapter_number: z.number().optional(),
    chapter_title: z.string(),
    author: z.string().optional(),
    publisher: z.string().default('Centre for Civil Society'),
    publication_year: z.number().optional(),
    ingested_at: z.string(),
    source_hash: z.string().optional(),
  }),
});

// LLM-generated wiki layer (Karpathy's "compounding artifact"). Entity pages,
// topic summaries, and comparisons synthesised from raw sources by
// scripts/ingest/wiki-regen.ts. These DO render as public HTML — humans can
// read the wiki — but are autonomously kept fresh in CI rather than authored
// by hand.
const wiki = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/wiki' }),
  schema: z.object({
    type: z.enum(['entity', 'topic_summary', 'comparison']),
    name: z.string(),
    description: z.string(),
    sources: z.array(z.string()).default([]),
    related_terms: z.array(z.string()).default([]),
    related_faqs: z.array(z.string()).default([]),
    last_regen: z.string(),
    source_hashes: z.record(z.string(), z.string()).default({}),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  topics,
  faqs,
  videos,
  glossary,
  settings,
  spontaneousOrder,
  ccsBooks,
  wiki,
};
