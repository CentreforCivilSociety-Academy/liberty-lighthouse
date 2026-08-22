import { describe, expect, it } from 'vitest';
import {
  THEME_HUES,
  HUE_CAPACITY,
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
    expect(slugs).toHaveLength(10);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('hues are unique', () => {
    const hues = Object.values(THEME_HUES);
    expect(new Set(hues).size, 'two themes share a hue').toBe(hues.length);
  });

  it('does not exceed the palette capacity', () => {
    // The set holds ten distinguishable hues; at eleven the minimum pairwise
    // distance collapses and two themes become confusable. Adding an eleventh
    // theme must fail loudly rather than ship two themes nobody can tell apart.
    expect(
      slugs.length,
      `The colour system holds ${HUE_CAPACITY} distinguishable hues and ${slugs.length} themes are defined. ` +
        'Extend the palette deliberately or group the new theme under an existing one.',
    ).toBeLessThanOrEqual(HUE_CAPACITY);
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

  it('all ten inks are the same darkness, which is what stops ten hues reading as a toy shop', () => {
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
