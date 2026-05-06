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

function makeReq(method: string): IncomingMessage {
  return { method, headers: {}, url: '/api/v1/mcp' } as unknown as IncomingMessage;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const state = { status: 200, ended: false };
  return {
    _state: state,
    _headers: headers,
    statusCode: 200,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end() {
      state.ended = true;
    },
  } as unknown as ServerResponse & {
    _state: { status: number; ended: boolean };
    _headers: Record<string, string>;
    statusCode: number;
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

  it('imports cleanly (module-load smoke)', () => {
    expect(typeof mcpHandler).toBe('function');
  });
});
