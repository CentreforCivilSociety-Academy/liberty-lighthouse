/**
 * Liberty Lighthouse agents-api package.
 *
 * Pure handlers for the public agents API (HTTP + later MCP). Handlers
 * return typed payloads or throw AgentError. The HTTP wrappers in
 * `api/v1/*.ts` adapt them to (req, res) and Phase 3's MCP transport
 * adapts them to JSON-RPC. See docs/agents-api.md §5–§8.
 */
export * from './types.js';
export * from './errors.js';
export { CORS_HEADERS, withCors } from './cors.js';
export { handleReadIndex } from './handlers/read-index.js';
export { handleSearch } from './handlers/search.js';
