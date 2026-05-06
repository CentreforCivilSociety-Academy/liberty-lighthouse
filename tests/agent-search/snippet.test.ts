import { describe, it, expect } from 'vitest';
import { extractSnippet } from '../../src/lib/agent-search/snippet';

describe('extractSnippet', () => {
  it('centres window on first matched token', () => {
    const text =
      'Lorem ipsum dolor sit amet. The minimum support price MSP is a floor. ' +
      'Followed by lots more text that should be cut off well before the end.';
    const snippet = extractSnippet(text, ['msp'], 80);
    expect(snippet).toContain('MSP');
    expect(snippet.length).toBeLessThanOrEqual(80);
  });

  it('falls back to head when no query token appears in text', () => {
    const text = 'A page about something else entirely.';
    const snippet = extractSnippet(text, ['msp'], 80);
    expect(snippet).toBe('A page about something else entirely.');
  });

  it('respects maxLen', () => {
    const text = 'a'.repeat(500);
    const snippet = extractSnippet(text, [], 100);
    expect(snippet.length).toBeLessThanOrEqual(100);
  });

  it('collapses internal whitespace', () => {
    const text = 'Some  text\n\nwith   weird\twhitespace.';
    const snippet = extractSnippet(text, [], 280);
    expect(snippet).toBe('Some text with weird whitespace.');
  });

  it('returns empty string on empty input', () => {
    expect(extractSnippet('', ['msp'])).toBe('');
  });

  it('case-insensitive match for the centre token', () => {
    const text = 'Discussion of Minimum Support Price details here.';
    const snippet = extractSnippet(text, ['minimum'], 60);
    expect(snippet.toLowerCase()).toContain('minimum');
  });
});
