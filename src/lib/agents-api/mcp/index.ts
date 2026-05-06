/**
 * MCP transport adapter for the Liberty Lighthouse agents API.
 *
 * Exports the server factory + tool registry + error helper. The Vercel
 * wrapper at api/v1/mcp.ts is the only intended consumer of
 * `createMcpServer`; tests deep-import `MCP_TOOLS` and `mcpToolError`.
 */
export { createMcpServer } from './server.js';
export { MCP_TOOLS } from './tools.js';
export { mcpToolError } from './errors.js';
