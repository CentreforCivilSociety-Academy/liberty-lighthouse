import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildExportContext,
  buildFaqMarkdown,
  markdownResponse,
} from '../../../../lib/markdown-export';
import { getSlugFromId } from '../../../../lib/collections';

export async function getStaticPaths() {
  const faqs = await getCollection('faqs', ({ data }) => !data.draft);
  return faqs.map((entry) => ({
    params: { topic: entry.data.topic, slug: getSlugFromId(entry.id) },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as { entry: Awaited<ReturnType<typeof getCollection<'faqs'>>>[number] };
  const ctx = await buildExportContext();
  return markdownResponse(buildFaqMarkdown(entry, ctx));
};
