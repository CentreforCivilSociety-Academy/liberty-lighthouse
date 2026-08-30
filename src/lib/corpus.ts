/**
 * The corpus data contract.
 *
 * One export, consumed by every lane of the homepage. Components render what
 * this returns and never count anything themselves, because the rule for this
 * page is that no number on it is ever written by hand: when a question is
 * published the heading, the census bars, the ledgers and the totals all move
 * on the next build with nobody editing anything.
 *
 * The site currently violates that rule in its own byline, which promises
 * "10 themes" as a literal string.
 */

import { getCollection } from 'astro:content';
import { SEPARATION_FLOOR, THEME_HUES, minSeparation, themePalette } from './palette';
import { countWords } from './word-count';
import lock from '../content/corpus.lock.json';

/**
 * Matches a multi-part suffix. Case-insensitive on purpose: the corpus mixes
 * "(Part 2)" and "(part 3)", and one file carries a trailing space inside the
 * suffix. A case-sensitive version silently produces a different row count.
 */
const PART_SUFFIX = /\s*\(\s*part\s*(\d+)\s*\)\s*$/i;

export type CorpusPart = {
  n: number;
  label: string;
  href: string;
};

export type CorpusRow = {
  /** Stable anchor, derived from the theme slug — never from a section number. */
  id: string;
  question: string;
  /**
   * Words in the answer, markup excluded — see countWords.
   *
   * Summed across the question's continuation parts where it has them, since
   * the row stands for the whole question and the parts are the rest of the
   * same answer.
   */
  words: number;
  href: string;
  /** Position within its theme, 1-based, unpadded. */
  folio: number;
  /** Continuation parts, present only on the four serials that have them. */
  parts: CorpusPart[];
};

export type CorpusTheme = {
  slug: string;
  title: string;
  description: string;
  /** Display label only. Derived from sort position; the anchor is the slug. */
  section: number;
  anchor: string;
  href: string;
  hue: number;
  ink: string;
  fill: string;
  /** Published FAQ files. */
  questions: number;
  /** Index rows, after continuation parts fold into their stems. */
  entries: number;
  videos: number;
  hasSyllabus: boolean;
  rows: CorpusRow[];
};

export type Corpus = {
  themes: CorpusTheme[];
  totalQuestions: number;
  totalEntries: number;
  totalThemes: number;
  totalVideos: number;
  totalSyllabi: number;
  /** Denominator for census bar widths — the largest theme, not a constant. */
  maxEntries: number;
  /** Words across the whole corpus. */
  totalWords: number;
};

function stemOf(question: string): string {
  return question.replace(PART_SUFFIX, '').trim();
}

function partNumber(question: string): number | null {
  const m = question.match(PART_SUFFIX);
  return m ? Number(m[1]) : null;
}

let cache: Corpus | null = null;

export async function getCorpus(
  opts: { expectedFoldedRows?: number } = {},
): Promise<Corpus> {
  if (cache) return cache;

  const [topics, faqs, videos] = await Promise.all([
    getCollection('topics'),
    getCollection('faqs'),
    getCollection('videos').catch(() => []),
  ]);

  const publishedFaqs = faqs.filter((f) => !f.data.draft);
  const publishedVideos = (videos as typeof faqs).filter((v: any) => !v.data.draft);

  // Themes sort alphabetically by title. The client asked for alphabetical
  // ordering, and because anchors are slug-based the printed section number is
  // free to move when a theme is added — nothing bookmarked breaks.
  const sorted = [...topics].sort((a, b) =>
    a.data.title.trim().localeCompare(b.data.title.trim(), 'en'),
  );

  // Pass every slug, so a theme the CMS added without a pinned hue still gets one.
  const palette = themePalette(sorted.map((topic) => topic.data.slug));

  const themes: CorpusTheme[] = sorted.map((topic, index) => {
    const slug = topic.data.slug;
    const mine = publishedFaqs.filter((f) => f.data.topic === slug);

    // Group by stem so continuation parts fold into the question they continue.
    // Parts begin at 2 and the unsuffixed file is the row they belong to.
    const byStem = new Map<string, { stem?: (typeof mine)[number]; parts: (typeof mine)[number][] }>();
    for (const faq of mine) {
      const key = stemOf(faq.data.question);
      let group = byStem.get(key);
      if (!group) {
        group = { parts: [] };
        byStem.set(key, group);
      }
      if (partNumber(faq.data.question) === null) group.stem = faq;
      else group.parts.push(faq);
    }

    const ordered = [...byStem.entries()].sort(
      (a, b) => (a[1].stem?.data.order ?? 0) - (b[1].stem?.data.order ?? 0),
    );

    const rows: CorpusRow[] = ordered.map(([stem, group], rowIndex) => {
      // A part without its stem would otherwise vanish from the index.
      const primary = group.stem ?? group.parts[0];
      const question = group.stem ? stem : primary.data.question;
      const words =
        countWords(primary.body ?? '') +
        group.parts.reduce((n, part) => n + countWords(part.body ?? ''), 0);
      return {
        id: `q-${slug}-${rowIndex + 1}`,
        question,
        words,
        href: `/topics/${slug}/faq/${primary.id.split('/').pop()}/`,
        folio: rowIndex + 1,
        parts: group.parts
          .slice()
          .sort((a, b) => (partNumber(a.data.question) ?? 0) - (partNumber(b.data.question) ?? 0))
          .map((p) => ({
            n: partNumber(p.data.question) as number,
            label: String(partNumber(p.data.question)),
            href: `/topics/${slug}/faq/${p.id.split('/').pop()}/`,
          })),
      };
    });

    const themeColours = palette[slug];

    return {
      slug,
      title: topic.data.title.trim(),
      description: topic.data.description,
      section: index + 1,
      anchor: `s-${slug}`,
      href: `/topics/${slug}/`,
      hue: themeColours?.hue ?? 0,
      ink: themeColours?.ink ?? '#000000',
      fill: themeColours?.fill ?? '#000000',
      questions: mine.length,
      entries: rows.length,
      videos: publishedVideos.filter((v: any) => v.data.topic === slug).length,
      hasSyllabus: Boolean(topic.data.guidedSyllabus?.trim()),
      rows,
    };
  });

  // A solved hue is provisional: it holds until a theme sorting before it is
  // added, and then it moves. Pinning is what makes it permanent, so print the
  // line that does it rather than leaving the next person to work it out.
  const unpinned = themes.filter((theme) => THEME_HUES[theme.slug] === undefined);
  if (unpinned.length > 0) {
    console.info(
      `[corpus] ${unpinned.length} theme(s) are running on a solved hue. Paste these into ` +
        'THEME_HUES in src/lib/palette.ts to freeze them:\n' +
        unpinned.map((theme) => `  ${JSON.stringify(theme.slug)}: ${theme.hue},`).join('\n'),
    );
  }

  const corpus: Corpus = {
    themes,
    totalQuestions: themes.reduce((n, t) => n + t.questions, 0),
    totalEntries: themes.reduce((n, t) => n + t.entries, 0),
    totalThemes: themes.length,
    totalVideos: themes.reduce((n, t) => n + t.videos, 0),
    totalSyllabi: themes.filter((t) => t.hasSyllabus).length,
    maxEntries: Math.max(1, ...themes.map((t) => t.entries)),
    totalWords: themes.reduce(
      (n, t) => n + t.rows.reduce((m, r) => m + r.words, 0),
      0,
    ),
  };

  assertCorpus(corpus, opts);
  cache = corpus;
  return corpus;
}

/**
 * Build-time guards. These throw rather than warn: a page whose whole claim is
 * that it counts honestly cannot ship with a count it did not verify.
 */
export function assertCorpus(
  corpus: Corpus,
  { expectedFoldedRows = lock.caseFoldedRows }: { expectedFoldedRows?: number } = {},
): void {
  const problems: string[] = [];

  for (const theme of corpus.themes) {
    if (theme.title !== theme.title.trim()) {
      problems.push(`Theme "${theme.slug}" title has leading or trailing whitespace.`);
    }
  }

  // A theme with no pinned hue gets a solved one rather than stopping the
  // build — see assignHues. An editor publishing a theme is doing their job,
  // and taking the deploy down for it costs the reader more than a pair of
  // close colours does. The cost still gets said out loud when it is real.
  const separation = minSeparation(corpus.themes.map((theme) => theme.hue));
  if (Number.isFinite(separation) && separation < SEPARATION_FLOOR) {
    console.warn(
      `[corpus] ${corpus.totalThemes} themes, closest pair ${separation.toFixed(2)} apart, ` +
        `under the ${SEPARATION_FLOOR} floor. Two themes are rendering in colours a reader may ` +
        'not tell apart: group one under an existing theme, or re-solve the pinned set in ' +
        'src/lib/palette.ts.',
    );
  }

  // The count of files folded away by the case-insensitive part collapse. If a
  // case-sensitive regex ever creeps back in, this moves and the build stops.
  const folded = corpus.totalQuestions - corpus.totalEntries;
  if (folded !== expectedFoldedRows) {
    problems.push(
      `Multi-part collapse folded ${folded} rows, expected ${expectedFoldedRows}. ` +
        'Either content changed — update src/content/corpus.lock.json — or the collapse ' +
        'stopped being case-insensitive, which silently changes the index length.',
    );
  }

  const sections = corpus.themes.map((t) => t.section);
  const expected = corpus.themes.map((_, i) => i + 1);
  if (sections.join() !== expected.join()) {
    problems.push('Section numbers are not a contiguous 1..N sequence.');
  }

  const anchors = new Set(corpus.themes.map((t) => t.anchor));
  if (anchors.size !== corpus.themes.length) {
    problems.push('Two themes share an anchor.');
  }

  if (problems.length) {
    throw new Error(`Corpus assertions failed:\n  - ${problems.join('\n  - ')}`);
  }
}
