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

export const collections = { topics, faqs, videos, glossary, settings };
