/**
 * GET /api/v1/glossary?filter=... — list_glossary endpoint.
 */
import { handleListGlossary } from '../../src/lib/agents-api/handlers/list-glossary.js';
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
    const payload = await handleListGlossary({
      filter: singleString(req.query, 'filter'),
    });
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
