/**
 * The content file: its path, its frontmatter, and the commit message that
 * creates it.
 *
 * The frontmatter has the same eight fields, in the same order, as the
 * video files editors create in Decap CMS, and values are written the way
 * Decap writes them: plain where YAML allows it, double-quoted where it does
 * not, folded at 80 columns. A file made by the sync should look like one an
 * editor made, apart from the provenance comments at the top. Decap drops
 * comments the first time an editor saves the entry, and that save is the
 * review.
 */

import { normaliseText } from './text';

/**
 * The filename slug for a title, following Decap's settings in
 * public/admin/config.yml (encoding "ascii", clean_accents, "-" as the
 * replacement):
 *
 *   decompose accented letters and drop the accents (é → e), lowercase,
 *   drop apostrophes, turn every other run of characters outside a–z and
 *   0–9 into a single "-", and trim dashes from both ends.
 *
 * Apostrophes are dropped rather than replaced, as Decap does with straight
 * ones, so "Can't" becomes "cant" and "India's" becomes "indias", matching
 * the files editors have already made. We also drop the curly ’ that
 * YouTube titles often carry, where Decap would produce "can-t"; the
 * readable form wins. A slug here only ever holds a–z, 0–9 and "-".
 */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['‘’ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A title with nothing slug-able in it (one written entirely in Devanagari, say) falls back to the video id. */
export function videoSlug(title: string, videoId: string): string {
  return slugify(title) || `video-${slugify(videoId)}`;
}

export function videoPath(topic: string, slug: string): string {
  return `src/content/videos/${topic}/${slug}.mdx`;
}

export interface VideoFile {
  topic: string;
  title: string;
  youtubeId: string;
  format: 'short' | 'video';
  description: string;
  draft: boolean;
}

export interface Provenance {
  /** YYYY-MM-DD, UTC. */
  addedOn: string;
  model: string;
  topic: string;
  confidence: number | null;
  runnerUp: { topic: string; probability: number } | null;
  inScope: number;
  draft: boolean;
}

export function renderVideoMdx(file: VideoFile, provenance: Provenance): string {
  const lines = [
    '---',
    ...provenanceComments(provenance),
    yamlField('topic', file.topic),
    yamlField('title', file.title),
    yamlField('youtubeId', file.youtubeId),
    `format: ${file.format}`,
    `orientation: ${file.format === 'short' ? 'vertical' : 'horizontal'}`,
    yamlField('description', file.description),
    // Every existing video uses order 1; editors reorder in the CMS.
    'order: 1',
    `draft: ${file.draft}`,
    '---',
  ];
  return `${lines.join('\n')}\n`;
}

function provenanceComments(p: Provenance): string[] {
  const runnerUp = p.runnerUp ? `; runner-up ${p.runnerUp.topic} at ${formatProbability(p.runnerUp.probability)}` : '';
  const confidence = p.confidence === null ? 'confidence not reported' : `confidence ${formatProbability(p.confidence)}`;
  const lines = [
    `Added by the YouTube sync on ${p.addedOn}.`,
    `Model: ${p.model}`,
    `Topic: ${p.topic} (${confidence}${runnerUp})`,
    `In scope: ${formatProbability(p.inScope)}`,
    'Basis: title and description, no transcript',
  ];
  if (p.draft) lines.push('Review the topic before publishing.');
  return lines.map((line) => `# ${commentText(line)}`);
}

export interface CommitDetails {
  topic: string;
  slug: string;
  url: string;
  model: string;
  confidence: number | null;
  draft: boolean;
}

/**
 * Decap's own message for a new entry, so the sync's commits read like the
 * rest of the history, followed by a few lines of provenance and a tag that
 * makes them easy to find with `git log --grep "\[youtube-sync\]"`.
 */
export function commitMessage(d: CommitDetails): string {
  const confidence = d.confidence === null ? 'confidence not reported' : `confidence ${formatProbability(d.confidence)}`;
  return [
    `Create Video “${d.topic}/${d.slug}”`,
    '',
    `YouTube: ${commentText(d.url)}`,
    `Model: ${commentText(d.model)}`,
    `Topic: ${d.topic}, ${confidence}`,
    `Status: ${d.draft ? 'draft' : 'published'}`,
    '[youtube-sync]',
  ].join('\n');
}

/**
 * Probabilities to three decimals, rounded down, so a value just under a
 * bar (0.8999 against 0.9, say) can never be displayed as the bar itself
 * next to a "low confidence" verdict.
 */
export function formatProbability(value: number): string {
  return String(Math.floor(value * 1000 + 1e-9) / 1000);
}

/**
 * Text bound for a YAML comment or a commit message line. Model-supplied
 * strings (the snapshot name) pass through here, so anything that could end
 * the line and start a new YAML key is flattened first.
 */
function commentText(text: string): string {
  return normaliseText(text.replace(/[\u2028\u2029]/g, ' ')).slice(0, 160);
}

const LINE_WIDTH = 80;
const INDENT = '  ';
const WORD_START = /[\p{L}\p{N}]/u;

/** `key: value` for a string value, quoted only when it has to be, and folded like Decap's writer. */
export function yamlField(key: string, value: string): string {
  const scalar = isPlainSafe(value) ? value : doubleQuoted(value);
  return `${key}: ${fold(scalar, key.length + 2)}`;
}

/**
 * Whether a string can be written as a plain, unquoted YAML scalar and read
 * back unchanged by js-yaml (which Astro uses) and the yaml package (which
 * Decap uses). The rule is stricter than YAML's own, because a mistake here
 * breaks the site build: z.string() rejects a title that YAML reads as a
 * number or a date.
 *
 * It must start with a letter, so it can never be read as a number, a
 * date, null, an anchor, a tag or any other indicator; it must not be a
 * word YAML reads as a boolean or null; and it must not contain ": " or
 * " #", which would start a mapping or a comment, or end in ":". Anything
 * else is double-quoted, which is always safe.
 */
function isPlainSafe(value: string): boolean {
  return (
    /^\p{L}/u.test(value) &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F-\u009F\u2028\u2029\uFEFF\uFFFE\uFFFF]/.test(value) &&
    !/:\s|\s#|:$/.test(value) &&
    !/^(?:y|yes|n|no|true|false|on|off|null)$/i.test(value)
  );
}

/**
 * A YAML double-quoted scalar. JSON's escapes are a subset of YAML's, so
 * JSON.stringify does nearly all of it; the extra pass escapes the few
 * characters JSON leaves raw but YAML does not allow raw (DEL, the C1
 * controls) or might read as a line break (NEL, U+2028, U+2029).
 */
function doubleQuoted(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007F-\u009F\u2028\u2029\uFEFF\uFFFE\uFFFF]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * Fold a scalar onto continuation lines the way Decap's YAML writer does:
 * lines of at most 80 columns, continuation lines indented two spaces, and
 * a value of 79 characters or fewer never folded, whatever the key. YAML
 * reads each fold inside a plain or double-quoted scalar back as a single
 * space, so folding changes how the file looks and not the value.
 *
 * We break only at a single space, and only before a letter or digit, so a
 * continuation line never starts with something YAML might read as syntax
 * (a dash, a quote, a #). Text reaching here has no line breaks or runs of
 * spaces: normaliseText removed them.
 */
function fold(scalar: string, firstColumn: number): string {
  if (scalar.length <= LINE_WIDTH - INDENT.length + 1) return scalar;
  const pieces: string[] = [];
  let start = 0;
  for (let i = 1; i < scalar.length - 1; i += 1) {
    if (scalar[i] === ' ' && scalar[i - 1] !== ' ' && WORD_START.test(scalar[i + 1] ?? '')) {
      pieces.push(scalar.slice(start, i));
      start = i + 1;
    }
  }
  pieces.push(scalar.slice(start));

  const lines: string[] = [];
  let line = pieces[0] ?? '';
  let column = firstColumn;
  for (const piece of pieces.slice(1)) {
    if (column + line.length + 1 + piece.length <= LINE_WIDTH) {
      line += ` ${piece}`;
    } else {
      lines.push(line);
      line = piece;
      column = INDENT.length;
    }
  }
  lines.push(line);
  return lines.join(`\n${INDENT}`);
}
