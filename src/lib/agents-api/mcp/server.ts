/**
 * MCP server factory.
 *
 * Returns a fresh McpServer with all tools registered. Used per-request
 * by the Vercel wrapper at api/v1/mcp.ts — each request gets its own
 * server (stateless serverless mode).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCP_TOOLS } from './tools.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'liberty-lighthouse',
    version: '0.1.0',
  });
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.callback,
    );
  }
  return server;
}
