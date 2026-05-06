import { describe, it, expect } from 'vitest';
import { CORS_HEADERS, withCors } from '../../src/lib/agents-api/cors';

describe('CORS_HEADERS', () => {
  it('allows any origin', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
  });

  it('allows GET, POST, and OPTIONS', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('GET');
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('POST');
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

describe('withCors', () => {
  it('merges CORS headers with the given object', () => {
    const merged = withCors({ 'content-type': 'application/json' });
    expect(merged['content-type']).toBe('application/json');
    expect(merged['Access-Control-Allow-Origin']).toBe('*');
  });

  it('does not mutate the input', () => {
    const input = { 'x-foo': 'bar' };
    withCors(input);
    expect(Object.keys(input)).toEqual(['x-foo']);
  });
});
