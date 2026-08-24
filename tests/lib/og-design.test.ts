import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OG_WIDTH,
  OG_HEIGHT,
  OG_COLOURS,
  MARK_PATHS,
  titleSize,
  ogTree,
} from '../../src/lib/og-design';

/**
 * The card is drawn twice: by satori in the batch job, and on a canvas in the
 * staff tool. Both read their constants from og-design, and these assert they
 * keep doing so — a hardcoded colour or size on either side would produce two
 * different cards from one design.
 */

const tool = readFileSync(resolve(process.cwd(), 'src/pages/tools/og.astro'), 'utf8');
const generator = readFileSync(resolve(process.cwd(), 'scripts/og/render.ts'), 'utf8');

describe('OG card design', () => {
  it('is the size every platform expects', () => {
    expect([OG_WIDTH, OG_HEIGHT]).toEqual([1200, 630]);
  });

  it('fits the headline to its length rather than using one size', () => {
    // The corpus runs 18 to 260 characters, median 77. A fixed size either
    // wastes the card on short questions or clips the long ones.
    expect(titleSize('How does GST work?')).toBeGreaterThan(titleSize('a'.repeat(120)));
    expect(titleSize('a'.repeat(120))).toBeGreaterThan(titleSize('a'.repeat(250)));

    // Nothing gets so small it stops working as a thumbnail.
    expect(titleSize('a'.repeat(260))).toBeGreaterThanOrEqual(36);
    // Nothing so large that a short question overflows a 1200px card.
    expect(titleSize('Why?')).toBeLessThanOrEqual(82);
  });

  it('sizes decrease monotonically as the headline grows', () => {
    let previous = Infinity;
    for (const n of [10, 40, 70, 100, 140, 190, 260]) {
      const size = titleSize('a'.repeat(n));
      expect(size).toBeLessThanOrEqual(previous);
      previous = size;
    }
  });

  it('both renderers take their constants from this module', () => {
    for (const [name, source] of [['tool', tool], ['batch generator', generator]] as const) {
      expect(source, `${name} does not import the shared design`).toMatch(
        /from '.*og-design'?/,
      );
    }
    // The tool draws on a canvas, so it must pull the same values rather than
    // restate them.
    for (const token of ['OG_WIDTH', 'OG_HEIGHT', 'OG_COLOURS', 'titleSize', 'MARK_PATHS']) {
      expect(tool, `tool does not use ${token}`).toContain(token);
    }
  });

  it('the mark is the site mark, not a redrawing of it', () => {
    const favicon = readFileSync(resolve(process.cwd(), 'public/favicon.svg'), 'utf8');
    // Same geometry as the favicon and the navbar component.
    expect(favicon).toContain('M12 5.5V2M12 18.5V22M5.5 12H2M18.5 12H22');
    expect(MARK_PATHS.beams).toContain('M12 5.5V2M12 18.5V22M5.5 12H2M18.5 12H22');
  });

  it('builds a tree satori can render, with the accent applied', () => {
    const tree = ogTree({ eyebrow: 'Trade', title: 'Why?', accent: '#005974' }) as any;
    const json = JSON.stringify(tree);
    expect(json).toContain('#005974');
    expect(json).toContain('Trade');
    expect(json).toContain(OG_COLOURS.paper);
    // A card with no accent still renders, in ink.
    expect(JSON.stringify(ogTree({ eyebrow: 'x', title: 'y' }))).toContain(OG_COLOURS.ink);
  });

  it('defaults the call to action rather than leaving it blank', () => {
    expect(JSON.stringify(ogTree({ eyebrow: 'x', title: 'y' }))).toContain('Read the answer');
  });
});
