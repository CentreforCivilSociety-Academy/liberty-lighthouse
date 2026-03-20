/**
 * Font registry and Google Fonts URL builder.
 * Maps curated font names to their Google Fonts API parameters and CSS fallback stacks.
 */

// ── Font Registry ──
// Each entry: [Google Fonts family parameter, CSS fallback stack]

type FontEntry = { param: string; fallback: string };

const DISPLAY_FONTS: Record<string, FontEntry> = {
  // ── Existing ──
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
  // ── New Display/Serif Fonts ──
  'Crimson Pro': {
    param: 'Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Newsreader': {
    param: 'Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Literata': {
    param: 'Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400;1,7..72,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Gelasio': {
    param: 'Gelasio:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Domine': {
    param: 'Domine:wght@400;500;600;700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Tinos': {
    param: 'Tinos:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "'Times New Roman', Georgia, serif",
  },
  'Noto Serif Display': {
    param: 'Noto+Serif+Display:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Brygada 1918': {
    param: 'Brygada+1918:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Piazzolla': {
    param: 'Piazzolla:ital,opsz,wght@0,8..30,400;0,8..30,600;0,8..30,700;1,8..30,400;1,8..30,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Yrsa': {
    param: 'Yrsa:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Martel': {
    param: 'Martel:wght@400;600;700;800',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Lusitana': {
    param: 'Lusitana:wght@400;700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Noticia Text': {
    param: 'Noticia+Text:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Old Standard TT': {
    param: 'Old+Standard+TT:ital,wght@0,400;0,700;1,400',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Sorts Mill Goudy': {
    param: 'Sorts+Mill+Goudy:ital@0;1',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Cinzel': {
    param: 'Cinzel:wght@400;500;600;700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Abril Fatface': {
    param: 'Abril+Fatface',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Bodoni Moda': {
    param: 'Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;0,6..96,700;1,6..96,400;1,6..96,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Cormorant': {
    param: 'Cormorant:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Petrona': {
    param: 'Petrona:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Libre Caslon Text': {
    param: 'Libre+Caslon+Text:ital,wght@0,400;0,700;1,400',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'DM Serif Text': {
    param: 'DM+Serif+Text:ital@0;1',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Arvo': {
    param: 'Arvo:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Neuton': {
    param: 'Neuton:ital,wght@0,400;0,700;1,400',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Mate': {
    param: 'Mate:ital@0;1',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Arapey': {
    param: 'Arapey:ital@0;1',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Prata': {
    param: 'Prata',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Yeseva One': {
    param: 'Yeseva+One',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Cormorant Infant': {
    param: 'Cormorant+Infant:ital,wght@0,400;0,600;0,700;1,400;1,600',
    fallback: "Georgia, 'Times New Roman', serif",
  },
  'Quando': {
    param: 'Quando',
    fallback: "Georgia, 'Times New Roman', serif",
  },
};

const BODY_FONTS: Record<string, FontEntry> = {
  // ── Existing ──
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
  // ── New Body/Sans-Serif Fonts ──
  'Montserrat': {
    param: 'Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Barlow': {
    param: 'Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Josefin Sans': {
    param: 'Josefin+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Quicksand': {
    param: 'Quicksand:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Mulish': {
    param: 'Mulish:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Overpass': {
    param: 'Overpass:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Urbanist': {
    param: 'Urbanist:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Red Hat Display': {
    param: 'Red+Hat+Display:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Albert Sans': {
    param: 'Albert+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Sora': {
    param: 'Sora:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Commissioner': {
    param: 'Commissioner:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Atkinson Hyperlegible': {
    param: 'Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Public Sans': {
    param: 'Public+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Nunito Sans': {
    param: 'Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Exo 2': {
    param: 'Exo+2:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Libre Franklin': {
    param: 'Libre+Franklin:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'IBM Plex Sans': {
    param: 'IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'PT Sans': {
    param: 'PT+Sans:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Titillium Web': {
    param: 'Titillium+Web:ital,wght@0,300;0,400;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Hind': {
    param: 'Hind:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Signika': {
    param: 'Signika:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Heebo': {
    param: 'Heebo:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Asap': {
    param: 'Asap:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Red Hat Text': {
    param: 'Red+Hat+Text:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Bricolage Grotesque': {
    param: 'Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Instrument Sans': {
    param: 'Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Wix Madefor Display': {
    param: 'Wix+Madefor+Display:wght@400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
  'Geist': {
    param: 'Geist:wght@300;400;500;600;700',
    fallback: "'Segoe UI', system-ui, sans-serif",
  },
};

const MONO_FONTS: Record<string, FontEntry> = {
  // ── Existing ──
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
  // ── New Monospace Fonts ──
  'Ubuntu Mono': {
    param: 'Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "'Consolas', monospace",
  },
  'Overpass Mono': {
    param: 'Overpass+Mono:wght@400;500;600;700',
    fallback: "'Consolas', monospace",
  },
  'DM Mono': {
    param: 'DM+Mono:ital,wght@0,400;0,500;1,400;1,500',
    fallback: "'Consolas', monospace",
  },
  'Anonymous Pro': {
    param: 'Anonymous+Pro:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "'Consolas', monospace",
  },
  'Courier Prime': {
    param: 'Courier+Prime:ital,wght@0,400;0,700;1,400;1,700',
    fallback: "'Courier New', monospace",
  },
  'Noto Sans Mono': {
    param: 'Noto+Sans+Mono:wght@400;500;600;700',
    fallback: "'Consolas', monospace",
  },
  'Red Hat Mono': {
    param: 'Red+Hat+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500',
    fallback: "'Consolas', monospace",
  },
  'Martian Mono': {
    param: 'Martian+Mono:wght@400;500;600;700',
    fallback: "'Consolas', monospace",
  },
  'Geist Mono': {
    param: 'Geist+Mono:wght@400;500;600;700',
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
  heroTitleSize: 3.5,
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
