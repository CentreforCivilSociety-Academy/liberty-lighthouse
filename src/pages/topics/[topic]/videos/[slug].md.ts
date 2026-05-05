import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildExportContext,
  buildVideoMarkdown,
  markdownResponse,
} from '../../../../lib/markdown-export';
import { getSlugFromId } from '../../../../lib/collections';

export async function getStaticPaths() {
  const videos = await getCollection('videos', ({ data }) => !data.draft);
  return videos.map((entry) => ({
    params: { topic: entry.data.topic, slug: getSlugFromId(entry.id) },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as { entry: Awaited<ReturnType<typeof getCollection<'videos'>>>[number] };
  const ctx = await buildExportContext();
  return markdownResponse(buildVideoMarkdown(entry, ctx));
};
