import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/lib/agent-search/tokenize';

describe('tokenize', () => {
  it('lowercases and splits ASCII words', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('strips punctuation', () => {
    expect(tokenize("MSP, what's that?")).toEqual(['msp', "what's", 'that']);
  });

  it('keeps internal apostrophes for English contractions', () => {
    expect(tokenize("don't can't")).toEqual(["don't", "can't"]);
  });

  it('handles hyphenated terms by splitting on hyphen', () => {
    expect(tokenize('voucher-system school-choice')).toEqual([
      'voucher',
      'system',
      'school',
      'choice',
    ]);
  });

  it('preserves Devanagari script', () => {
    // "स्वराज" = swaraj (self-rule).
    expect(tokenize('स्वराज और स्वतंत्रता')).toEqual(['स्वराज', 'और', 'स्वतंत्रता']);
  });

  it('handles mixed scripts in one string', () => {
    expect(tokenize('MSP की कीमत')).toEqual(['msp', 'की', 'कीमत']);
  });

  it('drops empty tokens from runs of whitespace', () => {
    expect(tokenize('  a   b\n\nc\t')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array on empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});
