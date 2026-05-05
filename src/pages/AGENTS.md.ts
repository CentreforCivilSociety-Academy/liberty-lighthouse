import type { APIRoute } from 'astro';
import { markdownResponse } from '../lib/markdown-export';
import { buildAgentsDoc } from '../lib/agents-doc';

export const GET: APIRoute = async () => {
  return markdownResponse(buildAgentsDoc());
};
