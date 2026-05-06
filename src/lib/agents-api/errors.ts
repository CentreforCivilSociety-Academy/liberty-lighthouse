/**
 * Error taxonomy for the agents API.
 *
 * Handlers throw `AgentError`. Wrappers catch, call errorPayload() to
 * build the §8 response envelope, and use errorStatus() to pick the
 * HTTP status code. Unknown errors get UPSTREAM_ERROR/500 — the wrapper
 * is responsible for that mapping (not this module).
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UPSTREAM_ERROR';

export class AgentError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.details = details;
  }
}

export interface ErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorPayload(err: AgentError): ErrorPayload {
  const out: ErrorPayload = {
    error: { code: err.code, message: err.message },
  };
  if (err.details) out.error.details = err.details;
  return out;
}

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UPSTREAM_ERROR: 502,
};

export function errorStatus(code: ErrorCode): number {
  return STATUS[code];
}
