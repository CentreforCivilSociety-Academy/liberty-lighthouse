/**
 * Strip markdown/MDX syntax to plain text.
 * Used by the search index, the glossary mention map, and the
 * "defined on this page" footer block to scan raw entry bodies.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')               // inline code
    // Images and links allow ONE level of balanced parens inside the URL,
    // so Wikipedia/academic-style URLs like `[Act](https://x.com/Foo%20(Bar).pdf)`
    // strip cleanly instead of leaking URL fragments into the output.
    .replace(/!\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)/g, ' ')   // images
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1') // links → keep label
    .replace(/^#{1,6}\s+/gm, '')               // headings
    .replace(/^>\s?/gm, '')                    // blockquotes
    .replace(/(\*\*|__)(.+?)\1/g, '$2')        // bold
    .replace(/(\*|_)(.+?)\1/g, '$2')           // italic
    .replace(/<[^>]+>/g, ' ')                  // HTML/JSX tags
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim();
}

/**
 * Take a longer text and return a search-result-style excerpt.
 * Cuts at a word boundary near `max`. Falls back to `fallback` if `text` is empty.
 */
export function makeExcerpt(text: string, fallback: string, max = 180): string {
  const clean = text.trim();
  if (!clean) return fallback;
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice) + '\u2026';
}

/**
 * Escape regex metacharacters so user-authored alias strings like
 * "RTE Section 12(2)" or "MSP/MSPs" can be safely composed into
 * a single alternation pattern without ReDoS or syntax errors.
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a snippet of stripped text around the first regex match.
 * Returns null when there is no match. Window defaults to ±80 chars,
 * cut at the nearest word boundary.
 */
export function snippetAroundMatch(
  text: string,
  pattern: RegExp,
  windowSize = 80,
): { snippet: string; matchIndex: number } | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const idx = match.index;
  const len = match[0].length;
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(text.length, idx + len + windowSize);
  let snippet = text.slice(start, end);
  if (start > 0) {
    const firstSpace = snippet.indexOf(' ');
    if (firstSpace > 0) snippet = '\u2026' + snippet.slice(firstSpace);
  }
  if (end < text.length) {
    const lastSpace = snippet.lastIndexOf(' ');
    if (lastSpace > 0 && lastSpace > snippet.length - 16) snippet = snippet.slice(0, lastSpace) + '\u2026';
    else snippet = snippet + '\u2026';
  }
  return { snippet: snippet.trim(), matchIndex: idx };
}
