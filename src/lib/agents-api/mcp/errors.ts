/**
 * MCP error mapping.
 *
 * Tool callbacks return a result object; on error the object has
 * `isError: true` and `content` with diagnostic text. We wrap our
 * §8 error envelope as the text payload so MCP and HTTP consumers
 * see the same diagnostic shape.
 */
import { AgentError, errorPayload } from '../errors.js';

interface McpErrorResult {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
}

export function mcpToolError(err: unknown): McpErrorResult {
  const wrapped =
    err instanceof AgentError
      ? err
      : new AgentError(
          'UPSTREAM_ERROR',
          err instanceof Error ? err.message : 'unknown error',
        );
  return {
    isError: true,
    content: [
      { type: 'text', text: JSON.stringify(errorPayload(wrapped)) },
    ],
  };
}
