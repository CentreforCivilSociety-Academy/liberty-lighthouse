import { describe, expect, it } from 'vitest';
import colors from '../../src/content/settings/colors.json';
import { COLORS_DEFAULTS } from '../../src/lib/fonts';

/**
 * WCAG 2.1 contrast guards.
 *
 * These exist because three tokens shipped below AA for a long time without
 * anyone noticing: colorTextMuted was 2.54:1 on the page background, and both
 * colorTextTertiary and colorAccentText fell under 4.5:1 on section
 * backgrounds — which meant every link on a section background failed.
 *
 * The colour settings are editable through Decap by non-designers, so an
 * assertion is the only thing standing between an editor with a colour picker
 * and an inaccessible site.
 */

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex: string): number => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
};

export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3.0;

// Both surfaces a reader meets. bg-section is the harder of the two, so a
// token that passes there passes on the page as well.
const SURFACES: Array<[string, string]> = [
  ['bg-page', colors.colorBgPage],
  ['bg-section', colors.colorBgSection],
];

// Tokens used for text below 18pt. No large-text exemption applies to any of
// these — text-muted alone appears at 0.75rem in a dozen places.
const TEXT_TOKENS: Array<[string, string]> = [
  ['colorTextPrimary', colors.colorTextPrimary],
  ['colorTextSecondary', colors.colorTextSecondary],
  ['colorTextTertiary', colors.colorTextTertiary],
  ['colorTextMuted', colors.colorTextMuted],
  ['colorAccentText', colors.colorAccentText],
];

describe('colour contrast', () => {
  for (const [surfaceName, surface] of SURFACES) {
    for (const [tokenName, token] of TEXT_TOKENS) {
      it(`${tokenName} meets AA on ${surfaceName}`, () => {
        const ratio = contrastRatio(token, surface);
        expect(
          ratio,
          `${tokenName} (${token}) on ${surfaceName} (${surface}) = ${ratio.toFixed(2)}:1, needs ${AA_TEXT}:1`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it('text tiers stay perceptibly distinct rather than collapsing', () => {
    const section = colors.colorBgSection;
    const ladder = [
      contrastRatio(colors.colorTextPrimary, section),
      contrastRatio(colors.colorTextSecondary, section),
      contrastRatio(colors.colorTextTertiary, section),
      contrastRatio(colors.colorTextMuted, section),
    ];
    // Strictly descending: primary darkest, muted lightest.
    for (let i = 1; i < ladder.length; i += 1) {
      expect(
        ladder[i],
        `tier ${i} (${ladder[i].toFixed(2)}) should be lighter than tier ${i - 1} (${ladder[i - 1].toFixed(2)})`,
      ).toBeLessThan(ladder[i - 1]);
    }
    // And separated enough to read as different tiers, not as a rounding error.
    expect(ladder[1] - ladder[2]).toBeGreaterThan(0.5);
    expect(ladder[2] - ladder[3]).toBeGreaterThan(0.5);
  });

  it('focus ring is visible against both surfaces', () => {
    for (const [surfaceName, surface] of SURFACES) {
      const ratio = contrastRatio(colors.colorBorderFocus, surface);
      expect(
        ratio,
        `colorBorderFocus on ${surfaceName} = ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });

  it('code defaults match the CMS settings, so a fresh build cannot regress', () => {
    for (const [tokenName] of TEXT_TOKENS) {
      const key = tokenName as keyof typeof COLORS_DEFAULTS;
      expect(
        (COLORS_DEFAULTS[key] as string).toLowerCase(),
        `${tokenName} differs between COLORS_DEFAULTS and colors.json`,
      ).toBe((colors[key as keyof typeof colors] as string).toLowerCase());
    }
  });
});
