import { describe, it, expect } from 'vitest';
import {
  respondJson,
  respondError,
  respondUnknown,
  respondPreflight,
} from '../../api/v1/_lib/respond';
import { AgentError } from '../../src/lib/agents-api/errors';

function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown = null;
  return {
    status(s: number) {
      statusCode = s;
      return this;
    },
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    json(payload: unknown) {
      body = payload;
    },
    end() {
      /* no-op */
    },
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

describe('respondJson', () => {
  it('writes 200 + CORS + JSON', () => {
    const res = makeRes();
    respondJson(res as never, { ok: true });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.body).toEqual({ ok: true });
  });
});

describe('respondError', () => {
  it('writes mapped status + envelope for AgentError', () => {
    const res = makeRes();
    respondError(res as never, new AgentError('NOT_FOUND', 'gone'));
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'gone' },
    });
  });
});

describe('respondUnknown', () => {
  it('writes 500 + UPSTREAM_ERROR envelope for non-AgentError', () => {
    const res = makeRes();
    respondUnknown(res as never, new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: { code: 'UPSTREAM_ERROR' },
    });
  });
});

describe('respondPreflight', () => {
  it('writes 204 + CORS headers + ends without body', () => {
    const res = makeRes();
    respondPreflight(res as never);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.body).toBeNull(); // .end() does not invoke .json()
  });
});
