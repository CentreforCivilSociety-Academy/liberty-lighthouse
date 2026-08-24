/**
 * Count the words a reader actually reads.
 *
 * The FAQ bodies are MDX and contain tables, links, HTML, footnotes and the
 * occasional code span. Splitting on whitespace counts all of that as prose
 * and inflates the number: a table of ten rows adds its pipes and its
 * separator dashes, a link adds its URL, and an <img> tag adds its attributes.
 *
 * So markup is removed before counting, and only things a person would read
 * aloud are left. Link text stays because it is read; the URL does not.
 */

export function countWords(markdown: string): number {
  let text = markdown;

  // Fenced code blocks, then inline code. Code is not prose.
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/~~~[\s\S]*?~~~/g, ' ');
  text = text.replace(/`[^`\n]*`/g, ' ');

  // MDX/JSX components and any raw HTML, including their attributes.
  text = text.replace(/<\/?[A-Za-z][^>]*>/g, ' ');

  // Images first: the alt text is not read as part of the body.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  // Links: keep the text, drop the target.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Reference-style links and their definitions.
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  text = text.replace(/^\s*\[[^\]]+\]:.*$/gm, ' ');

  // Bare URLs, autolinks and footnote markers.
  text = text.replace(/<https?:\/\/[^>]+>/g, ' ');
  text = text.replace(/https?:\/\/\S+/g, ' ');
  text = text.replace(/\[\^[^\]]*\]/g, ' ');

  // Table pipes and the separator rows beneath a header.
  text = text.replace(/^\s*\|?[\s:|-]*\|[\s:|-]*$/gm, ' ');
  text = text.replace(/\|/g, ' ');

  // Block markers: headings, quotes, list bullets, ordered markers, rules.
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, ' ');
  text = text.replace(/^\s*>+\s?/gm, ' ');
  text = text.replace(/^\s*[-*+]\s+/gm, ' ');
  text = text.replace(/^\s*\d+[.)]\s+/gm, ' ');
  text = text.replace(/^\s*([-*_]\s*){3,}$/gm, ' ');

  // Emphasis, strikethrough and heading underlines.
  text = text.replace(/[*_~]{1,3}/g, '');

  // HTML entities become a single character, not a word each.
  text = text.replace(/&[a-zA-Z]+;|&#\d+;/g, ' ');

  /*
   * A word must contain a letter or digit. That drops stray punctuation left
   * behind by the substitutions above — an em dash on its own line was being
   * counted as a word — while keeping hyphenated and apostrophised words whole.
   */
  const words = text
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token));

  return words.length;
}
