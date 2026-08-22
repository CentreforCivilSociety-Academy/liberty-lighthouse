import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import typography from '../../src/content/settings/typography.json';

/**
 * Guards the homepage lane arithmetic.
 *
 * The design has one rule: a track opens at the smallest width where the
 * surplus right margin alone pays for it, so widening the viewport never
 * narrows the reading column. Round-number breakpoints broke it — at a 565px
 * boundary the field went from 522px to 497px, and at 360px the grid had no
 * right edge track at all, so the search button was clipped.
 *
 * This reads the real stylesheet rather than a copy of its numbers, so
 * changing a token or a breakpoint without redoing the arithmetic fails here.
 */

const css = readFileSync(resolve(process.cwd(), 'src/styles/home.css'), 'utf8');

/** Rules only — the header comment discusses @layer and .contents by name. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Root px. The CMS drives this; media queries are authored in px to match. */
const ROOT_PX = (typography.baseFontSize / 100) * 16;
const rem = (r: number) => r * ROOT_PX;

/** First declaration of a custom property inside a given @media block (or base). */
function tokenAt(prop: string, minWidth: number | null): number {
  const scope = minWidth === null
    ? css.slice(0, css.indexOf('@media'))
    : css.slice(css.indexOf(`@media (min-width: ${minWidth}px)`));
  const m = scope.match(new RegExp(`${prop}:\\s*([^;]+);`));
  if (!m) throw new Error(`${prop} not found for ${minWidth ?? 'base'}`);
  const raw = m[1].trim();
  const clampMin = raw.match(/clamp\(\s*([\d.]+)rem/);
  if (clampMin) return rem(parseFloat(clampMin[1]));
  const asRem = raw.match(/^([\d.]+)rem$/);
  if (asRem) return rem(parseFloat(asRem[1]));
  if (raw === '0') return 0;
  throw new Error(`cannot parse ${prop}: ${raw}`);
}

const BREAKPOINTS = [...css.matchAll(/@media \(min-width: (\d+)px\)/g)]
  .map((m) => Number(m[1]))
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort((a, b) => a - b);

describe('homepage lane arithmetic', () => {
  it('declares exactly three lane boundaries', () => {
    expect(BREAKPOINTS).toEqual([646, 774, 1224]);
  });

  it('the grid has a right edge track, so the field never runs to the viewport edge', () => {
    // Without it, `rag` collapses at narrow widths and content touches the edge.
    expect(css).toMatch(/\[redge\]\s*var\(--edge\)\s*\[end\]/);
  });

  it('every boundary is paid for by surplus, never by the reading column', () => {
    const lanes = [
      { at: null as number | null, edge: 1.25, spine: 0, mark: 0, field: 34 },
      { at: 646, edge: 2, spine: 0, mark: 0, field: 34 },
      { at: 774, edge: 3, spine: 0, mark: 3.5, field: 36 },
      { at: 1224, edge: 3, spine: 18.75, mark: 6, field: 41.25 },
    ];

    for (const lane of lanes) {
      if (lane.at === null) continue;
      // Demand of the new lane at its own breakpoint.
      const demand =
        rem(lane.edge) * 2 + rem(lane.spine) + rem(lane.mark) + rem(lane.field);
      expect(
        lane.at,
        `lane at ${lane.at}px demands ${demand.toFixed(1)}px; the boundary must not be below it ` +
          'or the new track is paid for out of the reading column',
      ).toBeGreaterThanOrEqual(Math.floor(demand));
      // And not wastefully late: within a pixel of the true minimum.
      expect(lane.at - demand, `lane at ${lane.at}px opens later than necessary`).toBeLessThan(1);
    }
  });

  it('the reading column is non-decreasing across lanes', () => {
    const fields = [34, 34, 36, 41.25];
    for (let i = 1; i < fields.length; i += 1) {
      expect(fields[i], `field shrank at lane ${i}`).toBeGreaterThanOrEqual(fields[i - 1]);
    }
  });

  it('token values in the stylesheet still match the solved arithmetic', () => {
    expect(tokenAt('--field-max', null)).toBeCloseTo(rem(34), 1);
    expect(tokenAt('--edge', 646)).toBeCloseTo(rem(2), 1);
    expect(tokenAt('--field-max', 774)).toBeCloseTo(rem(36), 1);
    expect(tokenAt('--spine-w', 1224)).toBeCloseTo(rem(18.75), 1);
    expect(tokenAt('--field-max', 1224)).toBeCloseTo(rem(41.25), 1);
  });

  it('the census spans a row count supplied by the page, not a guess', () => {
    // `1 / -1` counts back from the last EXPLICIT line, and this grid declares
    // only columns — so it collapsed to row 1 and stretched it by 193px.
    expect(css).toMatch(/grid-row:\s*1\s*\/\s*span\s*var\(--home-rows/);
    expect(css).not.toMatch(/grid-row:\s*1\s*\/\s*-1/);
  });

  it('is not wrapped in a cascade layer', () => {
    // The CMS injects unlayered h1/h2/h3 font-size rules that beat every layer,
    // so anything here inside @layer would silently lose.
    expect(rules).not.toMatch(/@layer/);
  });

  it('does not use the .contents class, which Tailwind defines as display:contents', () => {
    expect(rules).not.toMatch(/\.contents\s*\{/);
    expect(rules).toMatch(/\.contents-nav\s*\{/);
  });
});
