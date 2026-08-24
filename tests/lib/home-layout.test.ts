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
    expect(BREAKPOINTS).toEqual([646, 714, 1156]);
  });

  it('the plate breakpoint agrees across every file that hardcodes it', () => {
    /*
     * It lives in four places and CSS cannot put a custom property in a media
     * query, so nothing but a test keeps them in step. They drifted once
     * already: the section headings in home.css still named 565/814/1161 after
     * the queries had moved, which is how a rule silently failed to apply.
     */
    const PLATE = 1156;
    const files: Array<[string, RegExp]> = [
      ['src/styles/home.css', new RegExp(`@media \\(min-width: ${PLATE}px\\)`)],
      ['src/components/global/BottomNav.astro', new RegExp(`min-width: ${PLATE}px`)],
      ['src/components/home/ThemeRail.astro', new RegExp(`min-width: ${PLATE}px`)],
      ['src/styles/global.css', new RegExp(`max-width: ${PLATE - 1}px`)],
    ];
    for (const [file, pattern] of files) {
      const body = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(pattern.test(body), `${file} does not use the plate breakpoint ${PLATE}`).toBe(true);
      expect(/1224|1223|1161|1160/.test(body), `${file} still references a retired breakpoint`).toBe(false);
    }
  });

  it('grows the page with the screen instead of padding it', () => {
    /*
     * The measure cap is a count of characters, so scaling the type scales the
     * column and characters-per-line stays put. Without this the design simply
     * stopped at 1156 and added margin: a 2560px display got byte-identical
     * content with 753px of nothing on each side.
     *
     * --u must be a length. clamp() cannot mix a unitless number with a
     * length; written that way the declaration is invalid, the variable never
     * resolves, and the grid collapses.
     */
    const plate = css.slice(css.indexOf('@media (min-width: 1156px)'));
    expect(plate).toMatch(/--u:\s*clamp\(1rem,\s*calc\(1rem \+ \(100vw - 1156px\) \/ \d+\),\s*1\.4rem\)/);
    // Type and tracks must both key off it, or the measure drifts.
    for (const sel of ['.index-question', '.section-title', '.shoulder-question']) {
      const rule = new RegExp(`\\${sel}\\s*\\{\\s*font-size:\\s*calc\\([\\d.]+ \\* var\\(--u\\)\\)`);
      expect(rule.test(plate), `${sel} does not scale with --u`).toBe(true);
    }
    // A fixed-rem override later in the file silently beat the scaled rule once.
    expect(plate).not.toMatch(/\.index-question\s*\{\s*font-size:\s*[\d.]+rem/);
  });

  it('centres the plate once it is terminal, rather than pinning it left', () => {
    /*
     * The field is at the measure ceiling, so nothing in the reading apparatus
     * grows past the plate. Letting all surplus fall right made the right
     * margin 789px at 1920 and 1,404px at 2560 against a 740px row — wider
     * than the thing it surrounded, which is a void rather than a margin.
     */
    const plate = css.slice(css.indexOf('@media (min-width: 1156px)'));
    expect(plate).toMatch(/--plate-w:\s*calc\(/);
    expect(plate).toMatch(/--edge:\s*max\(3rem,\s*calc\(\(100% - var\(--plate-w\)\) \/ 2\)\)/);
    // A rule bleeding only rightward would lean the page again.
    expect(plate).not.toMatch(/\.section-rule\s*\{[^}]*grid-column:\s*field \/ end/);
  });

  it('no longer reserves a gutter for the deleted margin rule', () => {
    // The rule encoded question length and was cut; its width went back to
    // the margins rather than into the field, which is already at the measure
    // ceiling of 2.5 alphabets.
    expect(rules).not.toMatch(/--mark-w/);
    expect(rules).toMatch(/\[gutter\]\s*var\(--gutter\)/);
  });

  it('the grid has a right edge track, so the field never runs to the viewport edge', () => {
    // Without it, `rag` collapses at narrow widths and content touches the edge.
    expect(css).toMatch(/\[redge\]\s*var\(--edge\)\s*\[end\]/);
  });

  it('every boundary is paid for by surplus, never by the reading column', () => {
    const lanes = [
      { at: null as number | null, edge: 1.25, spine: 0, mark: 0, field: 34 },
      { at: 646, edge: 2, spine: 0, mark: 0, field: 34 },
      { at: 714, edge: 3, spine: 0, mark: 0, field: 36 },
      { at: 1156, edge: 3, spine: 18.75, mark: 2, field: 41.25 },
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
    expect(tokenAt('--field-max', 714)).toBeCloseTo(rem(36), 1);
    // Above the plate these become multiples of --u rather than fixed rem, so
    // the block grows with the screen while the measure stays fixed.
    const plate = css.slice(css.indexOf('@media (min-width: 1156px)'));
    expect(plate).toMatch(/--spine-w:\s*calc\(18\.75 \* var\(--u\)\)/);
    expect(plate).toMatch(/--field-max:\s*calc\(41\.25 \* var\(--u\)\)/);
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
