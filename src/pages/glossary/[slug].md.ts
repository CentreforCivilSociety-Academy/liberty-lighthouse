import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  buildExportContext,
  buildGlossaryMarkdown,
  markdownResponse,
} from '../../lib/markdown-export';
import { getSlugFromId } from '../../lib/collections';

export async function getStaticPaths() {
  const glossary = await getCollection('glossary', ({ data }) => !data.draft);
  return glossary.map((entry) => ({
    params: { slug: getSlugFromId(entry.id) },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as { entry: Awaited<ReturnType<typeof getCollection<'glossary'>>>[number] };
  const ctx = await buildExportContext();
  return markdownResponse(buildGlossaryMarkdown(entry, ctx));
};
