import { describe, it, expect } from 'vitest';
import { handleListGlossary } from '../../src/lib/agents-api/handlers/list-glossary';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('handleListGlossary', () => {
  it('returns all non-draft terms when no filter', async () => {
    const payload = await handleListGlossary(
      {},
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    const terms = payload.terms.map((t) => t.term);
    expect(terms).toContain('Minimum Support Price (MSP)');
    expect(terms).toContain('Voucher System');
    expect(terms.find((t) => t.toLowerCase().includes('draft'))).toBeUndefined();
  });

  it('filters by case-insensitive substring on term', async () => {
    const payload = await handleListGlossary(
      { filter: 'msp' },
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    expect(payload.terms.length).toBe(1);
    expect(payload.terms[0].term).toContain('MSP');
  });

  it('filters by case-insensitive substring on definition', async () => {
    const payload = await handleListGlossary(
      { filter: 'parents' },
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    // "Voucher System" definition mentions "parents"
    expect(payload.terms.length).toBe(1);
    expect(payload.terms[0].term).toContain('Voucher');
  });

  it('builds citation with canonical_url', async () => {
    const payload = await handleListGlossary(
      {},
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    const msp = payload.terms.find((t) => t.term.includes('MSP'))!;
    expect(msp.citation.canonical_url).toBe(
      'https://example.com/glossary/msp/',
    );
    expect(msp.citation.kind).toBe('glossary');
  });

  it('returns empty array when filter matches nothing', async () => {
    const payload = await handleListGlossary(
      { filter: 'xyzzynonsense' },
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    expect(payload.terms).toEqual([]);
  });
});
