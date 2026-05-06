/**
 * CORS headers for the public agents API.
 *
 * Anonymous and public per docs/agents-api.md §4 — no auth, any origin.
 * Wrappers in api/v1/*.ts attach these to every response.
 */

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

export function withCors(
  headers: Record<string, string>,
): Record<string, string> {
  return { ...headers, ...CORS_HEADERS };
}
