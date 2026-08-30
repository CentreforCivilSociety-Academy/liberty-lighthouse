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

// ── The pinned hues ──
//
// Not picked by eye and not evenly spaced. All 360 hues were generated in
// three renditions and a search maximised the minimum pairwise OKLab distance
// across all three at once; the winning set has min deltaE 7.21. The spacing is
// deliberately uneven — 53 degrees crossing teal to blue where the eye barely
// registers a change, 30 in violet to magenta where it registers a lot.
//
// Keyed by topic `slug`, which is also the FAQ folder name.
//
// This map is the registry of hues that are already published and must never
// move: a reader learns a theme by its colour, so an assignment that has
// shipped is frozen here. A theme that is NOT in this map still gets a hue —
// assignHues below solves for one — but pinning it makes it permanent. Pin a
// new theme once you are happy with the colour it was given.

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
  // Deep blue, the widest remaining gap. Chosen by assignHues when CCS
  // published a twelfth theme, then pinned so it stops moving. It costs the
  // set 5.77 → 5.54 min separation, measured on the two rendered renditions.
  property: 248,
};

/**
 * The separation below which two themes stop being reliably tellable apart.
 *
 * The design note this was built from claimed the set collapsed from deltaE
 * 7.21 to 3.91 at eleven. That is true only of a naive insertion — dropping a
 * hue into the widest gap measures 3.49 here. Re-solving properly holds 6.54,
 * and adding an eleventh while keeping the existing ten fixed (which preserves
 * every semantic assignment) holds 5.56 against 6.70 for the ten.
 *
 * So the ceiling was softer than documented, and it is a slope rather than a
 * cliff. There is no count at which the palette abruptly stops working; each
 * additional hue just costs separation. Measured on the current pinned set,
 * letting assignHues solve for the rest:
 *
 *     12 themes  5.54      16 themes  4.21
 *     13 themes  4.60      17 themes  4.07
 *     14 themes  4.48      18 themes  3.99   <- first breach
 *     15 themes  4.37      20 themes  3.18
 *
 * So this floor first speaks at eighteen, six beyond where the corpus stands.
 * It warns rather than throws: a published theme going uncoloured, or a whole
 * site left unbuilt, is a worse outcome for a reader than two themes sitting
 * closer together than the design would like.
 */
export const SEPARATION_FLOOR = 4.0;

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

// ── Hues for themes that have not been pinned ──
//
// The CMS can publish a theme; it cannot edit this file. So a hue has to be
// available for a slug nobody has assigned one to, or an editor doing their
// job takes the site's build down. These solve for one.
//
// The search is the same one that produced the pinned set: walk all 360 hues
// and take the one whose closest rendered neighbour is furthest away. It runs
// against every pinned hue, not just the themes currently being rendered, so
// the answer does not depend on which subset of the corpus a caller asks for.
//
// Assignment is deterministic — same slugs in, same hues out, every build.
// It is stable under append, and only under append: pending slugs are taken in
// alphabetical order, so a new theme sorting *before* an existing unpinned one
// shifts that one's colour. Pinning is what makes a colour permanent, which is
// why an assignment that has shipped belongs in THEME_HUES.

type Lab = [number, number, number];

const HUE_STEPS = 360;

function oklabOf(hex: string): Lab {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 0.2428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * Both renditions of every hue, in OKLab.
 *
 * Built once and only when something actually needs assigning — 720 contrast
 * solves is real work, and a corpus whose themes are all pinned never does it.
 */
let renditions: Lab[][] | null = null;
function renditionTable(): Lab[][] {
  if (renditions) return renditions;
  const table: Lab[][] = [];
  for (let h = 0; h < HUE_STEPS; h += 1) {
    table.push([
      oklabOf(solveForContrast(h, INK_CHROMA, INK_TARGET, SECTION).hex),
      oklabOf(solveForContrast(h, FILL_CHROMA, FILL_TARGET, SECTION).hex),
    ]);
  }
  renditions = table;
  return table;
}

const labDistance = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Perceptual distance between two hues, in OKLab units x100.
 *
 * Measured on the rendered hex of both renditions and reported as the closer
 * of the two, because two themes are only as distinguishable as their most
 * similar appearance. Comparing hue angles instead would call 226 and 258 far
 * apart while their clipped inks sit almost on top of each other.
 */
export function hueDistance(a: number, b: number): number {
  const table = renditionTable();
  const x = table[((a % HUE_STEPS) + HUE_STEPS) % HUE_STEPS];
  const y = table[((b % HUE_STEPS) + HUE_STEPS) % HUE_STEPS];
  return Math.min(labDistance(x[0], y[0]), labDistance(x[1], y[1])) * 100;
}

/** The closest any two hues in a set come to each other. */
export function minSeparation(hues: number[]): number {
  let min = Infinity;
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      const d = hueDistance(hues[i], hues[j]);
      if (d < min) min = d;
    }
  }
  return min;
}

/**
 * Hues for every slug given, pinned ones unchanged and the rest solved for.
 *
 * Ties go to the lower hue angle, so the result is reproducible rather than
 * dependent on iteration order.
 */
export function assignHues(slugs: Iterable<string>): Record<string, number> {
  const out: Record<string, number> = { ...THEME_HUES };
  const pending = [...new Set(slugs)].filter((slug) => out[slug] === undefined).sort();
  if (pending.length === 0) return out;

  const taken = new Set(Object.values(out));
  for (const slug of pending) {
    let bestHue = 0;
    let bestSeparation = -1;
    for (let h = 0; h < HUE_STEPS; h += 1) {
      if (taken.has(h)) continue;
      let closest = Infinity;
      for (const t of taken) {
        const d = hueDistance(h, t);
        if (d < closest) closest = d;
      }
      if (closest > bestSeparation) {
        bestSeparation = closest;
        bestHue = h;
      }
    }
    out[slug] = bestHue;
    taken.add(bestHue);
  }
  return out;
}

const cache = new Map<string, Record<string, ThemeColours>>();

/**
 * Colours for the given theme slugs. Omit them and only the pinned themes
 * come back, which is what a caller that just wants the registry wants.
 */
export function themePalette(slugs?: Iterable<string>): Record<string, ThemeColours> {
  const hues = slugs === undefined ? { ...THEME_HUES } : assignHues(slugs);
  const key = Object.entries(hues)
    .map(([slug, hue]) => `${slug}:${hue}`)
    .sort()
    .join(',');
  const hit = cache.get(key);
  if (hit) return hit;

  const out: Record<string, ThemeColours> = {};
  for (const [slug, hue] of Object.entries(hues)) {
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
  cache.set(key, out);
  return out;
}

/** Emitted into the stylesheet as literal hex, one block per theme. */
export function themeCss(slugs?: Iterable<string>): string {
  const palette = themePalette(slugs);
  return Object.entries(palette)
    .map(
      ([slug, c]) =>
        `[data-theme="${slug}"]{--t-ink:${c.ink};--t-fill:${c.fill};--t-hue:${c.hue}}`,
    )
    .join('\n');
}
