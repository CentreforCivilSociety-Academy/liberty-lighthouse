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
    relatedSyllabus: z.array(z.string()).default([]),
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
    duration: z.string().optional(),
    order: z.number(),
    speaker: z.string().optional(),
    description: z.string(),
    relatedFAQs: z.array(z.string()).default([]),
    relatedSyllabus: z.array(z.string()).default([]),
    relatedVideos: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.string().optional(),
  }),
});

const syllabus = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/syllabus' }),
  schema: z.object({
    title: z.string(),
    topic: z.string(),
    moduleNumber: z.number(),
    estimatedTime: z.string().optional(),
    description: z.string(),
    relatedFAQs: z.array(z.string()).default([]),
    relatedVideos: z.array(z.string()).default([]),
    relatedSyllabus: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.string().optional(),
  }),
});

export const collections = { topics, faqs, videos, syllabus };
