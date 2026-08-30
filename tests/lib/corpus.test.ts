import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Fixtures mirror the real corpus where it matters:
 *  - continuation parts start at 2, never 1, and the unsuffixed question is
 *    the row they belong to
 *  - the suffix casing is genuinely mixed, "(Part 2)" beside "(part 3)"
 *  - one suffix carries a trailing space inside the parentheses group
 * A case-sensitive collapse passes a naive test and silently changes the
 * index length on the real content, so the mixed casing is the point.
 */

type Faq = { id: string; data: Record<string, unknown> };

const faq = (topic: string, question: string, order: number): Faq => ({
  id: `${topic}/${question.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
  data: { topic, question, order, draft: false },
});

const topic = (slug: string, title: string, syllabus = '') => ({
  id: slug,
  data: { slug, title, description: `About ${title}`, order: 1, guidedSyllabus: syllabus },
});

let TOPICS: ReturnType<typeof topic>[] = [];
let FAQS: Faq[] = [];
let VIDEOS: Faq[] = [];

vi.mock('astro:content', () => ({
  getCollection: async (name: string) => {
    if (name === 'topics') return TOPICS;
    if (name === 'faqs') return FAQS;
    if (name === 'videos') return VIDEOS;
    return [];
  },
}));

/**
 * The fixtures fold 3 rows where the real corpus folds 8, so tests state their
 * own expectation. The lock file still guards the real build; parameterising it
 * is what keeps the collapse logic testable without shipping content into a unit test.
 */
const FIXTURE_FOLDED = 3;

async function loadCorpus() {
  vi.resetModules();
  const mod = await import('../../src/lib/corpus');
  return {
    ...mod,
    getCorpus: () => mod.getCorpus({ expectedFoldedRows: FIXTURE_FOLDED }),
  };
}

beforeEach(() => {
  TOPICS = [
    topic('trade', 'Trade'),
    topic('agriculture', 'Agriculture', 'a reading path'),
    topic('constitutionalism', "India's Constitution", 'another path'),
  ];
  FAQS = [
    faq('agriculture', 'Who really decides what a farmer grows?', 1),
    faq('agriculture', 'Are input subsidies a safety net or a trap?', 2),
    faq('trade', 'Why is trade policy unpredictable?', 1),
    // A serial: stem plus three continuations, mixed casing, stray space.
    faq('constitutionalism', 'What is the Right to Life and Liberty?', 1),
    faq('constitutionalism', 'What is the Right to Life and Liberty? (Part 2)', 2),
    faq('constitutionalism', 'What is the Right to Life and Liberty? (part 3) ', 3),
    faq('constitutionalism', 'What is the Right to Life and Liberty? (part 4)', 4),
  ];
  VIDEOS = [
    { id: 'agriculture/one', data: { topic: 'agriculture', draft: false } },
    { id: 'agriculture/two', data: { topic: 'agriculture', draft: false } },
  ];
});

describe('corpus', () => {
  it('folds continuation parts into the question they continue', async () => {
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();
    const con = corpus.themes.find((t) => t.slug === 'constitutionalism')!;

    expect(con.questions, 'four files').toBe(4);
    expect(con.entries, 'one row').toBe(1);

    const row = con.rows[0];
    expect(row.question).toBe('What is the Right to Life and Liberty?');
    expect(row.parts.map((p) => p.n), 'parts sorted, mixed casing handled').toEqual([2, 3, 4]);
  });

  it('counts questions and entries as different things, and both come from the data', async () => {
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();
    expect(corpus.totalQuestions).toBe(7);
    expect(corpus.totalEntries).toBe(4);
    expect(corpus.totalThemes).toBe(3);
    expect(corpus.totalVideos).toBe(2);
    expect(corpus.totalSyllabi).toBe(2);
  });

  it('orders themes alphabetically by title', async () => {
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();
    expect(corpus.themes.map((t) => t.title)).toEqual([
      'Agriculture',
      "India's Constitution",
      'Trade',
    ]);
  });

  it('anchors on the slug, never on the section number', async () => {
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();
    // Section numbers are display labels and shift when a theme is added;
    // anchors must not, because people share them.
    expect(corpus.themes.map((t) => t.anchor)).toEqual([
      's-agriculture',
      's-constitutionalism',
      's-trade',
    ]);
    expect(corpus.themes.map((t) => t.section)).toEqual([1, 2, 3]);

    TOPICS.push(topic('education', 'Education'));
    const { getCorpus: reload } = await loadCorpus();
    const after = await reload();
    const con = after.themes.find((t) => t.slug === 'constitutionalism')!;
    expect(con.anchor, 'anchor is stable').toBe('s-constitutionalism');
    expect(con.section, 'printed number moved, which is fine').toBe(3);
  });

  it('scales the census denominator from the data, not a constant', async () => {
    const { getCorpus } = await loadCorpus();
    expect((await getCorpus()).maxEntries).toBe(2);

    for (let i = 0; i < 20; i += 1) FAQS.push(faq('trade', `Trade question ${i}?`, 10 + i));
    const { getCorpus: reload } = await loadCorpus();
    expect((await reload()).maxEntries).toBe(21);
  });

  it('excludes drafts', async () => {
    FAQS.push({ id: 'trade/draft', data: { topic: 'trade', question: 'Hidden?', order: 9, draft: true } });
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();
    expect(corpus.themes.find((t) => t.slug === 'trade')!.questions).toBe(1);
  });

  it('reports a syllabus only when there is one', async () => {
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();
    expect(corpus.themes.find((t) => t.slug === 'trade')!.hasSyllabus).toBe(false);
    expect(corpus.themes.find((t) => t.slug === 'agriculture')!.hasSyllabus).toBe(true);
  });

  it('colours a theme that has no pinned hue rather than stopping the build', async () => {
    // The CMS can publish a theme; it cannot edit palette.ts. An editor doing
    // their job must not be able to take the deploy down.
    TOPICS.push(topic('healthcare', 'Healthcare'));
    const { getCorpus } = await loadCorpus();
    const corpus = await getCorpus();

    const healthcare = corpus.themes.find((t) => t.slug === 'healthcare')!;
    expect(healthcare.hue, 'the new theme went uncoloured').toBeTypeOf('number');
    expect(healthcare.ink).toMatch(/^#[0-9A-F]{6}$/);
    expect(healthcare.fill).toMatch(/^#[0-9A-F]{6}$/);

    const others = corpus.themes.filter((t) => t.slug !== 'healthcare').map((t) => t.hue);
    expect(others, 'the assigned hue collided with a pinned one').not.toContain(healthcare.hue);
  });

  it('fails the build when the part collapse count moves', async () => {
    // Losing a continuation changes how many rows were folded away, which is
    // exactly what a case-sensitive regex would do without any other symptom.
    FAQS = FAQS.filter((f) => !/\(part 4\)/i.test(String(f.data.question)));
    const { getCorpus } = await loadCorpus();
    await expect(getCorpus()).rejects.toThrow(/Multi-part collapse folded/);
  });

  it('warns, but does not throw, when themes crowd the separation floor', async () => {
    // Twelve hues one degree apart is the degenerate case: a reader could not
    // tell these themes apart. It is still not worth an unpublished site, so
    // it is said out loud in the build log instead of thrown.
    const { assertCorpus } = await loadCorpus();
    const themes = Array.from({ length: 12 }, (_, i) => ({
      slug: `t${i}`, title: `T${i}`, description: '', section: i + 1, anchor: `s-t${i}`,
      href: '/', hue: i, ink: '#000', fill: '#000', questions: 1, entries: 1,
      videos: 0, hasSyllabus: false, rows: [],
    }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() =>
      assertCorpus(
        {
          themes: themes as never,
          totalQuestions: 12, totalEntries: 12, totalThemes: 12,
          totalVideos: 0, totalSyllabi: 0, maxEntries: 1,
        },
        { expectedFoldedRows: 0 },
      ),
    ).not.toThrow();

    expect(warn, 'crowding passed without a word in the log').toHaveBeenCalledWith(
      expect.stringMatching(/under the .* floor/),
    );
    warn.mockRestore();
  });
});
