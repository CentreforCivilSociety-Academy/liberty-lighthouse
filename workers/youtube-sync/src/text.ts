/**
 * Text clean-up shared by the feed parser, the Jev request and the content
 * file.
 *
 * Titles and descriptions arrive as the uploader typed them: line breaks,
 * runs of spaces, the odd invisible character from a paste. They are
 * flattened to single-spaced plain text before anything else sees them, so
 * the model and the content file always get the same words, and the YAML
 * writer in mdx.ts never has to deal with a line break inside a value.
 */

/**
 * Control characters and other code points YAML does not allow unescaped.
 * Tabs and line breaks are not listed: they are whitespace and become
 * spaces below. NEL (U+0085) is a line break too, so it is left to the
 * whitespace rule for the same reason.
 */
const UNPRINTABLE = /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\uFFFE\uFFFF]/g;

/** Half of a UTF-16 surrogate pair with no other half: it cannot be encoded, so it goes. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function normaliseText(text: string): string {
  return text
    .replace(LONE_SURROGATE, '')
    .replace(UNPRINTABLE, '')
    .replace(/[\s\u0085]+/g, ' ')
    .trim();
}

/**
 * A description as both the site and the model should see it. YouTube
 * descriptions often end with hashtags and links for discovery. Neither
 * belongs in a one-paragraph blurb on an explainer site, and to the
 * classifier they are noise.
 */
export function cleanDescription(text: string): string {
  return normaliseText(
    text
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/\bwww\.\S+/gi, ' ')
      .replace(/(^|\s)#[\p{L}\p{M}\p{N}_]+/gu, '$1'),
  );
}

/**
 * Cut at a word boundary near `max` characters and mark the cut with an
 * ellipsis, so the model never reads half a word as if it were whole.
 */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}
