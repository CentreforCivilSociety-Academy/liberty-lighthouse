/**
 * Unicode-aware tokenizer for BM25 indexing and querying.
 *
 * Lowercases, splits on whitespace and most punctuation, keeps internal
 * apostrophes for English contractions, and preserves Devanagari runs as
 * tokens. The same tokenizer is used at build time and runtime — drift
 * here breaks index lookups silently.
 *
 * Normalizes curly apostrophes (U+2019, "’") to straight (U+0027, "'")
 * so that "don't" and "don’t" produce the same token. Markdown content
 * authored in word processors commonly contains the curly form.
 */

// Match runs of:
//   • Latin letters and digits, optionally with internal apostrophes
//   • Devanagari script characters (U+0900–U+097F)
// Splits on hyphens, periods, and all other punctuation.
const TOKEN_RE = /[a-zA-Z0-9]+(?:'[a-zA-Z]+)?|[ऀ-ॿ]+/g;

export function tokenize(text: string): string[] {
  if (!text) return [];
  const matches = text.replace(/’/g, "'").toLowerCase().match(TOKEN_RE);
  return matches ?? [];
}
