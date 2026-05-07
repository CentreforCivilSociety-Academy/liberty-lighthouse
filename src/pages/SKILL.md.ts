import type { APIRoute } from 'astro';
import { markdownResponse } from '../lib/markdown-export';
import { buildSkillDoc } from '../lib/skill-doc';

export const GET: APIRoute = async () => {
  return markdownResponse(buildSkillDoc());
};
