import { describe, it, expect, beforeAll } from 'vitest';
import { handleReadIndex } from '../../src/lib/agents-api/handlers/read-index';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(
  __dirname,
  '../agent-search/fixtures/content',
);

describe('handleReadIndex', () => {
  beforeAll(() => {
    const idx = buildIndex({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    _setIndexForTesting(idx);
  });

  it('returns llms_txt, agents_md, and corpus_summary', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(typeof payload.llms_txt).toBe('string');
    expect(typeof payload.agents_md).toBe('string');
    expect(payload.corpus_summary).toBeDefined();
  });

  it('llms_txt starts with H1', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(payload.llms_txt).toMatch(/^# Liberty Lighthouse\n/);
  });

  it('agents_md is non-empty markdown', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(payload.agents_md.length).toBeGreaterThan(100);
  });

  it('corpus_summary counts match the fixture corpus', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(payload.corpus_summary.topics).toBeGreaterThan(0);
    expect(payload.corpus_summary.glossary).toBeGreaterThan(0);
    expect(payload.corpus_summary.faqs).toBeGreaterThanOrEqual(1);
    expect(payload.corpus_summary.videos).toBeGreaterThanOrEqual(1);
    expect(typeof payload.corpus_summary.last_updated).toBe('string');
  });
});
