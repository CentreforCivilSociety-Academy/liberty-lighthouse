/**
 * GET /api/v1/topics — list_topics endpoint.
 */
import { handleListTopics } from '../../src/lib/agents-api/handlers/list-topics.js';
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
    const payload = await handleListTopics();
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
