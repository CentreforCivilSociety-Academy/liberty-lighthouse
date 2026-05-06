/**
 * GET /api/v1/index — read_index endpoint.
 * See docs/agents-api.md §5.1 and §7.
 */
import { handleReadIndex } from '../../src/lib/agents-api/handlers/read-index.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  respondPreflight,
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
    const payload = await handleReadIndex();
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
