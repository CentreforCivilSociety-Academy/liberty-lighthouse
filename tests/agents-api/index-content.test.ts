import { describe, it, expect } from 'vitest';
import { buildLlmsTxt } from '../../src/lib/agents-api/index-content';
import type { CorpusInputs } from '../../src/lib/agents-api/index-content';

const CORPUS: CorpusInputs = {
  topics: [
    {
      data: {
        title: 'Agriculture',
        slug: 'agriculture',
        description: 'Indian farm policy.',
        order: 1,
      },
    },
    {
      data: {
        title: 'Education',
        slug: 'education',
        description: 'Indian school policy.',
        order: 2,
      },
    },
  ],
  spontaneousOrder: [],
  ccsBooks: [],
  wikiCount: 5,
};

describe('buildLlmsTxt', () => {
  it('starts with the Howard-spec H1 + tagline', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).toMatch(/^# Liberty Lighthouse\n/);
    expect(txt).toContain('> A classical liberal resource');
  });

  it('lists topics in `order` order', () => {
    const txt = buildLlmsTxt(CORPUS);
    const agriIdx = txt.indexOf('Agriculture');
    const eduIdx = txt.indexOf('Education');
    expect(agriIdx).toBeGreaterThan(0);
    expect(eduIdx).toBeGreaterThan(agriIdx);
  });

  it('omits the Wiki section when wikiCount is 0', () => {
    const txt = buildLlmsTxt({ ...CORPUS, wikiCount: 0 });
    expect(txt).not.toContain('## Wiki');
  });

  it('includes Wiki section when wikiCount > 0', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).toContain('## Wiki');
    expect(txt).toContain('5 entries');
  });

  it('omits federated section when both external sources empty', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).not.toContain('## Federated external sources');
  });

  it('includes Spontaneous Order when populated', () => {
    const txt = buildLlmsTxt({
      ...CORPUS,
      spontaneousOrder: [{}, {}, {}] as never[],
    });
    expect(txt).toContain('Spontaneous Order index');
    expect(txt).toContain('3 posts');
  });

  it('uses absolute URLs (https://liberty-lighthouse.vercel.app)', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).toContain('https://liberty-lighthouse.vercel.app/');
  });
});
