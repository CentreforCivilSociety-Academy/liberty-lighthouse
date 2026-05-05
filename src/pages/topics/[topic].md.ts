import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildExportContext,
  buildTopicMarkdown,
  markdownResponse,
} from '../../lib/markdown-export';

export async function getStaticPaths() {
  const topics = await getCollection('topics');
  return topics.map((topic) => ({
    params: { topic: topic.data.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props as { topic: Awaited<ReturnType<typeof getCollection<'topics'>>>[number] };
  const ctx = await buildExportContext();
  return markdownResponse(buildTopicMarkdown(topic, ctx));
};
