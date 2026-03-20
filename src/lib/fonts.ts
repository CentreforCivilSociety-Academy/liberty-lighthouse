/**
 * Font registry and Google Fonts URL builder.
 * Maps curated font names to their Google Fonts API parameters and CSS fallback stacks.
 */

// ── Font Registry ──
// Each entry: [Google Fonts family parameter, CSS fallback stack]

type FontEntry = { param: string; fallback: string };

const DISPLAY_FONTS: Record<string, FontEntry> = {
  'Fraunces': {
    param: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Playfair Display': {
    param: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Merriweather': {
    param: 'Merriweather:ital,wght@0,400;0,700;1,400',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Lora': {
    param: 'Lora:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Libre Baskerville': {
    param: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Cormorant Garamond': {
    param: 'Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'EB Garamond': {
    param: 'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Crimson Text': {
    param: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Spectral': {
    param: 'Spectral:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'DM Serif Display': {
    param: 'DM+Serif+Display:ital@0;1',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Bitter': {
    param: 'Bitter:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Noto Serif': {
    param: 'Noto+Serif:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Vollkorn': {
    param: 'Vollkorn:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Alegreya': {
    param: 'Alegreya:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Cardo': {
    param: 'Cardo:ital,wght@0,400;0,700;1,400',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Gentium Plus': {
    param: 'Gentium+Plus:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'PT Serif': {
    param: 'PT+Serif:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Zilla Slab': {
    param: 'Zilla+Slab:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Josefin Slab': {
    param: 'Josefin+Slab:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Rokkitt': {
    param: 'Rokkitt:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
};

const BODY_FONTS: Record<string, FontEntry> = {
  'Source Sans 3': {
    param: 'Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Inter': {
    param: 'Inter:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Open Sans': {
    param: 'Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Roboto': {
    param: 'Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Lato': {
    param: 'Lato:ital,wght@0,300;0,400;0,700;1,400',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Nunito': {
    param: 'Nunito:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Work Sans': {
    param: 'Work+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'DM Sans': {
    param: 'DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Poppins': {
    param: 'Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Raleway': {
    param: 'Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Outfit': {
    param: 'Outfit:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Plus Jakarta Sans': {
    param: 'Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Noto Sans': {
    param: 'Noto+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Mukta': {
    param: 'Mukta:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Rubik': {
    param: 'Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Cabin': {
    param: 'Cabin:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Karla': {
    param: 'Karla:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Lexend': {
    param: 'Lexend:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Figtree': {
    param: 'Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Manrope': {
    param: 'Manrope:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
};

const MONO_FONTS: Record<string, FontEntry> = {
  'JetBrains Mono': {
    param: 'JetBrains+Mono:wght@400;500',
    fallback: "'Fira Code', 'Consolas', monospace",
  },
  'Fira Code': {
    param: 'Fira+Code:wght@400;500',
    fallback: "'Consolas', monospace",
  },
  'Source Code Pro': {
    param: 'Source+Code+Pro:wght@400;500',
    fallback: "'Consolas', monospace",
  },
  'IBM Plex Mono': {
    param: 'IBM+Plex+Mono:ital,wght@0,400;0,500;1,400',
    fallback: "'Consolas', monospace",
  },
  'Roboto Mono': {
    param: 'Roboto+Mono:ital,wght@0,400;0,500;1,400',
    fallback: "'Consolas', monospace",
  },
  'Space Mono': {
    param: 'Space+Mono:ital,wght@0,400;0,700;1,400',
    fallback: "'Consolas', monospace",
  },
  'Inconsolata': {
    param: 'Inconsolata:wght@400;500',
    fallback: "'Consolas', monospace",
  },
};

// ── Defaults ──

export const TYPOGRAPHY_DEFAULTS = {
  displayFont: 'Fraunces',
  bodyFont: 'Source Sans 3',
  monoFont: 'JetBrains Mono',
  baseFontSize: 106.25,
  baseLineHeight: 1.7,
  h1Size: 2,
  h2Size: 1.5,
  h3Size: 1.125,
} as const;

export const COLORS_DEFAULTS = {
  colorPrimary: '#6B3A1F',
  colorPrimaryLight: '#8B5E3C',
  colorAccent: '#C4703C',
  colorAccentText: '#A96032',
  colorAccentSoft: '#D4924F',
  colorTextPrimary: '#1A1612',
  colorTextSecondary: '#5C524A',
  colorTextTertiary: '#7D726A',
  colorTextMuted: '#A89E96',
  colorTextOnDark: '#FAF7F4',
  colorBgPage: '#FDFBF9',
  colorBgSection: '#F7F3EF',
  colorBgCard: '#FFFFFF',
  colorBgElevated: '#FFF9F4',
  colorBgDark: '#1A1612',
  colorBgDarkSoft: '#2C2520',
  colorBorderDefault: '#E8E2DC',
  colorBorderStrong: '#D4CCC4',
  colorBorderSubtle: '#F0EBE6',
  colorBorderFocus: '#6B3A1F',
  colorSuccess: '#5C7A52',
  colorWarning: '#B8863A',
  colorError: '#A04030',
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  themeColor: '#6B3A1F',
} as const;

// ── URL Builder ──

function getFontEntry(name: string): FontEntry | undefined {
  return DISPLAY_FONTS[name] || BODY_FONTS[name] || MONO_FONTS[name];
}

export function buildGoogleFontsUrl(displayFont: string, bodyFont: string, monoFont: string): string {
  const families = new Set<string>();

  for (const fontName of [displayFont, bodyFont, monoFont]) {
    const entry = getFontEntry(fontName);
    if (entry) {
      families.add(entry.param);
    }
  }

  return `https://fonts.googleapis.com/css2?${[...families].map(f => `family=${f}`).join('&')}&display=swap`;
}

export function buildFontFamilyValue(fontName: string): string {
  const entry = getFontEntry(fontName);
  if (!entry) {
    return `'${fontName}', sans-serif`;
  }
  return `'${fontName}', ${entry.fallback}`;
}
