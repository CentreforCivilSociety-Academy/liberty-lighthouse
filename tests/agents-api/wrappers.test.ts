import { describe, it, expect } from 'vitest';
import topicsHandler from '../../api/v1/topics';
import type { VercelReq, VercelRes } from '../../api/v1/_lib/respond';

function makeRes(): VercelRes & { _state: { status: number; headers: Record<string, string>; body: unknown } } {
  const state = { status: 200, headers: {} as Record<string, string>, body: null as unknown };
  const res: VercelRes & typeof state = {
    _state: state,
    status(code: number) {
      state.status = code;
      return this;
    },
    setHeader(k: string, v: string) {
      state.headers[k] = v;
    },
    json(payload: unknown) {
      state.body = payload;
    },
    end() {
      /* no-op */
    },
  } as never;
  return res;
}

describe('api/v1/topics wrapper (integration shape)', () => {
  it('returns 200 + topics payload + CORS headers against real src/content/', async () => {
    // Smoke test. Runs against the real src/content/ tree (no fixture
    // injection — the wrapper doesn't expose contentDir, by design).
    // Per-handler coverage of list-topics with fixtures lives in
    // tests/agents-api/list-topics.test.ts. This test only locks the
    // HTTP wiring: CORS attachment, status code, JSON shape.
    const req: VercelReq = { query: {} };
    const res = makeRes();
    await topicsHandler(req, res);
    expect(res._state.status).toBe(200);
    expect(res._state.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res._state.headers['content-type']).toContain('application/json');
    const body = res._state.body as { topics: unknown[] };
    expect(Array.isArray(body.topics)).toBe(true);
  });

  it('responds 204 + CORS headers to OPTIONS preflight', async () => {
    const req: VercelReq = { query: {}, method: 'OPTIONS' };
    const res = makeRes();
    await topicsHandler(req, res);
    expect(res._state.status).toBe(204);
    expect(res._state.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res._state.body).toBeNull(); // .end() doesn't call .json()
  });
});
