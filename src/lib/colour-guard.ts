/**
 * Contrast guards that run during the build.
 *
 * The colours used to be 21 free pickers in the CMS. On 19 August someone at
 * CCS set the brand colour to electric green, then the page background to navy
 * with white text, then put it all back — three commits in one session on the
 * live site. It broke because changing one token in a palette tuned around a
 * single hue, while the borders and cards stayed where they were, cannot
 * produce anything but a broken page. The pickers were the problem, not the
 * person using them.
 *
 * What remains editable is a two-option contrast mode, and both options are
 * solved and measured. This asserts that at build time anyway: if a value ever
 * reaches the palette that fails AA, the deploy stops with a message naming the
 * token and its measured ratio, rather than shipping unreadable text.
 */

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

type Palette = Record<string, string>;

/** Throws with everything wrong at once, rather than one failure at a time. */
export function assertColours(colours: Palette): void {
  const problems: string[] = [];

  const surfaces: Array<[string, string]> = [
    ['the page background', colours.colorBgPage],
    ['section backgrounds', colours.colorBgSection],
  ];

  // Text below 18pt. No large-text exemption applies to any of these:
  // colorTextMuted alone appears at 0.75rem in a dozen places.
  const textTokens = [
    'colorTextPrimary',
    'colorTextSecondary',
    'colorTextTertiary',
    'colorTextMuted',
    'colorAccentText',
  ];

  for (const token of textTokens) {
    const value = colours[token];
    if (!value) continue;
    for (const [where, surface] of surfaces) {
      const ratio = contrastRatio(value, surface);
      if (ratio < AA_TEXT) {
        problems.push(
          `${token} (${value}) on ${where} (${surface}) measures ${ratio.toFixed(2)}:1. ` +
            `Text needs ${AA_TEXT}:1 to be readable.`,
        );
      }
    }
  }

  // Text on the dark band, and the focus ring, which is not text.
  const onDark = contrastRatio(colours.colorTextOnDark, colours.colorBgDark);
  if (onDark < AA_TEXT) {
    problems.push(
      `colorTextOnDark (${colours.colorTextOnDark}) on colorBgDark (${colours.colorBgDark}) ` +
        `measures ${onDark.toFixed(2)}:1, needs ${AA_TEXT}:1.`,
    );
  }
  for (const [where, surface] of surfaces) {
    const ring = contrastRatio(colours.colorBorderFocus, surface);
    if (ring < AA_NON_TEXT) {
      problems.push(
        `colorBorderFocus (${colours.colorBorderFocus}) on ${where} measures ` +
          `${ring.toFixed(2)}:1. A focus ring needs ${AA_NON_TEXT}:1 or keyboard users cannot see it.`,
      );
    }
  }

  // The tiers have to stay distinguishable from each other, not just readable.
  const ladder = ['colorTextPrimary', 'colorTextSecondary', 'colorTextTertiary', 'colorTextMuted']
    .map((t) => ({ token: t, ratio: contrastRatio(colours[t], colours.colorBgSection) }));
  for (let i = 1; i < ladder.length; i += 1) {
    if (ladder[i].ratio >= ladder[i - 1].ratio) {
      problems.push(
        `${ladder[i].token} is not lighter than ${ladder[i - 1].token} ` +
          `(${ladder[i].ratio.toFixed(2)}:1 against ${ladder[i - 1].ratio.toFixed(2)}:1). ` +
          'The text tiers would be indistinguishable.',
      );
    }
  }

  if (problems.length) {
    throw new Error(
      'Colour settings fail WCAG AA and would ship unreadable text:\n' +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\n\nFix the values, or revert the colour settings in the CMS.',
    );
  }
}

/**
 * The high-contrast variant of the text ramp.
 *
 * Same hues, each tier darker, solved against the harder of the two grounds
 * and re-measured on the result. The ladder stays strictly ordered:
 * 16.29 > 9.05 > 7.45 > 6.06 against section backgrounds.
 */
export const HIGH_CONTRAST_TEXT = {
  colorTextSecondary: '#49413B',
  colorTextTertiary: '#564D49',
  colorTextMuted: '#655A53',
  colorAccentText: '#894D28',
} as const;
