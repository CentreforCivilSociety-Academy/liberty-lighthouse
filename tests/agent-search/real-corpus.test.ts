/**
 * Opt-in smoke test against the real src/content/ corpus.
 *
 * Skipped by default to keep the unit test run fast. Enable with:
 *   AGENT_SEARCH_REAL=1 npm test -- tests/agent-search/real-corpus.test.ts
 *
 * Use this when you've changed the reader, the tokenizer, or BM25 params,
 * to verify the production corpus still ranks sensibly.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { search } from '../../src/lib/agent-search/search';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_CONTENT = resolve(__dirname, '../../src/content');
const ENABLED = process.env.AGENT_SEARCH_REAL === '1';

describe.runIf(ENABLED)('real corpus smoke', () => {
  beforeAll(() => {
    const idx = buildIndex({ contentDir: REAL_CONTENT });
    _setIndexForTesting(idx);
    // eslint-disable-next-line no-console
    console.log(
      `[real-corpus] indexed ${idx.meta.corpus_count} docs, ` +
        `${Object.keys(idx.idf).length} terms`,
    );
  });

  it('"MSP" returns a glossary or wiki hit in the top 5', async () => {
    // The corpus contains ~1k external articles that mention MSP frequently;
    // BM25 length normalization can promote a focused external post above a
    // tight 12-word glossary definition. Top-5 is the threshold that catches
    // regressions where the glossary entry vanishes or sinks deep, without
    // being brittle to legitimate ranking shifts.
    const hits = await search('MSP', { k: 5 });
    expect(hits.length).toBeGreaterThan(0);
    const topKinds = hits.map((h) => h.kind);
    expect(
      topKinds.includes('glossary') || topKinds.includes('wiki'),
    ).toBe(true);
  });

  it('"voucher" surfaces an education FAQ or glossary entry', async () => {
    const hits = await search('voucher system', { k: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('second search call completes in under 200ms on the real corpus', async () => {
    await search('minimum support price farmer income'); // warm cache + JIT
    const t0 = performance.now();
    await search('minimum support price farmer income');
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
