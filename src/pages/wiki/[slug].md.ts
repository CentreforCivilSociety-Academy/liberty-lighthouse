import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildWikiMarkdown, markdownResponse } from '../../lib/markdown-export';

export async function getStaticPaths() {
  const entries = await getCollection('wiki', ({ data }) => !data.draft);
  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as {
    entry: Awaited<ReturnType<typeof getCollection<'wiki'>>>[number];
  };
  return markdownResponse(buildWikiMarkdown(entry));
};
