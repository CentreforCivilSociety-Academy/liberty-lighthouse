import { describe, expect, it } from 'vitest';
import { countWords } from '../../src/lib/word-count';

/**
 * The number is printed next to every question, so it has to be the number of
 * words a person reads — not the number of whitespace-separated tokens in an
 * MDX file. The corpus contains tables, links, HTML and footnotes, all of
 * which a naive split counts as prose.
 */

describe('countWords', () => {
  it('counts plain prose', () => {
    expect(countWords('One two three four five')).toBe(5);
  });

  it('ignores heading, quote and list markers', () => {
    expect(countWords('## Heading here')).toBe(2);
    expect(countWords('> quoted line')).toBe(2);
    expect(countWords('- bullet one\n- bullet two')).toBe(4);
    expect(countWords('1. first item\n2. second item')).toBe(4);
  });

  it('keeps link text but not the URL', () => {
    expect(countWords('See [the full report](https://example.com/a/very/long/path.pdf)')).toBe(4);
  });

  it('drops images entirely, alt text included', () => {
    expect(countWords('Before ![a chart of prices](/images/chart.png) after')).toBe(2);
  });

  it('drops bare URLs and autolinks', () => {
    expect(countWords('Source https://example.com/x and <https://example.org/y> here')).toBe(3);
  });

  it('drops HTML and MDX tags with their attributes', () => {
    expect(countWords('Text <img src="/a.png" alt="something long" /> more')).toBe(2);
    expect(countWords('<YouTube id="abc123" title="A very long video title" />word')).toBe(1);
  });

  it('does not count table pipes or separator rows', () => {
    const table = [
      '| Crop | Price |',
      '| --- | ----: |',
      '| Wheat | 2275 |',
      '| Rice | 2300 |',
    ].join('\n');
    // Crop Price Wheat 2275 Rice 2300
    expect(countWords(table)).toBe(6);
  });

  it('drops code blocks and inline code', () => {
    expect(countWords('Run ```\nnpm run build --verbose\n``` now')).toBe(2);
    expect(countWords('Set `MSP_FLOOR_PRICE` before starting')).toBe(3);
  });

  it('does not count punctuation left behind by markup', () => {
    expect(countWords('Words —\n\n---\n\nmore words')).toBe(3);
    expect(countWords('* * *')).toBe(0);
  });

  it('keeps hyphenated and apostrophised words whole', () => {
    expect(countWords("India's input-based standards")).toBe(3);
  });

  it('drops footnote markers and reference definitions', () => {
    expect(countWords('A claim[^1] follows\n\n[^1]: the note')).toBe(3);
  });

  it('handles an empty or markup-only body', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('\n\n---\n\n')).toBe(0);
  });
});
