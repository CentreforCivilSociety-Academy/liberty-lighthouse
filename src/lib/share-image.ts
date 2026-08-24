/**
 * Which share card a page uses.
 *
 * Every page gets a generated card (see scripts/og). An editor can override
 * any of them by uploading a PNG through the CMS — made at /tools/og — and
 * the upload wins. Nothing has to be uploaded for a page to have a card.
 */
import { getCollection } from 'astro:content';

export type StandingPage = 'home' | 'about' | 'glossary' | 'search' | 'ai';

/** Override for a standing page, or the generated card. */
export async function shareImageFor(page: StandingPage): Promise<string> {
  const settings = await getCollection('settings');
  const entry = settings.find((s) => s.id === 'share-images');
  const override = (entry?.data as Record<string, string> | undefined)?.[page];
  return override?.trim() || `/og/page/${page}.png`;
}
