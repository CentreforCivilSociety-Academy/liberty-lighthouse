/**
 * The three questions on the front page.
 *
 * Chosen by a person, not by an algorithm. An earlier design selected them by
 * hashing the build date over a pool, which meant nobody at CCS controlled
 * what led their own homepage and three themes could never appear at all.
 * "Why is that question at the top?" has to have a human answer.
 *
 * Editors set these through the CMS. The fallbacks below are used when a slot
 * is empty or points at content that has since been unpublished, so the front
 * page cannot break because someone deleted a question.
 */

import type { Corpus, CorpusRow, CorpusTheme } from './corpus';

export type LeaderSlot = {
  row: CorpusRow;
  theme: CorpusTheme;
};

export type Leader = {
  lead: LeaderSlot;
  shoulders: LeaderSlot[];
  /** True when any slot fell back, so the build can say so in its log. */
  usedFallback: boolean;
};

/**
 * Vetted fallbacks, by FAQ id. Short, self-explaining, and jargon-free: these
 * have to make sense to someone who has never read a policy paper, because
 * they are the first thing anyone sees.
 */
export const FALLBACK_IDS = [
  'economic-growth/can-indians-get-rich-before-getting-old',
  'agriculture/why-are-indian-farmers-called-annadatas-rather-than-entrepreneurs',
  'education/why-do-government-schools-underperform',
] as const;

/** Find a row by the FAQ id its href was built from. */
function findById(corpus: Corpus, id: string): LeaderSlot | null {
  if (!id) return null;
  const slug = id.split('/').pop();
  if (!slug) return null;
  for (const theme of corpus.themes) {
    // Match the stem row, or any row whose continuation parts point at it.
    for (const row of theme.rows) {
      if (row.href.includes(`/faq/${slug}/`)) return { row, theme };
      if (row.parts.some((p) => p.href.includes(`/faq/${slug}/`))) return { row, theme };
    }
  }
  return null;
}

/**
 * Resolve the three slots. `configured` comes from the CMS; anything missing
 * or dangling falls back, and a slot never resolves to the same row twice.
 */
export function resolveLeader(corpus: Corpus, configured: string[] = []): Leader {
  const chosen: LeaderSlot[] = [];
  const seen = new Set<string>();
  let usedFallback = false;

  const take = (slot: LeaderSlot | null): boolean => {
    if (!slot || seen.has(slot.row.id)) return false;
    seen.add(slot.row.id);
    chosen.push(slot);
    return true;
  };

  for (let i = 0; i < 3; i += 1) {
    if (take(findById(corpus, configured[i] ?? ''))) continue;
    usedFallback = true;
    if (take(findById(corpus, FALLBACK_IDS[i] ?? ''))) continue;
    // Last resort: the first unused row of the largest theme, so the page
    // still renders if the corpus has been reorganised beneath us.
    const spare = corpus.themes
      .flatMap((theme) => theme.rows.map((row) => ({ row, theme })))
      .find((s) => !seen.has(s.row.id));
    take(spare ?? null);
  }

  return { lead: chosen[0], shoulders: chosen.slice(1), usedFallback };
}
