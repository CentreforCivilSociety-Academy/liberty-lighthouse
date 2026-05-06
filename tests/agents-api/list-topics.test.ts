import { describe, it, expect } from 'vitest';
import { handleListTopics } from '../../src/lib/agents-api/handlers/list-topics';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('handleListTopics', () => {
  it('returns topics in `order` order', async () => {
    const payload = await handleListTopics({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    expect(payload.topics.length).toBe(2);
    expect(payload.topics[0].slug).toBe('agriculture');
    expect(payload.topics[1].slug).toBe('education');
  });

  it('builds citation with canonical_url', async () => {
    const payload = await handleListTopics({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    expect(payload.topics[0].citation.canonical_url).toBe(
      'https://example.com/topics/agriculture/',
    );
    expect(payload.topics[0].citation.kind).toBe('topic');
  });

  it('counts faqs and videos for each topic', async () => {
    const payload = await handleListTopics({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const agri = payload.topics.find((t) => t.slug === 'agriculture')!;
    // Fixture has 1 faq and 1 video under agriculture, 0 of each under education
    // (the draft-faq under education is excluded).
    expect(agri.counts.faqs).toBe(1);
    expect(agri.counts.videos).toBe(1);
  });
});
