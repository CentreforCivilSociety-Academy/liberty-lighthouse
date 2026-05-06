import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFetch } from '../../src/lib/agents-api/handlers/fetch';
import { AgentError } from '../../src/lib/agents-api/errors';

const SAMPLE_MD = `---
title: "MSP definition"
canonical_url: "https://liberty-lighthouse.vercel.app/glossary/msp/"
markdown_url: "https://liberty-lighthouse.vercel.app/glossary/msp.md"
last_modified: "2026-04-12"
---

# Minimum Support Price

The floor price...`;

describe('handleFetch', () => {
  beforeEach(() => {
    // vi.stubGlobal is the vitest 4 idiom for replacing global functions.
    // It survives non-configurable properties (which spyOn does not handle
    // reliably in happy-dom).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(SAMPLE_MD, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns markdown + citation for an on-site URL', async () => {
    const payload = await handleFetch({
      url: 'https://liberty-lighthouse.vercel.app/glossary/msp.md',
    });
    expect(payload.markdown).toBe(SAMPLE_MD);
    expect(payload.citation.canonical_url).toBe(
      'https://liberty-lighthouse.vercel.app/glossary/msp/',
    );
    expect(payload.citation.title).toBe('MSP definition');
    expect(payload.citation.last_modified).toBe('2026-04-12');
  });

  it('throws BAD_REQUEST on missing url', async () => {
    await expect(handleFetch({ url: '' })).rejects.toThrowError(AgentError);
  });

  it('throws BAD_REQUEST on off-site URL', async () => {
    await expect(
      handleFetch({ url: 'https://malicious.example.com/foo.md' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws NOT_FOUND when upstream returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    );
    await expect(
      handleFetch({ url: 'https://liberty-lighthouse.vercel.app/missing.md' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws UPSTREAM_ERROR on 5xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    await expect(
      handleFetch({ url: 'https://liberty-lighthouse.vercel.app/glossary/msp.md' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('throws UPSTREAM_ERROR if frontmatter is missing canonical_url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no frontmatter at all', { status: 200 })),
    );
    await expect(
      handleFetch({ url: 'https://liberty-lighthouse.vercel.app/glossary/msp.md' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('accepts localhost URLs (for dev)', async () => {
    const payload = await handleFetch({
      url: 'http://localhost:3219/glossary/msp.md',
    });
    expect(payload.markdown).toBe(SAMPLE_MD);
  });
});
