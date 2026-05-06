/**
 * GET /api/v1/search?q=...&k=10&kinds=faq,glossary — search endpoint.
 */
import { handleSearch } from '../../src/lib/agents-api/handlers/search.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import type { ContentKind } from '../../src/lib/agent-search/types.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  respondPreflight,
  singleString,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  req: VercelReq,
  res: VercelRes,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    respondPreflight(res);
    return;
  }
  try {
    const q = singleString(req.query, 'q') ?? '';
    const kRaw = singleString(req.query, 'k');
    const k = kRaw !== undefined ? Number(kRaw) : undefined;
    if (kRaw !== undefined && Number.isNaN(k)) {
      throw new AgentError('BAD_REQUEST', '"k" must be a number', { k: kRaw });
    }
    const kindsRaw = singleString(req.query, 'kinds');
    const kinds = kindsRaw
      ? (kindsRaw.split(',').map((s) => s.trim()).filter(Boolean) as ContentKind[])
      : undefined;
    const payload = await handleSearch({ query: q, k, kinds });
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
