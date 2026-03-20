/**
 * Design settings loader.
 * Reads typography and color settings from the CMS content collection
 * and returns ready-to-use CSS values with fallbacks to defaults.
 */
import { getCollection } from 'astro:content';
import {
  TYPOGRAPHY_DEFAULTS,
  COLORS_DEFAULTS,
  buildGoogleFontsUrl,
  buildFontFamilyValue,
} from './fonts';

export async function getTypographySettings() {
  const settings = await getCollection('settings');
  const entry = settings.find((s) => s.id === 'typography');
  const data = entry?.data ?? {};

  const displayFont = data.displayFont ?? TYPOGRAPHY_DEFAULTS.displayFont;
  const bodyFont = data.bodyFont ?? TYPOGRAPHY_DEFAULTS.bodyFont;
  const monoFont = data.monoFont ?? TYPOGRAPHY_DEFAULTS.monoFont;
  const baseFontSize = data.baseFontSize ?? TYPOGRAPHY_DEFAULTS.baseFontSize;
  const baseLineHeight = data.baseLineHeight ?? TYPOGRAPHY_DEFAULTS.baseLineHeight;
  const h1Size = data.h1Size ?? TYPOGRAPHY_DEFAULTS.h1Size;
  const h2Size = data.h2Size ?? TYPOGRAPHY_DEFAULTS.h2Size;
  const h3Size = data.h3Size ?? TYPOGRAPHY_DEFAULTS.h3Size;

  return {
    displayFont,
    bodyFont,
    monoFont,
    baseFontSize,
    baseLineHeight,
    h1Size,
    h2Size,
    h3Size,
    fontsUrl: buildGoogleFontsUrl(displayFont, bodyFont, monoFont),
    displayFontFamily: buildFontFamilyValue(displayFont),
    bodyFontFamily: buildFontFamilyValue(bodyFont),
    monoFontFamily: buildFontFamilyValue(monoFont),
  };
}

export async function getColorSettings() {
  const settings = await getCollection('settings');
  const entry = settings.find((s) => s.id === 'colors');
  const data = entry?.data ?? {};

  return {
    colorPrimary: data.colorPrimary ?? COLORS_DEFAULTS.colorPrimary,
    colorPrimaryLight: data.colorPrimaryLight ?? COLORS_DEFAULTS.colorPrimaryLight,
    colorAccent: data.colorAccent ?? COLORS_DEFAULTS.colorAccent,
    colorAccentText: data.colorAccentText ?? COLORS_DEFAULTS.colorAccentText,
    colorAccentSoft: data.colorAccentSoft ?? COLORS_DEFAULTS.colorAccentSoft,
    colorTextPrimary: data.colorTextPrimary ?? COLORS_DEFAULTS.colorTextPrimary,
    colorTextSecondary: data.colorTextSecondary ?? COLORS_DEFAULTS.colorTextSecondary,
    colorTextTertiary: data.colorTextTertiary ?? COLORS_DEFAULTS.colorTextTertiary,
    colorTextMuted: data.colorTextMuted ?? COLORS_DEFAULTS.colorTextMuted,
    colorTextOnDark: data.colorTextOnDark ?? COLORS_DEFAULTS.colorTextOnDark,
    colorBgPage: data.colorBgPage ?? COLORS_DEFAULTS.colorBgPage,
    colorBgSection: data.colorBgSection ?? COLORS_DEFAULTS.colorBgSection,
    colorBgCard: data.colorBgCard ?? COLORS_DEFAULTS.colorBgCard,
    colorBgElevated: data.colorBgElevated ?? COLORS_DEFAULTS.colorBgElevated,
    colorBgDark: data.colorBgDark ?? COLORS_DEFAULTS.colorBgDark,
    colorBgDarkSoft: data.colorBgDarkSoft ?? COLORS_DEFAULTS.colorBgDarkSoft,
    colorBorderDefault: data.colorBorderDefault ?? COLORS_DEFAULTS.colorBorderDefault,
    colorBorderStrong: data.colorBorderStrong ?? COLORS_DEFAULTS.colorBorderStrong,
    colorBorderSubtle: data.colorBorderSubtle ?? COLORS_DEFAULTS.colorBorderSubtle,
    colorBorderFocus: data.colorBorderFocus ?? COLORS_DEFAULTS.colorBorderFocus,
    colorSuccess: data.colorSuccess ?? COLORS_DEFAULTS.colorSuccess,
    colorWarning: data.colorWarning ?? COLORS_DEFAULTS.colorWarning,
    colorError: data.colorError ?? COLORS_DEFAULTS.colorError,
    radiusSm: data.radiusSm ?? COLORS_DEFAULTS.radiusSm,
    radiusMd: data.radiusMd ?? COLORS_DEFAULTS.radiusMd,
    radiusLg: data.radiusLg ?? COLORS_DEFAULTS.radiusLg,
    themeColor: data.themeColor ?? COLORS_DEFAULTS.themeColor,
  };
}
