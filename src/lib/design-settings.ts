/**
 * Design settings loader.
 * Reads typography and color settings from the CMS content collection
 * and returns ready-to-use CSS values with fallbacks to defaults.
 */
import { getCollection } from 'astro:content';
import { assertColours, HIGH_CONTRAST_TEXT } from './colour-guard.js';
import {
  TYPOGRAPHY_DEFAULTS,
  COLORS_DEFAULTS,
  buildGoogleFontsUrl,
  buildFontFamilyValue,
  selfHostedPreloads,
} from './fonts.js';

export async function getTypographySettings() {
  const settings = await getCollection('settings');
  const entry = settings.find((s) => s.id === 'typography');
  const data = entry?.data ?? {};

  const displayFont = data.displayFont ?? TYPOGRAPHY_DEFAULTS.displayFont;
  const bodyFont = data.bodyFont ?? TYPOGRAPHY_DEFAULTS.bodyFont;
  const monoFont = data.monoFont ?? TYPOGRAPHY_DEFAULTS.monoFont;
  const baseFontSize = data.baseFontSize ?? TYPOGRAPHY_DEFAULTS.baseFontSize;
  const baseLineHeight = data.baseLineHeight ?? TYPOGRAPHY_DEFAULTS.baseLineHeight;
  const heroTitleSize = data.heroTitleSize ?? TYPOGRAPHY_DEFAULTS.heroTitleSize;
  const h1Size = data.h1Size ?? TYPOGRAPHY_DEFAULTS.h1Size;
  const h2Size = data.h2Size ?? TYPOGRAPHY_DEFAULTS.h2Size;
  const h3Size = data.h3Size ?? TYPOGRAPHY_DEFAULTS.h3Size;

  return {
    displayFont,
    bodyFont,
    monoFont,
    baseFontSize,
    baseLineHeight,
    heroTitleSize,
    h1Size,
    h2Size,
    h3Size,
    fontsUrl: buildGoogleFontsUrl(displayFont, bodyFont, monoFont),
    fontPreloads: selfHostedPreloads(displayFont, bodyFont, monoFont),
    displayFontFamily: buildFontFamilyValue(displayFont),
    bodyFontFamily: buildFontFamilyValue(bodyFont),
    monoFontFamily: buildFontFamilyValue(monoFont),
  };
}

export async function getColorSettings() {
  const settings = await getCollection('settings');
  const entry = settings.find((s) => s.id === 'colors');
  const data = entry?.data ?? {};

  /*
   * The palette lives in code. What the CMS still offers is a contrast mode,
   * because both of its options are solved and measured; 21 free colour
   * pickers were not, and produced a broken live site the one time they were
   * used in anger.
   */
  const highContrast = data.contrastMode === 'high';
  const text = highContrast ? HIGH_CONTRAST_TEXT : COLORS_DEFAULTS;

  const colours = {
    colorPrimary: COLORS_DEFAULTS.colorPrimary,
    colorPrimaryLight: COLORS_DEFAULTS.colorPrimaryLight,
    colorAccent: COLORS_DEFAULTS.colorAccent,
    colorAccentText: text.colorAccentText,
    colorAccentSoft: COLORS_DEFAULTS.colorAccentSoft,
    colorTextPrimary: COLORS_DEFAULTS.colorTextPrimary,
    colorTextSecondary: text.colorTextSecondary,
    colorTextTertiary: text.colorTextTertiary,
    colorTextMuted: text.colorTextMuted,
    colorTextOnDark: COLORS_DEFAULTS.colorTextOnDark,
    colorBgPage: COLORS_DEFAULTS.colorBgPage,
    colorBgSection: COLORS_DEFAULTS.colorBgSection,
    colorBgCard: COLORS_DEFAULTS.colorBgCard,
    colorBgElevated: COLORS_DEFAULTS.colorBgElevated,
    colorBgDark: COLORS_DEFAULTS.colorBgDark,
    colorBgDarkSoft: COLORS_DEFAULTS.colorBgDarkSoft,
    colorBorderDefault: COLORS_DEFAULTS.colorBorderDefault,
    colorBorderStrong: COLORS_DEFAULTS.colorBorderStrong,
    colorBorderSubtle: COLORS_DEFAULTS.colorBorderSubtle,
    colorBorderFocus: COLORS_DEFAULTS.colorBorderFocus,
    colorSuccess: COLORS_DEFAULTS.colorSuccess,
    colorWarning: COLORS_DEFAULTS.colorWarning,
    colorError: COLORS_DEFAULTS.colorError,
    radiusSm: COLORS_DEFAULTS.radiusSm,
    radiusMd: COLORS_DEFAULTS.radiusMd,
    radiusLg: COLORS_DEFAULTS.radiusLg,
    themeColor: COLORS_DEFAULTS.themeColor,
  };

  // Fails the deploy rather than shipping unreadable text.
  assertColours(colours);

  return colours;
}
