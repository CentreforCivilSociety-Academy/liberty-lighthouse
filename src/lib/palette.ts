/**
 * Theme palette: ten hues, solved rather than picked.
 *
 * Hue angles are bare integers. All colour maths happens here, in Node, at
 * build time, and what reaches the browser is literal hex.
 *
 * That last point is not a style preference. `oklch(52% 0.15 var(--hue))`
 * cannot be validated at parse time, so an engine without OKLCH support
 * accepts the declaration and then fails at computed-value time, falling back
 * to `inherit` — not to a preceding hex. Every themed element would render in
 * inherited text colour on exactly the browsers a fallback was written for.
 *
 * Every value is solved to a contrast target and then re-measured on the
 * gamut-clipped hex, because clipping changes the colour. A palette verified
 * on its OKLCH intent rather than on the sRGB it actually renders is unverified.
 */

// ── sRGB / WCAG ──

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ── OKLCH → sRGB ──

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = ([r, g, b]: [number, number, number]): boolean =>
  r >= -1e-4 && r <= 1 + 1e-4 && g >= -1e-4 && g <= 1 + 1e-4 && b >= -1e-4 && b <= 1 + 1e-4;

function toHex(rgbLinear: [number, number, number]): string {
  return (
    '#' +
    rgbLinear
      .map((c) => {
        const v = Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255);
        return v.toString(16).padStart(2, '0').toUpperCase();
      })
      .join('')
  );
}

/**
 * Convert OKLCH to hex, reducing chroma until the colour fits in sRGB.
 * Returns the clipped chroma alongside, so callers can see when a hue could
 * not hold the chroma it was asked for.
 */
export function oklchToHex(L: number, C: number, hDeg: number): { hex: string; chroma: number } {
  const h = (hDeg * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  // If the requested chroma already fits, take it.
  if (inGamut(oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h)))) {
    return { hex: toHex(oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h))), chroma: C };
  }
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinearSrgb(L, mid * Math.cos(h), mid * Math.sin(h)))) lo = mid;
    else hi = mid;
  }
  return { hex: toHex(oklabToLinearSrgb(L, lo * Math.cos(h), lo * Math.sin(h))), chroma: lo };
}

/**
 * Find the OKLCH lightness at a given hue and chroma whose rendered hex hits
 * `target` contrast against `bg`. Measured on the clipped hex, not the intent.
 */
export function solveForContrast(
  hDeg: number,
  chroma: number,
  target: number,
  bg: string,
  darkerThanBg = true,
): { hex: string; ratio: number; chroma: number } {
  let lo = 0;
  let hi = 1;
  let best = oklchToHex(darkerThanBg ? 0 : 1, chroma, hDeg);
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const cand = oklchToHex(mid, chroma, hDeg);
    const ratio = contrastRatio(cand.hex, bg);
    if (ratio >= target) {
      best = cand;
      // Darker colours contrast more against a light ground: push lighter
      // while we still clear the target, to keep the colour as vivid as possible.
      if (darkerThanBg) lo = mid;
      else hi = mid;
    } else if (darkerThanBg) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return { ...best, ratio: contrastRatio(best.hex, bg) };
}

// ── The ten hues ──
//
// Not picked by eye and not evenly spaced. All 360 hues were generated in
// three renditions and a search maximised the minimum pairwise OKLab distance
// across all three at once; the winning set has min deltaE 7.21. The spacing is
// deliberately uneven — 53 degrees crossing teal to blue where the eye barely
// registers a change, 30 in violet to magenta where it registers a lot.
//
// Keyed by topic `slug`, which is also the FAQ folder name.

export const THEME_HUES: Record<string, number> = {
  livelihoods: 21,
  labor: 62,
  agriculture: 103,
  'economic-growth': 141,
  gst: 173,
  trade: 226,
  constitutionalism: 258,
  pubc: 288,
  feminism: 318,
  education: 349,
  // Brick and laterite: the built environment. Added when CCS published an
  // eleventh theme, which the capacity note below said could not be done.
  urban: 41,
};

/**
 * How many hues the palette can hold and still keep them apart.
 *
 * The design note this was built from claimed the set collapsed from deltaE
 * 7.21 to 3.91 at eleven. That is true only of a naive insertion — dropping a
 * hue into the widest gap measures 3.49 here. Re-solving properly holds 6.54,
 * and adding an eleventh while keeping the existing ten fixed (which preserves
 * every semantic assignment) holds 5.56 against 6.70 for the ten.
 *
 * So the ceiling was softer than documented. It is still real: each additional
 * hue costs separation, and the assertion exists so the cost is paid
 * deliberately rather than discovered by a reader who cannot tell two themes
 * apart. Raise this only after re-running the separation measurement.
 */
export const HUE_CAPACITY = 11;

// ── Grounds ──

export const PAPER = '#FDFBF9';
export const SECTION = '#F7F3EF';

// ── Targets ──
//
// Solved against SECTION, the harder of the two grounds, so both pass.
// `ink` carries text and clears AAA. `fill` is non-text but is also used as a
// ground for paper-coloured text, so it is held to AA with headroom rather
// than to the 3:1 non-text floor.

const INK_TARGET = 7.05;
const FILL_TARGET = 4.65;
const INK_CHROMA = 0.16;
const FILL_CHROMA = 0.19;

export type ThemeColours = {
  hue: number;
  ink: string;
  fill: string;
  inkRatioOnPaper: number;
  inkRatioOnSection: number;
  fillRatioOnPaper: number;
  fillRatioOnSection: number;
  inkChroma: number;
  fillChroma: number;
};

let cache: Record<string, ThemeColours> | null = null;

export function themePalette(): Record<string, ThemeColours> {
  if (cache) return cache;
  const out: Record<string, ThemeColours> = {};
  for (const [slug, hue] of Object.entries(THEME_HUES)) {
    const ink = solveForContrast(hue, INK_CHROMA, INK_TARGET, SECTION);
    const fill = solveForContrast(hue, FILL_CHROMA, FILL_TARGET, SECTION);
    out[slug] = {
      hue,
      ink: ink.hex,
      fill: fill.hex,
      inkChroma: ink.chroma,
      fillChroma: fill.chroma,
      inkRatioOnPaper: contrastRatio(ink.hex, PAPER),
      inkRatioOnSection: contrastRatio(ink.hex, SECTION),
      fillRatioOnPaper: contrastRatio(fill.hex, PAPER),
      fillRatioOnSection: contrastRatio(fill.hex, SECTION),
    };
  }
  cache = out;
  return out;
}

/** Emitted into the stylesheet as literal hex, one block per theme. */
export function themeCss(): string {
  const palette = themePalette();
  return Object.entries(palette)
    .map(
      ([slug, c]) =>
        `[data-theme="${slug}"]{--t-ink:${c.ink};--t-fill:${c.fill};--t-hue:${c.hue}}`,
    )
    .join('\n');
}
