import { describe, it, expect } from 'vitest';
import { readCollections } from '../../src/lib/agent-search/read-collections';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/content');

describe('readCollections', () => {
  it('reads all six expected content kinds from disk', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const kinds = new Set(docs.map((d) => d.kind));
    expect(kinds).toContain('topic');
    expect(kinds).toContain('glossary');
    expect(kinds).toContain('faq');
    expect(kinds).toContain('video');
    expect(kinds).toContain('wiki');
    expect(kinds).toContain('external');
  });

  it('produces stable doc ids', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const mspGlossary = docs.find((d) => d.id === 'glossary/msp');
    expect(mspGlossary).toBeDefined();
    expect(mspGlossary!.kind).toBe('glossary');
    expect(mspGlossary!.title).toContain('MSP');
  });

  it('builds first-party canonical_url and markdown_url', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const msp = docs.find((d) => d.id === 'glossary/msp')!;
    expect(msp.citation.canonical_url).toBe('https://example.com/glossary/msp/');
    expect(msp.citation.markdown_url).toBe('https://example.com/glossary/msp.md');
    expect(msp.citation.kind).toBe('glossary');
  });

  it('builds correct faq URL with topic prefix', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const faq = docs.find((d) => d.id === 'faq/agriculture/why-msp')!;
    expect(faq.citation.canonical_url).toBe(
      'https://example.com/topics/agriculture/faq/why-msp/',
    );
  });

  it('builds correct video URL with topic prefix', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const video = docs.find((d) => d.kind === 'video')!;
    expect(video).toBeDefined();
    expect(video.citation.canonical_url).toMatch(
      /^https:\/\/example\.com\/topics\/agriculture\/videos\/contract-farming\/$/,
    );
  });

  it('uses original_url as canonical for Spontaneous Order posts', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const post = docs.find(
      (d) => d.id === 'external/spontaneous-order/sample-post',
    )!;
    expect(post).toBeDefined();
    expect(post.citation.canonical_url).toBe(
      'https://spontaneousorder.in/posts/msp-political-economy',
    );
    expect(post.citation.markdown_url).toBe(
      'https://example.com/external/spontaneous-order/sample-post.md',
    );
  });

  it('falls back to markdown_url as canonical for CCS Books chapters', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const chapter = docs.find((d) => d.kind === 'external' && d.id.includes('jeevan'))!;
    expect(chapter).toBeDefined();
    // No public HTML page for ccs-books — canonical falls back to markdown.
    expect(chapter.citation.canonical_url).toBe(chapter.citation.markdown_url);
    expect(chapter.citation.canonical_url).toContain(
      '/external/ccs-books/jeevan/chapter-1-introduction.md',
    );
  });

  it('uses ingested_at as last_modified for ccs-books', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const chapter = docs.find((d) => d.kind === 'external' && d.id.includes('jeevan'))!;
    expect(chapter.citation.last_modified).toBe('2025-12-01');
  });

  it('tokenizes title + body into tf and length', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const msp = docs.find((d) => d.id === 'glossary/msp')!;
    expect(msp.tf['msp']).toBeGreaterThan(0);
    expect(msp.length).toBeGreaterThan(5);
  });

  it('skips drafts across glossary, faqs, and wiki', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const ids = docs.map((d) => d.id);
    expect(ids.find((id) => id === 'glossary/draft-term')).toBeUndefined();
    expect(ids.find((id) => id === 'faq/education/draft-faq')).toBeUndefined();
    expect(ids.find((id) => id === 'wiki/draft-entity')).toBeUndefined();
  });

  it('sets last_modified from frontmatter when present', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const msp = docs.find((d) => d.id === 'glossary/msp')!;
    expect(msp.citation.last_modified).toBe('2026-04-12');
  });

  it('uses last_regen as last_modified for wiki entries', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const wiki = docs.find((d) => d.id === 'wiki/msp')!;
    expect(wiki.citation.last_modified).toBe('2026-05-01');
  });

  it('throws when a faq is nested deeper than <topic>/<slug>', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'agent-search-bad-'));
    mkdirSync(join(tmp, 'faqs/agriculture/sub'), { recursive: true });
    writeFileSync(
      join(tmp, 'faqs/agriculture/sub/x.mdx'),
      `---\nquestion: "Bad"\ntopic: agriculture\norder: 1\n---\nbody`,
    );
    expect(() => readCollections({ contentDir: tmp })).toThrow(
      /unexpected faq path/,
    );
  });
});
