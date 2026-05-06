import { describe, it, expect, beforeAll } from 'vitest';
import { handleSearch } from '../../src/lib/agents-api/handlers/search';
import { AgentError } from '../../src/lib/agents-api/errors';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('handleSearch', () => {
  beforeAll(() => {
    const idx = buildIndex({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    _setIndexForTesting(idx);
  });

  it('returns SearchPayload with query and hits', async () => {
    const payload = await handleSearch({ query: 'MSP' });
    expect(payload.query).toBe('MSP');
    expect(Array.isArray(payload.hits)).toBe(true);
    expect(payload.hits.length).toBeGreaterThan(0);
  });

  it('top hit is glossary for "MSP"', async () => {
    const payload = await handleSearch({ query: 'MSP' });
    expect(payload.hits[0].kind).toBe('glossary');
    expect(payload.hits[0].citation.canonical_url).toContain('/glossary/msp/');
  });

  it('respects k', async () => {
    const payload = await handleSearch({ query: 'msp', k: 1 });
    expect(payload.hits.length).toBe(1);
  });

  it('throws BAD_REQUEST on empty query', async () => {
    await expect(handleSearch({ query: '' })).rejects.toThrowError(AgentError);
    try {
      await handleSearch({ query: '' });
    } catch (err) {
      expect((err as AgentError).code).toBe('BAD_REQUEST');
    }
  });

  it('throws BAD_REQUEST on whitespace-only query', async () => {
    await expect(handleSearch({ query: '   ' })).rejects.toThrowError(
      AgentError,
    );
  });

  it('throws VALIDATION_ERROR on invalid kind', async () => {
    await expect(
      handleSearch({ query: 'msp', kinds: ['evil-kind' as never] }),
    ).rejects.toThrowError(AgentError);
    try {
      await handleSearch({ query: 'msp', kinds: ['evil-kind' as never] });
    } catch (err) {
      expect((err as AgentError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('clamps k to 25 max', async () => {
    const payload = await handleSearch({ query: 'msp', k: 100 });
    expect(payload.hits.length).toBeLessThanOrEqual(25);
  });

  it('throws BAD_REQUEST when k is not a positive integer', async () => {
    await expect(
      handleSearch({ query: 'msp', k: -1 }),
    ).rejects.toThrowError(AgentError);
    await expect(
      handleSearch({ query: 'msp', k: 1.5 }),
    ).rejects.toThrowError(AgentError);
  });
});
