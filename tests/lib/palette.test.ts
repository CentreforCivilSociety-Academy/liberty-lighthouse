import { describe, expect, it } from 'vitest';
import {
  THEME_HUES,
  SEPARATION_FLOOR,
  assignHues,
  hueDistance,
  minSeparation,
  themePalette,
  contrastRatio,
  relativeLuminance,
  oklchToHex,
  PAPER,
  SECTION,
} from '../../src/lib/palette';

/**
 * The palette is solved, not authored, so these assert the properties the
 * solution is supposed to have. Every ratio is measured on the gamut-clipped
 * hex that actually renders — a palette verified on its OKLCH intent is
 * unverified, because clipping changes the colour.
 */

const AA_TEXT = 4.5;
const AAA_TEXT = 7.0;

describe('theme palette', () => {
  const palette = themePalette();
  const slugs = Object.keys(THEME_HUES);

  it('covers every topic slug exactly once', () => {
    expect(slugs).toHaveLength(12);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('hues are unique', () => {
    const hues = Object.values(THEME_HUES);
    expect(new Set(hues).size, 'two themes share a hue').toBe(hues.length);
  });

  it('the pinned set stays clear of the separation floor', () => {
    // Each hue past the last costs separation. The build no longer stops when
    // a theme arrives without a hue, so this is what keeps the pinned set
    // honest: the shipped colours must sit well above the floor.
    const separation = minSeparation(Object.values(THEME_HUES));
    expect(
      separation,
      `the closest pinned pair is ${separation.toFixed(2)} apart`,
    ).toBeGreaterThan(SEPARATION_FLOOR);
  });

  it('ink clears AAA on both grounds', () => {
    for (const [slug, c] of Object.entries(palette)) {
      expect(c.inkRatioOnSection, `${slug} ink on section (${c.ink})`).toBeGreaterThanOrEqual(AAA_TEXT);
      expect(c.inkRatioOnPaper, `${slug} ink on paper (${c.ink})`).toBeGreaterThanOrEqual(AAA_TEXT);
    }
  });

  it('fill clears AA on both grounds, with headroom', () => {
    for (const [slug, c] of Object.entries(palette)) {
      expect(c.fillRatioOnSection, `${slug} fill on section (${c.fill})`).toBeGreaterThanOrEqual(AA_TEXT);
      expect(c.fillRatioOnPaper, `${slug} fill on paper (${c.fill})`).toBeGreaterThanOrEqual(AA_TEXT);
      // Headroom, so a rounding change cannot drop it under the floor. This is
      // the specific failure that made copying the cool-paper values onto warm
      // paper unsafe: they landed at 4.51, one hundredth above the limit.
      expect(c.fillRatioOnSection - AA_TEXT, `${slug} fill has no headroom`).toBeGreaterThan(0.1);
    }
  });

  it('every ink is the same darkness, which is what stops a dozen hues reading as a toy shop', () => {
    const lums = Object.values(palette).map((c) => relativeLuminance(c.ink));
    const spread = (Math.max(...lums) + 0.05) / (Math.min(...lums) + 0.05);
    expect(spread, `ink luminance spread ${spread.toFixed(4)}:1`).toBeLessThan(1.05);
  });

  it('adjacent hues stay distinguishable', () => {
    // Compare every pair in sRGB after clipping — the point is whether the
    // rendered colours differ, not whether their hue angles do.
    const entries = Object.entries(palette);
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [aSlug, a] = entries[i];
        const [bSlug, b] = entries[j];
        expect(a.ink, `${aSlug} and ${bSlug} resolve to the same ink`).not.toBe(b.ink);
        const d = Math.abs(relativeLuminance(a.ink) - relativeLuminance(b.ink));
        // Equal luminance is deliberate, so they must differ in hue instead;
        // identical hex is the failure, not identical lightness.
        expect(d).toBeLessThan(0.02);
      }
    }
  });

  it('gamut clipping is applied, not assumed away', () => {
    // Teal and green at this lightness cannot hold the requested chroma in
    // sRGB. The solver must clip and still hit its contrast target rather
    // than emitting an out-of-gamut colour that the browser silently clamps.
    const clipped = Object.values(palette).filter((c) => c.inkChroma < 0.159);
    expect(clipped.length, 'expected some hues to clip in sRGB').toBeGreaterThan(0);
    for (const c of Object.values(palette)) {
      expect(c.inkRatioOnSection).toBeGreaterThanOrEqual(AAA_TEXT);
    }
  });

  it('oklchToHex stays inside sRGB', () => {
    for (const hue of Object.values(THEME_HUES)) {
      const { hex } = oklchToHex(0.5, 0.4, hue); // deliberately unreachable chroma
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('the two grounds are the ones the tokens actually use', () => {
    expect(contrastRatio(PAPER, SECTION)).toBeLessThan(1.2);
  });
});

/**
 * The CMS can publish a theme but cannot edit palette.ts, so an unpinned slug
 * has to resolve to something. These assert the properties that make the
 * automatic answer safe to ship: it covers, it does not collide, it stays
 * apart, and it does not move between builds.
 */
describe('hues for unpinned themes', () => {
  const pinned = Object.keys(THEME_HUES);

  it('gives every unpinned slug a hue', () => {
    const hues = assignHues([...pinned, 'housing', 'energy']);
    expect(hues.housing, 'housing went uncoloured').toBeTypeOf('number');
    expect(hues.energy, 'energy went uncoloured').toBeTypeOf('number');
  });

  it('never moves a pinned hue', () => {
    const hues = assignHues([...pinned, 'housing', 'energy', 'water']);
    for (const slug of pinned) {
      expect(hues[slug], `${slug} was reassigned`).toBe(THEME_HUES[slug]);
    }
  });

  it('does not hand out a hue twice', () => {
    const hues = assignHues([...pinned, 'housing', 'energy', 'water', 'health']);
    const values = Object.values(hues);
    expect(new Set(values).size, 'two themes share a hue').toBe(values.length);
  });

  it('keeps an assigned theme clear of the floor', () => {
    const hues = assignHues([...pinned, 'housing']);
    for (const slug of pinned) {
      expect(
        hueDistance(hues.housing, THEME_HUES[slug]),
        `assigned hue sits on top of ${slug}`,
      ).toBeGreaterThan(SEPARATION_FLOOR);
    }
  });

  it('is deterministic — the same slugs give the same hues every build', () => {
    const a = assignHues([...pinned, 'housing', 'energy']);
    const b = assignHues(['energy', 'housing', ...pinned].reverse());
    expect(b).toEqual(a);
  });

  it('is stable when a later-sorting theme is appended', () => {
    // Pinning is what freezes a colour, but appending must not disturb what is
    // already there, or every new theme would repaint the last one.
    const before = assignHues([...pinned, 'housing']);
    const after = assignHues([...pinned, 'housing', 'water']);
    expect(after.housing).toBe(before.housing);
  });

  it('the palette carries assigned themes through to colours', () => {
    const palette = themePalette([...pinned, 'housing']);
    expect(palette.housing, 'housing has no colours').toBeDefined();
    expect(palette.housing.inkRatioOnSection).toBeGreaterThanOrEqual(AAA_TEXT);
    expect(palette.housing.fillRatioOnSection).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('asking for only the pinned themes changes nothing', () => {
    expect(assignHues(pinned)).toEqual(THEME_HUES);
  });
});
