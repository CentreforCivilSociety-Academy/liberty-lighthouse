import { describe, it, expect, beforeAll } from 'vitest';
import { search } from '../../src/lib/agent-search/search';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/content');

describe('search()', () => {
  beforeAll(() => {
    const idx = buildIndex({ contentDir: FIXTURES, siteUrl: 'https://example.com' });
    _setIndexForTesting(idx);
  });

  it('"MSP" returns the glossary entry as top hit', async () => {
    const hits = await search('MSP', { k: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe('glossary');
    expect(hits[0].title).toContain('MSP');
    expect(hits[0].citation.canonical_url).toContain('/glossary/msp/');
  });

  it('every hit carries a complete citation', async () => {
    const hits = await search('voucher');
    for (const h of hits) {
      expect(h.citation.canonical_url).toMatch(/^https?:\/\//);
      expect(h.citation.markdown_url).toMatch(/^https?:\/\//);
      expect(h.citation.title).toBeTruthy();
      expect(h.citation.kind).toBeTruthy();
      expect(h.citation.last_modified).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it('respects k', async () => {
    const hits = await search('msp', { k: 1 });
    expect(hits.length).toBe(1);
  });

  it('caps k at 25', async () => {
    const hits = await search('msp', { k: 100 });
    expect(hits.length).toBeLessThanOrEqual(25);
  });

  it('filters by kinds', async () => {
    const hits = await search('msp', { kinds: ['glossary'] });
    expect(hits.every((h) => h.kind === 'glossary')).toBe(true);
  });

  it('returns [] for empty query', async () => {
    expect(await search('')).toEqual([]);
    expect(await search('   ')).toEqual([]);
  });

  it('returns [] when no doc matches', async () => {
    expect(await search('xyzzynonsense')).toEqual([]);
  });

  it('hits are ranked descending by score', async () => {
    const hits = await search('msp', { k: 10 });
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it('hits expose ascending rank starting at 1', async () => {
    const hits = await search('msp', { k: 5 });
    hits.forEach((h, i) => expect(h.rank).toBe(i + 1));
  });

  it('completes second call in under 50ms on the fixture corpus', async () => {
    // First call populates module-scope cache and any JIT warmup.
    await search('minimum support price');
    const t0 = performance.now();
    await search('minimum support price');
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
  });

  it('concurrent first calls return the same index instance', async () => {
    // Calling loadIndex twice in parallel must not trigger two imports.
    // The promise-cache pattern means both awaits resolve to the same value.
    const { loadIndex } = await import('../../src/lib/agent-search/load-index');
    const [a, b] = await Promise.all([loadIndex(), loadIndex()]);
    expect(a).toBe(b);
  });

  it('breaks score ties deterministically', async () => {
    // For a query token that appears with identical tf and length in two docs,
    // BM25 produces equal scores. The tie-break (docIdx ascending) must keep
    // ordering stable. Use a token shared by faq and wiki — both have "msp"
    // and similar shapes — and assert ordering is consistent across runs.
    const first = await search('msp', { k: 10 });
    const second = await search('msp', { k: 10 });
    expect(first.map((h) => h.title)).toEqual(second.map((h) => h.title));
    expect(first.map((h) => h.kind)).toEqual(second.map((h) => h.kind));
  });
});
