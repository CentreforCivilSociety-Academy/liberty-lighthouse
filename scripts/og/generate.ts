/**
 * Renders an OG card for every page, from the manifest Astro emits.
 *
 *   npm run og      # builds the site, then renders the cards
 *
 * Two reasons it works this way rather than during the site build.
 *
 * The slugs have to come from Astro. Keying cards on source filenames put 17
 * of them at paths no page ever requested, because Astro strips non-ASCII
 * punctuation when it builds a slug and a file containing ’ or ‑ or — or ₹
 * publishes under a different name.
 *
 * And the render is expensive relative to everything else: ~180 cards cost
 * several times the whole Astro build, while the images only change when
 * content does. The output is committed, so a deploy ships static files and
 * the production build never loads satori or resvg at all.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderCard } from './render.js';
import type { OgCard } from '../../src/lib/og-design.js';

const MANIFEST = 'dist/og-manifest.json';
const OUT = 'public/og';

type Entry = OgCard & { out: string };

async function main() {
  if (!existsSync(MANIFEST)) {
    console.error(
      `No manifest at ${MANIFEST}.\n` +
        'Run `npm run build` first, or use `npm run og`, which does both.',
    );
    process.exit(1);
  }

  const { cards } = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { cards: Entry[] };
  const only = process.argv.includes('--only')
    ? process.argv[process.argv.indexOf('--only') + 1]
    : null;

  const wanted = only ? cards.filter((c) => c.out.startsWith(only)) : cards;
  let made = 0;

  for (const { out, ...card } of wanted) {
    const path = join(OUT, out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await renderCard(card));
    made += 1;
    if (made % 40 === 0) console.log(`  ${made}/${wanted.length}`);
  }

  console.log(`OG cards written: ${made} -> ${OUT}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
