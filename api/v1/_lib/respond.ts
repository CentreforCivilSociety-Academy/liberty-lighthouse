/**
 * Shared response helpers + minimal Vercel request/response types for
 * /api/v1/* wrappers.
 *
 * Vercel-native serverless functions use Express-like (req, res). These
 * helpers attach CORS, set status codes, and format the §8 error envelope.
 *
 * `VercelReq` and `VercelRes` are minimal local interfaces — we don't
 * import from `@vercel/node` to avoid pulling in a devDependency for
 * type-only use.
 */
import {
  AgentError,
  errorPayload,
  errorStatus,
} from '../../../src/lib/agents-api/errors.js';
import { CORS_HEADERS } from '../../../src/lib/agents-api/cors.js';

/** Minimal Vercel Node request shape. */
export interface VercelReq {
  /** Query parameters; Vercel may yield string[] for repeated keys. */
  query: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
}

/** Minimal Vercel Node response shape. */
export interface VercelRes {
  status(code: number): VercelRes;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

/**
 * Narrow a Vercel query value to a single string. Returns undefined for
 * missing values, throws BAD_REQUEST for unexpected duplicates.
 */
export function singleString(
  query: VercelReq['query'],
  key: string,
): string | undefined {
  const v = query[key];
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 1) return v[0];
  throw new AgentError(
    'BAD_REQUEST',
    `query parameter "${key}" must be a single value`,
    { key, received: v },
  );
}

function attachCors(res: VercelRes): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
  res.setHeader('content-type', 'application/json; charset=utf-8');
}

export function respondJson(res: VercelRes, payload: unknown): void {
  attachCors(res);
  res.status(200).json(payload);
}

export function respondError(res: VercelRes, err: AgentError): void {
  attachCors(res);
  res.status(errorStatus(err.code)).json(errorPayload(err));
}

export function respondUnknown(res: VercelRes, err: unknown): void {
  attachCors(res);
  const wrapped = new AgentError(
    'UPSTREAM_ERROR',
    err instanceof Error ? err.message : 'unknown error',
  );
  // Force status 500 instead of 502 for truly unexpected errors.
  res.status(500).json(errorPayload(wrapped));
}
