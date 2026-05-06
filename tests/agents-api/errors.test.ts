import { describe, it, expect } from 'vitest';
import {
  AgentError,
  errorPayload,
  errorStatus,
} from '../../src/lib/agents-api/errors';

describe('AgentError', () => {
  it('carries code, message, and optional details', () => {
    const err = new AgentError('BAD_REQUEST', 'q is required');
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('q is required');
    expect(err.details).toBeUndefined();
  });

  it('accepts details', () => {
    const err = new AgentError('VALIDATION_ERROR', 'invalid kind', {
      kind: 'evil',
    });
    expect(err.details).toEqual({ kind: 'evil' });
  });

  it('is an instanceof Error', () => {
    expect(new AgentError('NOT_FOUND', 'gone')).toBeInstanceOf(Error);
  });
});

describe('errorPayload', () => {
  it('returns the §8 shape', () => {
    const err = new AgentError('BAD_REQUEST', 'missing q');
    expect(errorPayload(err)).toEqual({
      error: { code: 'BAD_REQUEST', message: 'missing q' },
    });
  });

  it('includes details when present', () => {
    const err = new AgentError('VALIDATION_ERROR', 'invalid kind', {
      kind: 'evil',
    });
    expect(errorPayload(err)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'invalid kind',
        details: { kind: 'evil' },
      },
    });
  });
});

describe('errorStatus', () => {
  it('maps codes to HTTP statuses', () => {
    expect(errorStatus('BAD_REQUEST')).toBe(400);
    expect(errorStatus('VALIDATION_ERROR')).toBe(400);
    expect(errorStatus('NOT_FOUND')).toBe(404);
    expect(errorStatus('UPSTREAM_ERROR')).toBe(502);
  });
});
