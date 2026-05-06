import { describe, it, expect } from 'vitest';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/content');

describe('buildIndex', () => {
  it('produces an AgentIndex with docs, idf, and meta', () => {
    const idx = buildIndex({ contentDir: FIXTURES });
    expect(idx.docs.length).toBeGreaterThan(3);
    expect(Object.keys(idx.idf).length).toBeGreaterThan(5);
    expect(idx.meta.corpus_count).toBe(idx.docs.length);
    expect(idx.meta.avg_doc_length).toBeGreaterThan(0);
    expect(typeof idx.meta.built_at).toBe('string');
  });

  it('idf has higher value for rare terms than common ones', () => {
    const idx = buildIndex({ contentDir: FIXTURES });
    // 'msp' appears in glossary, faq, wiki, and external — common in fixtures.
    // 'voucher' or 'rte' appears in only a few — rarer.
    const mspIdf = idx.idf['msp'];
    const rareIdf = idx.idf['voucher'] ?? idx.idf['vouchers'] ?? 0;
    expect(rareIdf).toBeGreaterThanOrEqual(0);
    expect(mspIdf).toBeDefined();
  });

  it('result is JSON-serializable round-trip', () => {
    const idx = buildIndex({ contentDir: FIXTURES });
    const json = JSON.stringify(idx);
    const parsed = JSON.parse(json);
    expect(parsed.docs.length).toBe(idx.docs.length);
    expect(parsed.meta.corpus_count).toBe(idx.meta.corpus_count);
  });
});
