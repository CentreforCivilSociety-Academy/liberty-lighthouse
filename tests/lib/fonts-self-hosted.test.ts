import { describe, expect, it } from 'vitest';
import {
  SELF_HOSTED_FONTS,
  buildGoogleFontsUrl,
  buildFontFamilyValue,
  selfHostedPreloads,
  TYPOGRAPHY_DEFAULTS,
} from '../../src/lib/fonts';
import typography from '../../src/content/settings/typography.json';

/**
 * Guards for the self-hosted font pipeline.
 *
 * Before this, the site fetched a render-blocking stylesheet from
 * fonts.googleapis.com and only then requested binaries from fonts.gstatic.com
 * — 133.8 KB across 5 requests to 2 third-party origins, with EB Garamond
 * served as legacy .woff. buildFontFamilyValue also returned a bare quoted
 * family name with no fallback at all, so a failed webfont dropped the reader
 * onto an unstyled default.
 */

describe('self-hosted fonts', () => {
  it('the three families the site actually uses are all self-hosted', () => {
    expect(Object.keys(SELF_HOSTED_FONTS).sort()).toEqual([
      'EB Garamond',
      'JetBrains Mono',
      'Roboto',
    ]);
  });

  it('the CMS-selected families are self-hosted, so no CDN request is emitted', () => {
    const url = buildGoogleFontsUrl(
      typography.displayFont,
      typography.bodyFont,
      typography.monoFont,
    );
    expect(
      url,
      `expected no Google Fonts URL for ${typography.displayFont} / ${typography.bodyFont} / ${typography.monoFont}`,
    ).toBe('');
  });

  it('falls back to Google Fonts for catalogue families that are not self-hosted', () => {
    const url = buildGoogleFontsUrl('Lora', 'Inter', 'JetBrains Mono');
    expect(url).toContain('fonts.googleapis.com');
    expect(url).toContain('Lora');
    expect(url).toContain('Inter');
    // The self-hosted one must not be requested from the CDN as well.
    expect(url).not.toContain('JetBrains');
  });

  it('every family value carries a real fallback stack', () => {
    for (const name of ['EB Garamond', 'Roboto', 'JetBrains Mono', 'Lora', 'Inter']) {
      const stack = buildFontFamilyValue(name);
      expect(stack.split(',').length, `${name} has no fallback: ${stack}`).toBeGreaterThan(1);
      expect(stack).toMatch(/(serif|sans-serif|monospace)\s*$/);
    }
  });

  it('serif stacks name Georgia explicitly, since the metric-matched face targets it', () => {
    const stack = buildFontFamilyValue('EB Garamond');
    expect(stack).toContain("'EB Garamond Var'");
    expect(stack).toContain("'EB Garamond Fallback'");
    expect(stack).toContain('Georgia');
  });

  it('JetBrains Mono declares no fallback face — the generic already matches to 0.34%', () => {
    expect(SELF_HOSTED_FONTS['JetBrains Mono'].fallbackFamily).toBeNull();
    expect(buildFontFamilyValue('JetBrains Mono')).toBe("'JetBrains Mono Var', monospace");
  });

  it('preloads exactly the self-hosted binaries, deduplicated', () => {
    const preloads = selfHostedPreloads('EB Garamond', 'Roboto', 'JetBrains Mono');
    expect(preloads).toEqual([
      '/fonts/eb-garamond-var.woff2',
      '/fonts/roboto-var.woff2',
      '/fonts/jetbrains-mono-var.woff2',
    ]);
    // A catalogue font contributes nothing to preload.
    expect(selfHostedPreloads('Lora', 'Inter', 'JetBrains Mono')).toEqual([
      '/fonts/jetbrains-mono-var.woff2',
    ]);
    // Same family in two slots is preloaded once.
    expect(selfHostedPreloads('Roboto', 'Roboto', 'Roboto')).toHaveLength(1);
  });

  it('typography defaults name self-hosted families, so a fresh install is fast', () => {
    for (const key of ['displayFont', 'bodyFont', 'monoFont'] as const) {
      expect(
        SELF_HOSTED_FONTS[TYPOGRAPHY_DEFAULTS[key]],
        `TYPOGRAPHY_DEFAULTS.${key} = "${TYPOGRAPHY_DEFAULTS[key]}" is not self-hosted`,
      ).toBeDefined();
    }
  });
});
