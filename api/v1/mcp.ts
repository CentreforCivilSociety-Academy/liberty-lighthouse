/**
 * POST/GET /api/v1/mcp — Streamable HTTP MCP transport.
 *
 * Each request creates a fresh McpServer (stateless serverless mode).
 * The transport delegates JSON-RPC handling and SSE streams to the
 * underlying @modelcontextprotocol/sdk machinery.
 *
 * Platform coupling: this handler relies on Vercel's Node runtime to
 * pre-parse the request body for JSON content types. If you redeploy
 * this file under a different adapter (Netlify Functions, raw node:http,
 * AWS Lambda + API Gateway, etc.), `req.body` will be undefined on POST
 * and the SDK transport will hang trying to read an already-consumed
 * stream. The defensive log below makes that failure mode observable.
 *
 * See docs/agents-api.md §7 (endpoints) and the operator README at
 * api/v1/README.md.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../../src/lib/agents-api/mcp/server.js';
import { CORS_HEADERS } from '../../src/lib/agents-api/cors.js';

/** Vercel's Node runtime augments IncomingMessage with parsed body. */
type VercelReq = IncomingMessage & { body?: unknown };

const FRIENDLY_GET_BODY = JSON.stringify({
  error: {
    code: 'BAD_REQUEST',
    message:
      'This is a Streamable HTTP MCP endpoint, not a browsable URL. ' +
      'Connect with an MCP client. To explore: ' +
      'npx @modelcontextprotocol/inspector https://liberty-lighthouse.vercel.app/api/v1/mcp',
    details: {
      docs: 'https://liberty-lighthouse.vercel.app/api/v1/README.md',
    },
  },
});

function attachCors(res: ServerResponse): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
}

function sendJson(res: ServerResponse, status: number, body: string): void {
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(body);
}

export default async function handler(
  req: VercelReq,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    attachCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  attachCors(res);

  // Pre-empt browser visits and other GETs that aren't asking for the SSE
  // stream. The MCP Streamable HTTP spec requires `Accept: text/event-stream`
  // on GET; without it the transport returns 406, but rendering that error
  // through the @hono/node-server adapter on Vercel has surfaced as
  // FUNCTION_INVOCATION_FAILED in some cases. Short-circuiting here is
  // both more debuggable and friendlier to humans clicking the URL.
  if (req.method === 'GET') {
    const accept = String(req.headers.accept ?? '');
    if (!accept.includes('text/event-stream')) {
      sendJson(res, 406, FRIENDLY_GET_BODY);
      return;
    }
  }

  if (req.method === 'POST' && req.body === undefined) {
    // Defensive: surface a debuggable signal if body parsing isn't
    // happening (wrong adapter, missing Content-Type header, etc.).
    // The transport would otherwise hang trying to read the stream.
    // eslint-disable-next-line no-console
    console.warn(
      '[mcp] POST request has undefined req.body — body parsing may not be configured. ' +
        'The Streamable HTTP transport will likely hang or 400.',
    );
  }

  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode — fits serverless
    });
    await server.connect(transport);
    // req.body is undefined for GET-with-SSE (no body) and the parsed JSON for POST.
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    // Surface to Vercel function logs so we can diagnose root cause.
    // eslint-disable-next-line no-console
    console.error(
      '[mcp] handler crashed:',
      err instanceof Error ? err.stack ?? err.message : err,
    );
    sendJson(
      res,
      500,
      JSON.stringify({
        error: {
          code: 'UPSTREAM_ERROR',
          message:
            err instanceof Error ? err.message : 'MCP transport failed',
        },
      }),
    );
  }
}
