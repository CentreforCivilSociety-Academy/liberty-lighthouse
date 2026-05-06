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

function attachCors(res: ServerResponse): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
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

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode — fits serverless
  });
  await server.connect(transport);
  // req.body is undefined for GET (no body) and the parsed JSON for POST.
  await transport.handleRequest(req, res, req.body);
}
