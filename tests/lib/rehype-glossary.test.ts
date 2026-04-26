import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import rehypeGlossary, { buildVariants } from '../../src/lib/rehype-glossary';
import type { VFile } from 'vfile';

const ENTRIES = [
  {
    slug: 'msp',
    term: 'MSP',
    aliases: ['Minimum Support Price', 'MSPs'],
  },
  {
    slug: 'voucher-system',
    term: 'voucher system',
    aliases: ['school voucher', 'vouchers'],
  },
];

async function process(md: string, opts: { entries?: any[]; resolveCurrentSlug?: any } = {}) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeGlossary, {
      entries: opts.entries ?? ENTRIES,
      resolveCurrentSlug: opts.resolveCurrentSlug ?? (() => null),
    })
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe('buildVariants', () => {
  it('sorts variants longest-first so phrases match before subwords', () => {
    const { variants } = buildVariants(ENTRIES);
    expect(variants[0].length).toBeGreaterThanOrEqual(variants[variants.length - 1].length);
    expect(variants[0].pattern).toContain('Minimum');
  });

  it('throws on alias collision with both slugs named', () => {
    expect(() => buildVariants([
      { slug: 'a', term: 'foo', aliases: ['shared'] },
      { slug: 'b', term: 'bar', aliases: ['shared'] },
    ])).toThrowError(/alias collision: "shared" is claimed by both "a" and "b"/);
  });

  it('throws when one term collides with another term', () => {
    expect(() => buildVariants([
      { slug: 'a', term: 'MSP' },
      { slug: 'b', term: 'msp' },
    ])).toThrowError(/alias collision/);
  });

  it('throws when an alias collides with another term canonical name', () => {
    expect(() => buildVariants([
      { slug: 'a', term: 'MSP' },
      { slug: 'b', term: 'something', aliases: ['msp'] },
    ])).toThrowError(/alias collision/);
  });

  it('rejects aliases longer than 60 chars', () => {
    expect(() => buildVariants([
      { slug: 'a', term: 'foo', aliases: ['x'.repeat(61)] },
    ])).toThrowError(/alias too long/);
  });

  it('returns null regex on empty input', () => {
    const { regex } = buildVariants([]);
    expect(regex).toBeNull();
  });

  it('handles regex meta-chars in aliases (e.g., "RTE Section 12(2)")', () => {
    const { regex, variantToSlug } = buildVariants([
      { slug: 'rte', term: 'RTE Section 12(2)' },
    ]);
    expect(regex).toBeTruthy();
    expect(variantToSlug.get('rte section 12(2)')).toBe('rte');
  });
});

describe('rehype-glossary plugin', () => {
  it('wraps a basic match in an anchor with the right href and data-glossary-slug', async () => {
    const html = await process('The MSP regime is contested.');
    expect(html).toContain('class="glossary-term"');
    expect(html).toContain('data-glossary-slug="msp"');
    expect(html).toContain('href="/glossary/msp/"');
    expect(html).toContain('>MSP</a>');
  });

  it('preserves original case in the rendered output', async () => {
    const html = await process('we discuss msp here.');
    expect(html).toContain('>msp</a>');
    expect(html).toContain('data-glossary-slug="msp"');
  });

  it('matches the longest variant first ("Minimum Support Price" before "Price")', async () => {
    const html = await process('Talking about Minimum Support Price reform.');
    expect(html).toContain('>Minimum Support Price</a>');
    expect(html).toContain('data-glossary-slug="msp"');
  });

  it('only wraps the first occurrence per file', async () => {
    const html = await process('MSP first, then MSP again, and once more MSP.');
    const anchorCount = (html.match(/glossary-term/g) || []).length;
    expect(anchorCount).toBe(1);
  });

  it('does not wrap inside <code>', async () => {
    const html = await process('Inline `MSP` should be left alone.');
    expect(html).not.toContain('glossary-term');
  });

  it('does not wrap inside fenced <pre>', async () => {
    const html = await process('```\nthe MSP regime\n```');
    expect(html).not.toContain('glossary-term');
  });

  it('does not wrap inside an existing link', async () => {
    const html = await process('[Read about MSP here](https://example.com).');
    expect(html).not.toContain('class="glossary-term"');
  });

  it('does not wrap inside headings', async () => {
    const html = await process('# About MSP\n\nBody about MSP.');
    // Heading should be left alone; first body match should still wrap.
    expect(html).toContain('<h1>About MSP</h1>');
    const matches = html.match(/glossary-term/g) || [];
    expect(matches.length).toBe(1);
  });

  it('honors <span data-no-gloss> as an escape', async () => {
    const html = await process('A throwaway <span data-no-gloss>MSP</span> here, then real MSP later.');
    // The span-wrapped occurrence is skipped; the second MSP gets wrapped.
    const matches = html.match(/glossary-term/g) || [];
    expect(matches.length).toBe(1);
    expect(html).toContain('<span data-no-gloss="">MSP</span>');
  });

  it('self-skip: when processing the term\'s own glossary file, does not wrap itself', async () => {
    const fakeFile = (): any => 'msp';
    const html = await process('In this MSP definition page, MSP should not auto-link.', {
      resolveCurrentSlug: fakeFile,
    });
    // current slug derived = 'msp' → MSP matches skipped
    expect(html).not.toContain('data-glossary-slug="msp"');
  });

  it('self-skip on glossary entry still wraps OTHER terms', async () => {
    const fakeFile = (): any => 'msp';
    const html = await process('On the MSP page we also mention voucher system.', {
      resolveCurrentSlug: fakeFile,
    });
    expect(html).not.toContain('data-glossary-slug="msp"');
    expect(html).toContain('data-glossary-slug="voucher-system"');
  });

  it('empty glossary collection: plugin no-ops cleanly', async () => {
    const html = await process('The MSP regime.', { entries: [] });
    expect(html).not.toContain('glossary-term');
    expect(html).toContain('MSP regime');
  });

  it('matches phrase aliases with internal spaces', async () => {
    const html = await process('Talk about voucher system reform.');
    expect(html).toContain('>voucher system</a>');
    expect(html).toContain('data-glossary-slug="voucher-system"');
  });

  it('matches an alias and resolves to the canonical slug', async () => {
    const html = await process('Some folks call it MSPs (plural).');
    expect(html).toContain('>MSPs</a>');
    expect(html).toContain('data-glossary-slug="msp"');
  });

  it('respects word boundaries (does not match inside longer words)', async () => {
    const html = await process('The MSPolicy review.');
    expect(html).not.toContain('glossary-term');
  });
});
