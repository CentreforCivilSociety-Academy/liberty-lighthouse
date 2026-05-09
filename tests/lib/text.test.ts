import { describe, expect, it } from 'vitest';
import { stripMarkdown, makeExcerpt, escapeRegExp, snippetAroundMatch } from '../../src/lib/text';

describe('stripMarkdown', () => {
  it('strips bold and italic markers', () => {
    expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
  });

  it('strips bold with underscores', () => {
    expect(stripMarkdown('__bold__ here')).toBe('bold here');
  });

  it('strips fenced code blocks', () => {
    expect(stripMarkdown('before\n```js\nconst x = 1;\n```\nafter')).toBe('before after');
  });

  it('preserves inline code content', () => {
    expect(stripMarkdown('Run `npm test` now.')).toBe('Run npm test now.');
  });

  it('keeps link labels but drops URLs', () => {
    expect(stripMarkdown('See [the docs](https://example.com/path).')).toBe('See the docs.');
  });

  it('strips images entirely', () => {
    expect(stripMarkdown('Hero ![alt](hero.jpg) below.')).toBe('Hero below.');
  });

  it('strips a link whose URL contains parentheses (regression: pre-existing bug)', () => {
    const md = 'See [the Act](https://x.gov/Farmers%20(Empowerment%20and%20Protection).pdf), 2020.';
    expect(stripMarkdown(md)).toBe('See the Act, 2020.');
  });

  it('strips an image whose URL contains parentheses', () => {
    const md = 'Hero ![alt](https://x.com/file%20(v2).jpg) below.';
    expect(stripMarkdown(md)).toBe('Hero below.');
  });

  it('strips heading markers across multiple lines', () => {
    expect(stripMarkdown('# Title\n\n## Section\n\nBody.')).toBe('Title Section Body.');
  });

  it('strips blockquote markers', () => {
    expect(stripMarkdown('> quoted line\nfollow-up')).toBe('quoted line follow-up');
  });

  it('strips HTML and JSX tags', () => {
    expect(stripMarkdown('Hi <Foo bar="x" /> there')).toBe('Hi there');
  });

  it('preserves children of JSX tags', () => {
    expect(stripMarkdown('<Aside>important note</Aside>')).toBe('important note');
  });

  it('preserves raw less-than and greater-than in prose (regression: <[^>]+> ate inequalities)', () => {
    expect(stripMarkdown('GDP grew by < 5% while inflation was > 3%.')).toBe('GDP grew by < 5% while inflation was > 3%.');
  });

  it('preserves bare numeric comparisons (< 3, > 100)', () => {
    expect(stripMarkdown('Yields fell <3% across the region; subsidies rose >100bn.')).toBe('Yields fell <3% across the region; subsidies rose >100bn.');
  });

  it('still strips lowercase HTML tags between inequality-like text', () => {
    expect(stripMarkdown('a < 5 then <span>x</span> > 3')).toBe('a < 5 then x > 3');
  });

  it('collapses whitespace and trims', () => {
    expect(stripMarkdown('a   \n\n  b')).toBe('a b');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(stripMarkdown('   \n\n  ')).toBe('');
  });

  it('returns empty string for tag-only input', () => {
    expect(stripMarkdown('<Foo /><Bar />')).toBe('');
  });
});

describe('makeExcerpt', () => {
  it('returns the fallback for empty text', () => {
    expect(makeExcerpt('', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for whitespace-only text', () => {
    expect(makeExcerpt('   ', 'fallback')).toBe('fallback');
  });

  it('returns the input unchanged when shorter than max', () => {
    expect(makeExcerpt('short text', 'fallback', 50)).toBe('short text');
  });

  it('cuts at a word boundary near max with an ellipsis', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen';
    const out = makeExcerpt(text, 'fallback', 30);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out).not.toContain('twelve');
  });

  it('falls back to a hard slice when no word boundary is past the 0.6 max threshold', () => {
    // a single very long token longer than max — no space to cut at.
    const text = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const out = makeExcerpt(text, 'fallback', 30);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(31);
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c+d?')).toBe('a\\.b\\*c\\+d\\?');
  });

  it('escapes parentheses and brackets', () => {
    expect(escapeRegExp('RTE Section 12(2)')).toBe('RTE Section 12\\(2\\)');
  });

  it('escapes pipe and backslash', () => {
    expect(escapeRegExp('a|b\\c')).toBe('a\\|b\\\\c');
  });

  it('returns plain text unchanged when no metacharacters present', () => {
    expect(escapeRegExp('plain text')).toBe('plain text');
  });
});

describe('snippetAroundMatch', () => {
  it('returns null when the pattern does not match', () => {
    expect(snippetAroundMatch('no match here', /xyz/)).toBeNull();
  });

  it('returns the snippet with the match index for a mid-text hit', () => {
    const text = 'This is a long sentence that contains MSP somewhere in the middle of the text body for testing.';
    const result = snippetAroundMatch(text, /MSP/);
    expect(result).not.toBeNull();
    expect(result!.snippet).toContain('MSP');
    expect(result!.matchIndex).toBe(text.indexOf('MSP'));
  });

  it('adds a leading ellipsis when the snippet starts mid-text', () => {
    const text = 'a b c d e f g h i j k l m n o p q r s t u v w x y z TARGET aa bb cc';
    const result = snippetAroundMatch(text, /TARGET/, 20);
    expect(result).not.toBeNull();
    expect(result!.snippet.startsWith('…')).toBe(true);
  });

  it('adds a trailing ellipsis when the snippet does not reach the end', () => {
    const text = 'TARGET ' + 'word '.repeat(100);
    const result = snippetAroundMatch(text, /TARGET/, 20);
    expect(result).not.toBeNull();
    expect(result!.snippet.endsWith('…')).toBe(true);
  });
});
