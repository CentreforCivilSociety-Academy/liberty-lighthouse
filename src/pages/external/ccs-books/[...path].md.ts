import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildCcsBookMarkdown, markdownResponse } from '../../../lib/markdown-export';

export async function getStaticPaths() {
  const entries = await getCollection('ccsBooks');
  return entries.map((entry) => ({
    params: { path: entry.id },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as {
    entry: Awaited<ReturnType<typeof getCollection<'ccsBooks'>>>[number];
  };
  return markdownResponse(buildCcsBookMarkdown(entry));
};
