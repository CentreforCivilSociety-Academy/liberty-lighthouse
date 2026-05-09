import { describe, expect, it } from 'vitest';
import { buildFaqAnswer, buildFAQSchema } from '../../src/lib/structured-data';

describe('buildFaqAnswer', () => {
  it('strips bold and italic markers', () => {
    expect(buildFaqAnswer('**bold** and *italic* text')).toBe('bold and italic text');
  });

  it('keeps link label and drops the URL', () => {
    expect(buildFaqAnswer('See [the report](https://x.org/r) for details.')).toBe('See the report for details.');
  });

  it('strips fenced code blocks entirely', () => {
    expect(buildFaqAnswer('Use ```\nnpm test\n``` to run.')).toBe('Use to run.');
  });

  it('keeps inline code content', () => {
    expect(buildFaqAnswer('Use `npm test` to run.')).toBe('Use npm test to run.');
  });

  it('strips images', () => {
    expect(buildFaqAnswer('![alt](x.jpg) Below the image.')).toBe('Below the image.');
  });

  it('strips heading markers but keeps heading text', () => {
    expect(buildFaqAnswer('## Heading\n\nBody text.')).toBe('Heading Body text.');
  });

  it('strips JSX self-closing tags (regression: T8 review thought this needed a custom regex; stripMarkdown already handles it)', () => {
    expect(buildFaqAnswer('Hi <Foo bar="x" /> there')).toBe('Hi there');
  });

  it('strips JSX tags but preserves children', () => {
    expect(buildFaqAnswer('<Aside>important</Aside>')).toBe('important');
  });

  it('handles nested JSX', () => {
    expect(buildFaqAnswer('<Outer><Inner /></Outer>tail')).toBe('tail');
  });

  it('returns empty string for undefined body', () => {
    expect(buildFaqAnswer(undefined)).toBe('');
  });

  it('returns empty string for whitespace-only body', () => {
    expect(buildFaqAnswer('  \n\n  ')).toBe('');
  });

  it('returns empty string for tags-only body', () => {
    expect(buildFaqAnswer('<Foo /><Bar />')).toBe('');
  });

  it.todo('integration: faq/[slug] page omits FAQPage schema when answer is empty (needs Astro Container API or build snapshot — blocked on T6 Playwright)');
});

describe('buildFAQSchema', () => {
  it('builds a FAQPage schema with the supplied answer text', () => {
    const schema = buildFAQSchema([{ question: 'Q?', answer: 'A.' }]);
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(1);
    expect(schema.mainEntity[0].name).toBe('Q?');
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe('A.');
  });

  it('regression (T8): does not silently set answer = question', () => {
    const schema = buildFAQSchema([{ question: 'What is MSP?', answer: 'A guaranteed price floor.' }]);
    expect(schema.mainEntity[0].acceptedAnswer.text).not.toBe(schema.mainEntity[0].name);
  });
});
