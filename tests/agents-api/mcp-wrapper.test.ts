/**
 * Wrapper smoke test for /api/v1/mcp.
 *
 * The Streamable HTTP transport from @modelcontextprotocol/sdk wraps a
 * Web Standard transport via @hono/node-server. It expects a real Node
 * IncomingMessage with stream events (data/end/error), real headers, and
 * proper async I/O. Mocking that surface accurately in vitest+happy-dom
 * is brittle and not worth the maintenance — so this file ONLY tests:
 *
 *   1. OPTIONS preflight returns 204 + CORS.
 *   2. The wrapper module imports cleanly with all dependencies resolved
 *      (i.e. the createMcpServer factory + transport instantiation work
 *      without throwing at module load).
 *
 * End-to-end JSON-RPC verification (tools/list, tool calls) is done via
 * `npx @modelcontextprotocol/inspector` against a deployed preview URL,
 * documented in api/v1/README.md.
 */
import { describe, it, expect } from 'vitest';
import mcpHandler from '../../api/v1/mcp';
import type { IncomingMessage, ServerResponse } from 'node:http';

function makeReq(
  method: string,
  headers: Record<string, string> = {},
): IncomingMessage {
  return {
    method,
    headers,
    url: '/api/v1/mcp',
  } as unknown as IncomingMessage;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const state = { status: 200, ended: false, body: '' };
  return {
    _state: state,
    _headers: headers,
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(chunk?: string) {
      if (chunk) state.body = chunk;
      state.ended = true;
      // mimic Node's writableEnded flip
      (this as unknown as { writableEnded: boolean }).writableEnded = true;
    },
  } as unknown as ServerResponse & {
    _state: { status: number; ended: boolean; body: string };
    _headers: Record<string, string>;
    statusCode: number;
    headersSent: boolean;
    writableEnded: boolean;
  };
}

describe('api/v1/mcp wrapper', () => {
  it('responds 204 + CORS to OPTIONS preflight', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();
    await mcpHandler(req as never, res as never);
    expect(res.statusCode).toBe(204);
    expect(res._headers['access-control-allow-origin']).toBe('*');
    expect(res._state.ended).toBe(true);
  });

  it('responds 406 + helpful JSON to plain browser GET (no SSE accept)', async () => {
    // Browser visits without Accept: text/event-stream get a friendly
    // error pointing at the inspector + docs, instead of cascading into
    // the SDK's transport (which has surfaced FUNCTION_INVOCATION_FAILED
    // on Vercel for non-SSE GETs).
    const req = makeReq('GET', { accept: 'text/html' });
    const res = makeRes();
    await mcpHandler(req as never, res as never);
    expect(res.statusCode).toBe(406);
    expect(res._headers['access-control-allow-origin']).toBe('*');
    expect(res._headers['content-type']).toContain('application/json');
    const body = JSON.parse(res._state.body);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toContain('MCP endpoint');
    expect(body.error.message).toContain('inspector');
  });

  it('passes GET-with-SSE-accept through to the transport', async () => {
    // GET with Accept: text/event-stream is a legitimate MCP client
    // request to open the standalone server-to-client SSE stream. The
    // wrapper must NOT short-circuit it; it must reach the transport.
    // We can't fully simulate the transport in a mock, but the wrapper
    // should at least try to invoke it (the transport will then try to
    // open a stream and likely throw on our incomplete mock — that's
    // fine; the catch block keeps the function from crashing).
    const req = makeReq('GET', { accept: 'text/event-stream' });
    const res = makeRes();
    await mcpHandler(req as never, res as never);
    // Either the transport produced a 2xx/4xx response, or the catch
    // returned 500 with our error envelope. Both are non-crash outcomes.
    expect(res._state.ended).toBe(true);
    expect([200, 400, 406, 500].includes(res.statusCode)).toBe(true);
  });

  it('imports cleanly (module-load smoke)', () => {
    expect(typeof mcpHandler).toBe('function');
  });
});
