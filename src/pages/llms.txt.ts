import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { plainTextResponse } from '../lib/markdown-export';
import { buildLlmsTxt } from '../lib/agents-api/index-content';

// Howard-spec llms.txt — see https://llmstxt.org/
// Root index for autonomous agents. Each H2 section is a curated link list.
export const GET: APIRoute = async () => {
  const [topics, spontaneousOrder, ccsBooks, wiki] = await Promise.all([
    getCollection('topics'),
    getCollection('spontaneousOrder'),
    getCollection('ccsBooks'),
    getCollection('wiki', ({ data }) => !data.draft),
  ]);
  return plainTextResponse(
    buildLlmsTxt({
      topics,
      spontaneousOrder,
      ccsBooks,
      wikiCount: wiki.length,
    }),
  );
};
