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
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  _req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const payload = await handleReadIndex();
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
