/**
 * Snippet extraction.
 *
 * Returns a query-centred window of the body text. If no query token is
 * found in the text, returns the first maxLen characters. Whitespace is
 * collapsed for readability. Pure, no I/O.
 */

const DEFAULT_MAX_LEN = 280;

export function extractSnippet(
  text: string,
  queryTokens: string[],
  maxLen: number = DEFAULT_MAX_LEN,
): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';

  // Find the earliest case-insensitive occurrence of any query token.
  const lower = collapsed.toLowerCase();
  let firstHit = -1;
  for (const tok of queryTokens) {
    if (!tok) continue;
    const i = lower.indexOf(tok.toLowerCase());
    if (i >= 0 && (firstHit < 0 || i < firstHit)) firstHit = i;
  }

  if (firstHit < 0) {
    return collapsed.slice(0, maxLen).trim();
  }

  // Window centred on the hit, clamped to bounds.
  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, firstHit - half);
  let end = Math.min(collapsed.length, start + maxLen);
  // If we clamped to the end, pull start back to fill the window.
  if (end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }
  return collapsed.slice(start, end).trim();
}
