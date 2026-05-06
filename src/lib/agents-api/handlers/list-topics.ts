/**
 * list_topics handler.
 *
 * Reads the topics collection from disk, returns slug+title+description
 * +counts (FAQ + video for each topic) + citation. Counts come from
 * counting non-draft files in faqs/<slug>/ and videos/<slug>/.
 *
 * See docs/agents-api.md §5.5.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import type { TopicsPayload } from '../types.js';

const DEFAULT_SITE = 'https://liberty-lighthouse.vercel.app';
const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

interface HandleOpts {
  contentDir?: string;
  siteUrl?: string;
}

function countNonDraft(dir: string): number {
  let n = 0;
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const s = statSync(p);
      if (s.isFile() && /\.mdx?$/.test(f)) {
        const { data } = matter(readFileSync(p, 'utf8'));
        if (!(data as Record<string, unknown>).draft) n++;
      }
    }
  } catch {
    // missing dir = 0
  }
  return n;
}

interface TopicFile {
  title: string;
  slug: string;
  description: string;
  order: number;
}

export async function handleListTopics(
  opts: HandleOpts = {},
): Promise<TopicsPayload> {
  const contentDir = opts.contentDir ?? DEFAULT_CONTENT_DIR;
  const siteUrl = (opts.siteUrl ?? DEFAULT_SITE).replace(/\/$/, '');
  const dir = join(contentDir, 'topics');

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return { topics: [] };
  }

  // Read once, capture the order field, sort, then map to public shape.
  const parsed: TopicFile[] = files.map((f) => {
    const raw = readFileSync(join(dir, f), 'utf8');
    return JSON.parse(raw) as TopicFile;
  });
  parsed.sort((a, b) => a.order - b.order);

  return {
    topics: parsed.map((data) => ({
      slug: data.slug,
      title: data.title,
      description: data.description,
      counts: {
        faqs: countNonDraft(join(contentDir, 'faqs', data.slug)),
        videos: countNonDraft(join(contentDir, 'videos', data.slug)),
      },
      citation: {
        canonical_url: `${siteUrl}/topics/${data.slug}/`,
        markdown_url: `${siteUrl}/topics/${data.slug}.md`,
        title: data.title,
        kind: 'topic',
        last_modified: new Date().toISOString().slice(0, 10),
      },
    })),
  };
}
