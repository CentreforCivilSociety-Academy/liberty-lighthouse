/**
 * Font registry and Google Fonts URL builder.
 * Maps curated font names to their Google Fonts API parameters.
 */

// ── Font Registry ──
// Each entry: Google Fonts family parameter

type FontEntry = { param: string };

const DISPLAY_FONTS: Record<string, FontEntry> = {
  // ── Existing ──
  'Fraunces': {
    param: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,600',
  },
  'Playfair Display': {
    param: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Merriweather': {
    param: 'Merriweather:ital,wght@0,400;0,700;1,400',
  },
  'Lora': {
    param: 'Lora:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Libre Baskerville': {
    param: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400',
  },
  'Cormorant Garamond': {
    param: 'Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'EB Garamond': {
    param: 'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Crimson Text': {
    param: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Spectral': {
    param: 'Spectral:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'DM Serif Display': {
    param: 'DM+Serif+Display:ital@0;1',
  },
  'Bitter': {
    param: 'Bitter:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Noto Serif': {
    param: 'Noto+Serif:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Vollkorn': {
    param: 'Vollkorn:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Alegreya': {
    param: 'Alegreya:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Cardo': {
    param: 'Cardo:ital,wght@0,400;0,700;1,400',
  },
  'Gentium Plus': {
    param: 'Gentium+Plus:ital,wght@0,400;0,700;1,400;1,700',
  },
  'PT Serif': {
    param: 'PT+Serif:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Zilla Slab': {
    param: 'Zilla+Slab:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Josefin Slab': {
    param: 'Josefin+Slab:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Rokkitt': {
    param: 'Rokkitt:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  // ── New Display/Serif Fonts ──
  'Crimson Pro': {
    param: 'Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Newsreader': {
    param: 'Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600',
  },
  'Literata': {
    param: 'Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400;1,7..72,600',
  },
  'Gelasio': {
    param: 'Gelasio:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Domine': {
    param: 'Domine:wght@400;500;600;700',
  },
  'Tinos': {
    param: 'Tinos:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Noto Serif Display': {
    param: 'Noto+Serif+Display:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Brygada 1918': {
    param: 'Brygada+1918:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Piazzolla': {
    param: 'Piazzolla:ital,opsz,wght@0,8..30,400;0,8..30,600;0,8..30,700;1,8..30,400;1,8..30,600',
  },
  'Yrsa': {
    param: 'Yrsa:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Martel': {
    param: 'Martel:wght@400;600;700;800',
  },
  'Lusitana': {
    param: 'Lusitana:wght@400;700',
  },
  'Noticia Text': {
    param: 'Noticia+Text:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Old Standard TT': {
    param: 'Old+Standard+TT:ital,wght@0,400;0,700;1,400',
  },
  'Sorts Mill Goudy': {
    param: 'Sorts+Mill+Goudy:ital@0;1',
  },
  'Cinzel': {
    param: 'Cinzel:wght@400;500;600;700',
  },
  'Abril Fatface': {
    param: 'Abril+Fatface',
  },
  'Bodoni Moda': {
    param: 'Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;0,6..96,700;1,6..96,400;1,6..96,600',
  },
  'Cormorant': {
    param: 'Cormorant:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Petrona': {
    param: 'Petrona:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Libre Caslon Text': {
    param: 'Libre+Caslon+Text:ital,wght@0,400;0,700;1,400',
  },
  'DM Serif Text': {
    param: 'DM+Serif+Text:ital@0;1',
  },
  'Arvo': {
    param: 'Arvo:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Neuton': {
    param: 'Neuton:ital,wght@0,400;0,700;1,400',
  },
  'Mate': {
    param: 'Mate:ital@0;1',
  },
  'Arapey': {
    param: 'Arapey:ital@0;1',
  },
  'Prata': {
    param: 'Prata',
  },
  'Yeseva One': {
    param: 'Yeseva+One',
  },
  'Cormorant Infant': {
    param: 'Cormorant+Infant:ital,wght@0,400;0,600;0,700;1,400;1,600',
  },
  'Quando': {
    param: 'Quando',
  },
  'Tenor Sans': {
    param: 'Tenor+Sans',
  },
  'Philosopher': {
    param: 'Philosopher:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Vidaloka': {
    param: 'Vidaloka',
  },
  'Oranienbaum': {
    param: 'Oranienbaum',
  },
  'Cambo': {
    param: 'Cambo',
  },
  'Italiana': {
    param: 'Italiana',
  },
  'Buenard': {
    param: 'Buenard:wght@400;700',
  },
  'Unna': {
    param: 'Unna:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Headland One': {
    param: 'Headland+One',
  },
  'Fanwood Text': {
    param: 'Fanwood+Text:ital@0;1',
  },
  'Rufina': {
    param: 'Rufina:wght@400;700',
  },
  'GFS Didot': {
    param: 'GFS+Didot',
  },
  'Vesper Libre': {
    param: 'Vesper+Libre:wght@400;500;700',
  },
  'Coustard': {
    param: 'Coustard:wght@400;900',
  },
  'Proza Libre': {
    param: 'Proza+Libre:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Alike': {
    param: 'Alike',
  },
};

const BODY_FONTS: Record<string, FontEntry> = {
  // ── Existing ──
  'Source Sans 3': {
    param: 'Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Inter': {
    param: 'Inter:wght@300;400;500;600;700',
  },
  'Open Sans': {
    param: 'Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Roboto': {
    param: 'Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400',
  },
  'Lato': {
    param: 'Lato:ital,wght@0,300;0,400;0,700;1,400',
  },
  'Nunito': {
    param: 'Nunito:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Work Sans': {
    param: 'Work+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'DM Sans': {
    param: 'DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Poppins': {
    param: 'Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Raleway': {
    param: 'Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Outfit': {
    param: 'Outfit:wght@300;400;500;600;700',
  },
  'Plus Jakarta Sans': {
    param: 'Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Noto Sans': {
    param: 'Noto+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Mukta': {
    param: 'Mukta:wght@300;400;500;600;700',
  },
  'Rubik': {
    param: 'Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Cabin': {
    param: 'Cabin:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Karla': {
    param: 'Karla:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Lexend': {
    param: 'Lexend:wght@300;400;500;600;700',
  },
  'Figtree': {
    param: 'Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Manrope': {
    param: 'Manrope:wght@300;400;500;600;700',
  },
  // ── New Body/Sans-Serif Fonts ──
  'Montserrat': {
    param: 'Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Barlow': {
    param: 'Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Josefin Sans': {
    param: 'Josefin+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Quicksand': {
    param: 'Quicksand:wght@300;400;500;600;700',
  },
  'Mulish': {
    param: 'Mulish:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Overpass': {
    param: 'Overpass:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Urbanist': {
    param: 'Urbanist:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Red Hat Display': {
    param: 'Red+Hat+Display:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Albert Sans': {
    param: 'Albert+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Sora': {
    param: 'Sora:wght@300;400;500;600;700',
  },
  'Commissioner': {
    param: 'Commissioner:wght@300;400;500;600;700',
  },
  'Atkinson Hyperlegible': {
    param: 'Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Public Sans': {
    param: 'Public+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Nunito Sans': {
    param: 'Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Exo 2': {
    param: 'Exo+2:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Libre Franklin': {
    param: 'Libre+Franklin:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'IBM Plex Sans': {
    param: 'IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'PT Sans': {
    param: 'PT+Sans:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Titillium Web': {
    param: 'Titillium+Web:ital,wght@0,300;0,400;0,600;0,700;1,400;1,600',
  },
  'Hind': {
    param: 'Hind:wght@300;400;500;600;700',
  },
  'Signika': {
    param: 'Signika:wght@300;400;500;600;700',
  },
  'Heebo': {
    param: 'Heebo:wght@300;400;500;600;700',
  },
  'Asap': {
    param: 'Asap:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Red Hat Text': {
    param: 'Red+Hat+Text:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Bricolage Grotesque': {
    param: 'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700',
  },
  'Instrument Sans': {
    param: 'Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
  },
  'Wix Madefor Display': {
    param: 'Wix+Madefor+Display:wght@400;500;600;700',
  },
  'Geist': {
    param: 'Geist:wght@300;400;500;600;700',
  },
};

const MONO_FONTS: Record<string, FontEntry> = {
  // ── Existing ──
  'JetBrains Mono': {
    param: 'JetBrains+Mono:wght@400;500',
  },
  'Fira Code': {
    param: 'Fira+Code:wght@400;500',
  },
  'Source Code Pro': {
    param: 'Source+Code+Pro:wght@400;500',
  },
  'IBM Plex Mono': {
    param: 'IBM+Plex+Mono:ital,wght@0,400;0,500;1,400',
  },
  'Roboto Mono': {
    param: 'Roboto+Mono:ital,wght@0,400;0,500;1,400',
  },
  'Space Mono': {
    param: 'Space+Mono:ital,wght@0,400;0,700;1,400',
  },
  'Inconsolata': {
    param: 'Inconsolata:wght@400;500',
  },
  // ── New Monospace Fonts ──
  'Ubuntu Mono': {
    param: 'Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Overpass Mono': {
    param: 'Overpass+Mono:wght@400;500;600;700',
  },
  'DM Mono': {
    param: 'DM+Mono:ital,wght@0,400;0,500;1,400;1,500',
  },
  'Anonymous Pro': {
    param: 'Anonymous+Pro:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Courier Prime': {
    param: 'Courier+Prime:ital,wght@0,400;0,700;1,400;1,700',
  },
  'Noto Sans Mono': {
    param: 'Noto+Sans+Mono:wght@400;500;600;700',
  },
  'Red Hat Mono': {
    param: 'Red+Hat+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500',
  },
  'Martian Mono': {
    param: 'Martian+Mono:wght@400;500;600;700',
  },
  'Geist Mono': {
    param: 'Geist+Mono:wght@400;500;600;700',
  },
};

// ── Defaults ──

export const TYPOGRAPHY_DEFAULTS = {
  displayFont: 'EB Garamond',
  bodyFont: 'Roboto',
  monoFont: 'JetBrains Mono',
  baseFontSize: 106.25,
  baseLineHeight: 1.7,
  heroTitleSize: 3.5,
  h1Size: 2,
  h2Size: 1.5,
  h3Size: 1.125,
} as const;

export const COLORS_DEFAULTS = {
  colorPrimary: '#6B3A1F',
  colorPrimaryLight: '#8B5E3C',
  colorAccent: '#C4703C',
  colorAccentText: '#A35C30',
  colorAccentSoft: '#D4924F',
  colorTextPrimary: '#1A1612',
  colorTextSecondary: '#5C524A',
  colorTextTertiary: '#695F59',
  colorTextMuted: '#786C63',
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

// ── Self-hosted families ──
// These three ship from /public/fonts as variable woff2 and never touch a
// third-party origin. Each has a metric-matched fallback face declared in
// src/styles/fonts.css, so swapping in the real font causes no layout shift.
// Any other family the CMS offers still resolves through Google Fonts.

export type SelfHostedFont = {
  /** @font-face family holding the variable binary */
  varFamily: string;
  /** metric-matched fallback @font-face, or null when the generic already matches */
  fallbackFamily: string | null;
  /** generic family, last resort */
  generic: string;
  /** public path, used for preloading */
  file: string;
};

export const SELF_HOSTED_FONTS: Record<string, SelfHostedFont> = {
  'EB Garamond': {
    varFamily: 'EB Garamond Var',
    fallbackFamily: 'EB Garamond Fallback',
    generic: 'serif',
    file: '/fonts/eb-garamond-var.woff2',
  },
  'Roboto': {
    varFamily: 'Roboto Var',
    fallbackFamily: 'Roboto Fallback',
    generic: 'sans-serif',
    file: '/fonts/roboto-var.woff2',
  },
  'JetBrains Mono': {
    varFamily: 'JetBrains Mono Var',
    // No metric-matched face: the monospace generic is already within 0.34%.
    fallbackFamily: null,
    generic: 'monospace',
    file: '/fonts/jetbrains-mono-var.woff2',
  },
};

/** Generic family for a catalogue font, derived from which register it sits in. */
function genericFor(fontName: string): string {
  if (MONO_FONTS[fontName]) return 'monospace';
  if (DISPLAY_FONTS[fontName]) return 'serif';
  return 'sans-serif';
}

export function buildGoogleFontsUrl(displayFont: string, bodyFont: string, monoFont: string): string {
  const families = new Set<string>();

  for (const fontName of [displayFont, bodyFont, monoFont]) {
    if (SELF_HOSTED_FONTS[fontName]) continue;
    const entry = getFontEntry(fontName);
    if (entry) {
      families.add(entry.param);
    }
  }

  // Every selected family is self-hosted — no stylesheet, no preconnects.
  if (families.size === 0) return '';

  return `https://fonts.googleapis.com/css2?${[...families].map(f => `family=${f}`).join('&')}&display=swap`;
}

/** woff2 files to preload, in the order they matter for first paint. */
export function selfHostedPreloads(displayFont: string, bodyFont: string, monoFont: string): string[] {
  const files: string[] = [];
  for (const fontName of [displayFont, bodyFont, monoFont]) {
    const sh = SELF_HOSTED_FONTS[fontName];
    if (sh && !files.includes(sh.file)) files.push(sh.file);
  }
  return files;
}

export function buildFontFamilyValue(fontName: string): string {
  const selfHosted = SELF_HOSTED_FONTS[fontName];
  if (selfHosted) {
    const stack = [`'${selfHosted.varFamily}'`];
    if (selfHosted.fallbackFamily) stack.push(`'${selfHosted.fallbackFamily}'`);
    // Georgia is named explicitly so the metric-matched face has something to
    // match; where it is absent the generic takes over unadjusted.
    if (selfHosted.generic === 'serif') stack.push('Georgia');
    stack.push(selfHosted.generic);
    return stack.join(', ');
  }
  // Catalogue fonts still get a real fallback, which they previously did not:
  // buildFontFamilyValue returned a bare quoted name, so a failed webfont left
  // the browser on its unstyled default.
  return `'${fontName}', ${genericFor(fontName)}`;
}
