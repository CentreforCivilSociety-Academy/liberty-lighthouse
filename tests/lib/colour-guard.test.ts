import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertColours, contrastRatio, HIGH_CONTRAST_TEXT } from '../../src/lib/colour-guard';
import { COLORS_DEFAULTS } from '../../src/lib/fonts';

/**
 * The palette used to be 21 free colour pickers in the CMS. Someone at CCS
 * used them on the live site once — brand colour to electric green, then a
 * navy background with white text, then everything reverted — and it broke
 * because one token cannot be changed in isolation in a palette tuned around
 * a single hue. These assert the replacement: two modes, both measured, and a
 * guard that fails the deploy if either ever stops meeting AA.
 */

const comfortable = { ...COLORS_DEFAULTS } as Record<string, string>;
const high = { ...COLORS_DEFAULTS, ...HIGH_CONTRAST_TEXT } as Record<string, string>;

describe('colour guard', () => {
  it('both shipping modes pass', () => {
    expect(() => assertColours(comfortable)).not.toThrow();
    expect(() => assertColours(high)).not.toThrow();
  });

  it('high contrast is genuinely darker at every tier', () => {
    const bg = COLORS_DEFAULTS.colorBgSection;
    for (const token of Object.keys(HIGH_CONTRAST_TEXT) as Array<keyof typeof HIGH_CONTRAST_TEXT>) {
      expect(
        contrastRatio(HIGH_CONTRAST_TEXT[token], bg),
        `${token} is not darker in high contrast`,
      ).toBeGreaterThan(contrastRatio(comfortable[token], bg));
    }
  });

  it('rejects text that fails AA, naming the token and the ratio', () => {
    // The value that actually shipped on this site for months: 2.54:1.
    const broken = { ...comfortable, colorTextMuted: '#A89E96' };
    expect(() => assertColours(broken)).toThrow(/colorTextMuted/);
    expect(() => assertColours(broken)).toThrow(/2\.5\d:1/);
  });

  it('rejects the navy-background experiment that broke the live site', () => {
    const navy = { ...comfortable, colorBgPage: '#06064b' };
    expect(() => assertColours(navy)).toThrow(/WCAG AA/);
  });

  it('rejects a focus ring a keyboard user could not see', () => {
    expect(() => assertColours({ ...comfortable, colorBorderFocus: '#FBFAF9' })).toThrow(
      /focus ring/,
    );
  });

  it('rejects a text ramp whose tiers stop being distinguishable', () => {
    // Muted darker than tertiary: both readable, but the hierarchy is gone.
    const flat = { ...comfortable, colorTextMuted: comfortable.colorTextPrimary };
    expect(() => assertColours(flat)).toThrow(/indistinguishable|not lighter/);
  });

  it('reports every problem at once rather than one per build', () => {
    const bad = { ...comfortable, colorTextMuted: '#A89E96', colorTextTertiary: '#B5ABA3' };
    try {
      assertColours(bad);
      throw new Error('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('colorTextMuted');
      expect(message).toContain('colorTextTertiary');
    }
  });
});

describe('CMS surface', () => {
  const config = readFileSync(resolve(process.cwd(), 'public/admin/config.yml'), 'utf8');

  it('exposes no free colour pickers', () => {
    expect(config).not.toMatch(/widget: "color"/);
  });

  it('offers contrast as the only colour setting', () => {
    expect(config).toContain('name: "contrastMode"');
  });

  /** Just the typography entry — the file continues into other collections. */
  const typographyEntry = (() => {
    const start = config.indexOf('name: "typography"');
    const rest = config.slice(start);
    const next = rest.slice(1).search(/\n      - (?:name|label): "/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  })();

  it('offers only the self-hosted typefaces', () => {
    // Anything else falls back to Google Fonts and undoes the font pipeline:
    // two third-party round-trips before text can render in the right face.
    const values = [...typographyEntry.matchAll(/value: "([^"]+)" \}/g)].map((m) => m[1]);
    expect(new Set(values)).toEqual(new Set(['EB Garamond', 'Roboto', 'JetBrains Mono']));
  });

  it('clamps the root font size to sizes that keep the measure readable', () => {
    // 75% to 150% put five of thirteen settings outside a 45-80 character
    // measure, and the solved breakpoints assume a 17px root.
    expect(typographyEntry).toMatch(/min: 93\.75/);
    expect(typographyEntry).toMatch(/max: 118\.75/);
  });
});
