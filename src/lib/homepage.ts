/**
 * What the homepage directions are allowed to know, derived in one place.
 *
 * The three homepage directions under review (/preview/) look nothing alike,
 * but they say the same things: which topics exist, how many questions each
 * one answers, which of those questions to show first, which topics have
 * videos, and how long an answer takes to read. All of it is read from the
 * content collections here, so no direction can print a number or a topic
 * name that the content does not support — the same rule corpus.ts holds the
 * old index to.
 *
 * Nothing here is a hand-kept topic list. A topic published through the CMS
 * appears on every direction on the next build, with its colour solved by
 * palette.ts and its questions counted by corpus.ts.
 */

import { getCollection } from 'astro:content';
import { getCorpus, type Corpus, type CorpusRow, type CorpusTheme } from './corpus';
import { resolveLeader, type Leader } from './leader';
import { stripMarkdown } from './text';

/**
 * Reading speed for the minutes shown beside a question. 200 words a minute
 * is the conservative end of adult silent reading, and the audience includes
 * school students, so the estimate errs long rather than short.
 */
export const WORDS_PER_MINUTE = 200;

export type HomeQuestion = {
  question: string;
  href: string;
  minutes: number;
  /** The first sentence or two of the answer, as plain text. */
  opening: string;
};

export type HomeVideo = {
  title: string;
  href: string;
  youtubeId: string;
  topic: string;
  topicTitle: string;
};

export type HomeTopic = {
  slug: string;
  title: string;
  /** The topic's own description, with the stray whitespace CMS input carries. */
  description: string;
  href: string;
  /** Text colour on paper, from palette.ts (AAA on both grounds). */
  ink: string;
  /** Ground colour that carries paper-coloured text, from palette.ts. */
  fill: string;
  /** Published question files, as the old index counts them. */
  questions: number;
  videos: number;
  hasSyllabus: boolean;
  /** Every question, in the editors' order, continuation parts folded in. */
  rows: HomeQuestion[];
  /** The shortest question, for places where a question is set very large. */
  teaser: HomeQuestion;
  videoItems: HomeVideo[];
};

export type Homepage = {
  corpus: Corpus;
  topics: HomeTopic[];
  videos: HomeVideo[];
  leader: Leader;
  /** The lead question with the opening of its real answer. */
  lead: HomeQuestion & { topic: HomeTopic; excerpt: string[] };
  totals: { questions: number; topics: number; videos: number; syllabi: number };
  /** Median and longest reading time across every question, in minutes. */
  minutes: { median: number; longest: number };
};

const minutesFor = (words: number) => Math.max(1, Math.round(words / WORDS_PER_MINUTE));

/** Filled in by getHomepage from the answer bodies, keyed by answer URL. */
let openings = new Map<string, string>();

const toQuestion = (row: CorpusRow): HomeQuestion => ({
  question: row.question,
  href: row.href,
  minutes: minutesFor(row.words),
  opening: openings.get(row.href) ?? '',
});

/** CMS descriptions arrive with double spaces and trailing blanks. */
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The opening paragraphs of an answer, as plain text.
 *
 * Takes whole paragraphs until the excerpt reaches `words`, and never cuts a
 * paragraph mid-sentence: an excerpt that trails off reads as broken, while
 * one that stops at a full stop reads as a beginning. Headings, lists, tables
 * and images are skipped — they open a section, not an argument.
 */
export function openingParagraphs(markdown: string, words = 90): string[] {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !/^(#|[-*+] |\d+\. |\||!\[|<)/.test(block))
    .map((block) => stripMarkdown(block).replace(/\\(.)/g, '$1'));

  const out: string[] = [];
  let count = 0;
  for (const paragraph of paragraphs) {
    out.push(paragraph);
    count += paragraph.split(/\s+/).length;
    if (count >= words) break;
  }
  return out;
}

/**
 * Whole sentences from the start of an answer, at least `min` words and at
 * most `max`. Shown as "how the answer begins", so it must read as a real
 * beginning: it stops at a full stop, and only falls back to an ellipsis when
 * the first sentence alone runs past `max`.
 */
export function openingSentences(markdown: string, min = 18, max = 48): string {
  const text = openingParagraphs(markdown, max).join(' ');
  // A boundary is end punctuation, then space, then a capital or an opening
  // quote — so "1.5%" and "Rs. 20" do not end a sentence.
  const sentences = text.split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z])/);
  let out = '';
  for (const sentence of sentences) {
    const next = `${out} ${sentence}`.trim();
    if (next.split(/\s+/).length > max) break;
    out = next;
    if (out.split(/\s+/).length >= min) break;
  }
  if (out && /[.!?]["”’)]?$/.test(out)) return out;
  const words = text.split(/\s+/).slice(0, max);
  return words.length ? `${words.join(' ')}…` : '';
}

let cache: Homepage | null = null;

export async function getHomepage(): Promise<Homepage> {
  if (cache) return cache;

  const corpus = await getCorpus();
  const [faqs, videoEntries, settings] = await Promise.all([
    getCollection('faqs'),
    getCollection('videos'),
    getCollection('settings'),
  ]);

  const titleOf = new Map(corpus.themes.map((theme) => [theme.slug, theme.title]));

  openings = new Map(
    faqs
      .filter((f) => !f.data.draft)
      .map((f) => [`/topics/${f.data.topic}/faq/${f.id.split('/').pop()}/`, openingSentences(f.body ?? '')]),
  );

  const videos: HomeVideo[] = videoEntries
    .filter((entry) => !entry.data.draft && titleOf.has(entry.data.topic))
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    .map((entry) => ({
      title: entry.data.title,
      href: `/topics/${entry.data.topic}/videos/${entry.id.split('/').pop()}/`,
      youtubeId: entry.data.youtubeId,
      topic: entry.data.topic,
      topicTitle: titleOf.get(entry.data.topic) ?? entry.data.topic,
    }));

  const topics: HomeTopic[] = corpus.themes.map((theme: CorpusTheme) => {
    const rows = theme.rows.map(toQuestion);
    const teaser = rows.reduce((best, row) => (row.question.length < best.question.length ? row : best), rows[0]);
    return {
      slug: theme.slug,
      title: theme.title,
      description: tidy(theme.description),
      href: theme.href,
      ink: theme.ink,
      fill: theme.fill,
      questions: theme.questions,
      videos: theme.videos,
      hasSyllabus: theme.hasSyllabus,
      rows,
      teaser,
      videoItems: videos.filter((video) => video.topic === theme.slug),
    };
  });

  const frontpage = (settings.find((s) => s.id === 'frontpage')?.data ?? {}) as Record<string, string>;
  const leader = resolveLeader(corpus, [frontpage.lead, frontpage.shoulderA, frontpage.shoulderB]);

  const leadSlug = leader.lead.row.href.split('/').filter(Boolean).pop();
  const leadEntry = faqs.find((f) => f.id.split('/').pop() === leadSlug);
  const leadTopic = topics.find((t) => t.slug === leader.lead.theme.slug) ?? topics[0];

  const allMinutes = topics.flatMap((t) => t.rows.map((r) => r.minutes)).sort((a, b) => a - b);

  cache = {
    corpus,
    topics,
    videos,
    leader,
    lead: {
      ...toQuestion(leader.lead.row),
      topic: leadTopic,
      excerpt: openingParagraphs(leadEntry?.body ?? ''),
    },
    totals: {
      questions: corpus.totalQuestions,
      topics: corpus.totalThemes,
      videos: corpus.totalVideos,
      syllabi: corpus.totalSyllabi,
    },
    minutes: {
      median: allMinutes[Math.floor((allMinutes.length - 1) / 2)] ?? 1,
      longest: allMinutes.at(-1) ?? 1,
    },
  };
  return cache;
}

/** "18 questions", "1 video" — counts read as words, never as "1 videos". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "a, b and c" — the house list style, no Oxford comma, no middle dots. */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
