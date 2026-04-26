import type { APIRoute } from 'astro';
import { getAllGlossary, getSlugFromId, getGlossaryUrl } from '../lib/collections';

export const GET: APIRoute = async () => {
  const entries = await getAllGlossary();
  const payload: Record<string, { term: string; definition: string; url: string }> = {};
  for (const entry of entries) {
    const slug = getSlugFromId(entry.id);
    payload[slug] = {
      term: entry.data.term,
      definition: entry.data.definition,
      url: getGlossaryUrl(entry.id),
    };
  }
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
};
