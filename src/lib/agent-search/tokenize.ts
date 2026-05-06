/**
 * Unicode-aware tokenizer for BM25 indexing and querying.
 *
 * Lowercases, splits on whitespace and most punctuation, keeps internal
 * apostrophes for English contractions, and preserves Devanagari runs as
 * tokens. The same tokenizer is used at build time and runtime — drift
 * here breaks index lookups silently.
 */

// Match runs of:
//   • Latin letters and digits, optionally with internal apostrophes
//   • Devanagari script characters (U+0900–U+097F)
// Splits on hyphens, periods (outside contractions), and all other punctuation.
const TOKEN_RE = /[a-zA-Z0-9]+(?:'[a-zA-Z]+)?|[ऀ-ॿ]+/g;

export function tokenize(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(TOKEN_RE);
  return matches ?? [];
}
