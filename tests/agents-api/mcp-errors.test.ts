import { describe, it, expect } from 'vitest';
import { mcpToolError } from '../../src/lib/agents-api/mcp/errors';
import { AgentError } from '../../src/lib/agents-api/errors';

describe('mcpToolError', () => {
  it('wraps AgentError into an MCP error result with §8 envelope text', () => {
    const result = mcpToolError(
      new AgentError('VALIDATION_ERROR', 'invalid kind', { kind: 'evil' }),
    );
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const body = JSON.parse(result.content[0].text);
    expect(body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'invalid kind',
        details: { kind: 'evil' },
      },
    });
  });

  it('omits details when AgentError has none', () => {
    const result = mcpToolError(new AgentError('BAD_REQUEST', 'missing q'));
    const body = JSON.parse(result.content[0].text);
    expect(body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'missing q' },
    });
  });

  it('wraps unknown errors as UPSTREAM_ERROR', () => {
    const result = mcpToolError(new Error('boom'));
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(body.error.message).toBe('boom');
  });

  it('handles non-Error values', () => {
    const result = mcpToolError('a string');
    const body = JSON.parse(result.content[0].text);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(body.error.message).toBe('unknown error');
  });
});
