/**
 * Renders one OG card to PNG.
 *
 * Fonts are static instances cut from the site's variable woff2 with fontTools
 * (see scripts/og/fonts/README). Satori's opentype fork cannot parse a
 * variable font's fvar table, so passing the shipped woff2 fails outright.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { ogTree, OG_WIDTH, OG_HEIGHT, type OgCard } from '../../src/lib/og-design.js';

const fontDir = fileURLToPath(new URL('./fonts/', import.meta.url));
const font = (file: string) => readFileSync(fontDir + file);

const FONTS = [
  { name: 'EB Garamond', data: font('EBGaramond-400.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'EB Garamond', data: font('EBGaramond-600.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'JetBrains Mono', data: font('JetBrainsMono-500.ttf'), weight: 500 as const, style: 'normal' as const },
];

export async function renderCard(card: OgCard): Promise<Buffer> {
  const svg = await satori(ogTree(card) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: FONTS,
  });
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng(),
  );
}
