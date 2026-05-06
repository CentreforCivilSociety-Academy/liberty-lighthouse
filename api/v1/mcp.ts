/**
 * POST/GET /api/v1/mcp — Streamable HTTP MCP transport.
 *
 * Each request creates a fresh McpServer (stateless serverless mode).
 * The transport delegates JSON-RPC handling and SSE streams to the
 * underlying @modelcontextprotocol/sdk machinery.
 *
 * The transport works directly with Node's IncomingMessage/ServerResponse
 * (Vercel's Node runtime supplies real Node HTTP objects with `body`
 * pre-parsed when Content-Type is JSON).
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

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode — fits serverless
  });
  await server.connect(transport);
  // req.body is undefined for GET (no body) and the parsed JSON for POST.
  await transport.handleRequest(req, res, req.body);
}
