/**
 * GET /api/v1/fetch?url=... — fetch endpoint.
 */
import { handleFetch } from '../../src/lib/agents-api/handlers/fetch.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  singleString,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const payload = await handleFetch({
      url: singleString(req.query, 'url') ?? '',
    });
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
