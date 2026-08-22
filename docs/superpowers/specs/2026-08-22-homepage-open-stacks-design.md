# Homepage redesign — "Open Stacks"

**Date:** 2026-08-22
**Author:** Adnan
**Status:** Approved for implementation
**Supersedes:** the current `Hero` / `TopicsGrid` / `AboutSnippet` homepage

---

## 1. What this is

The homepage becomes the contents page of a book that does not exist yet: one question set
at display scale, two beside it, a hard rule, and then the entire corpus — every published
question, ten sections, numbered, ruled, honestly counted, nothing truncated and no ellipsis
anywhere on the page.

The argument in one sentence: **a description of a corpus is always less clear than the
corpus, when the corpus fits — and it fits.**

Today, finding one question costs five decisions and three page loads (read hero → scan ten
abstract nouns → guess → load topic page → load tab → scan). Under this design it costs one
decision and zero page loads.

### 1.1 Why the current page reads as bland

Measured, not asserted:

| defect | measurement |
|---|---|
| Palette spans one hue band | 20° total; the accent sits 17° from the background |
| Figure and ground are the same colour | accent `#C4703C` H50 on page `#FDFBF9` H68 |
| Section boundary invisible | `bg-page` → `bg-section` = **1.069:1** |
| Effects tuned below threshold | shadows 0.04–0.08 alpha; hero grain 3%; hero glow `rgba(196,112,60,0.05)` → `0.02` |
| No scale drama | h1 is the only large type; h2 1.5rem, h3 1.125rem |
| Ten identical cards | title + 3-line clamp + badges, for every theme |
| No imagery of any kind | `public/images/` holds six education screenshots |

Raising saturation inside a 20° band produces a hotter beige. The fix is **chromatic
separation between figure and ground**, not more saturation.

### 1.2 Live accessibility failures this redesign must fix

Measured against current `colors.json`:

| token | on `bg-page` | on `bg-section` |
|---|---|---|
| `colorTextMuted` `#A89E96` | **2.54:1** ✗ | **2.38:1** ✗ |
| `colorTextTertiary` `#7D726A` | 4.53:1 ✓ | **4.24:1** ✗ |
| `colorAccentText` `#A96032` | 4.62:1 ✓ | **4.32:1** ✗ |

`colorAccentText` failing on section backgrounds means **every link on a section background
fails AA today.**

---

## 2. Locked decisions

These are settled. Do not relitigate during implementation.

1. **Question-led.** Real questions are the primary surface, not abstract theme tiles.
2. **Type-led editorial + generative per-theme marks.** No illustration, no photography, no
   commissioned assets, no font-family change.
3. **Warm paper, cool ink.** No dark mode in this launch.
4. **The complete corpus ships on mobile.** No cap, no "+13 more", no reversal trigger.
5. **The ledger tells the truth.** `ECONOMIC GROWTH · 5 QUESTIONS` prints as-is. Themes with
   no video show no video count. The 4-term glossary does not appear on the homepage.
   Absence is expressed as absence, never as an empty slot.
6. **No reveal animations.** Motion may express structure or acknowledge state. It may not
   withhold content or change what a thing is. The client's "spinning tiles" is rejected.
7. **Search is a plain `<form action="/search/" method="get">`.** No search index on the
   landing page.
8. **Zero JavaScript on the homepage, at every width.** See §6.4.
9. **Every number on the page is derived at build.** See §4.
10. **The mobile contents page and the desktop spine are the same DOM element.**

---

## 3. Content reality

Verified on `main` @ `2b0b74c`, then re-verified after `git pull` (the working tree was 90
commits stale during early analysis; all figures below are current).

| | count |
|---|---|
| Themes | 10 |
| Published FAQs | 134 (zero drafts) |
| Index rows after case-insensitive `(Part N)` collapse | 126 |
| Multi-part groups | 4, all `constitutionalism` (3/3/2/4) |
| Videos | 18, on **3 of 10** themes only |
| Populated syllabi | 8 of 10 |
| Glossary terms | 4 |

Per theme: agriculture 18, gst 19, livelihoods 19, constitutionalism 17, trade 15,
feminism 12, education 11, labor 9, pubc 9, economic-growth 5.

### 3.1 The corpus was mis-measured — read this before writing any tooling

`question:` in FAQ frontmatter is YAML, and **YAML folds long scalars across lines**. Every
prior analysis used a line-anchored regex (`^question:\s*(.*)$`) and silently truncated
**52 of 134 questions mid-clause**.

| | naive regex | real YAML parse |
|---|---|---|
| median | 66 ch | **77 ch** |
| p90 | 77 | **117** |
| p95 | 79 | **154** |
| max | 101 | **260** |

**Any tool that reads `question:` MUST use a YAML parser.** The corpus is far more varied
than a regex suggests, which means row height genuinely varies and *that variance is the
page's rhythm* — it is not a defect to be normalised away.

### 3.2 Fonts — what is actually served

`src/lib/fonts.ts` requests:

- `EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600` → **no 500**
- `Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400` → **no 600**
- `JetBrains+Mono:wght@400;500` → **no 600, no 700**

**Final weight palette for this page: EBG 400/600, JBM 400/500, Roboto 400.** Nothing else.
Specifying an unserved weight yields synthetic bold, which smears a monospace exactly where
`tabular-nums` alignment is load-bearing.

Also: `typography.json` currently sets **EB Garamond + Roboto**, not the Fraunces + Source
Sans 3 declared in `global.css`. `BaseLayout.astro` overrides at runtime.

### 3.3 There are no font binaries in this repository

`find` for `woff2|woff|ttf|otf` outside `node_modules` returns **zero**. Fonts load from
`fonts.googleapis.com` with `display=swap`.

Two structural consequences:

- A build-time type-fitting solver has nothing to measure.
- With `swap` and no metric overrides, first paint renders at fallback metrics and reflows.
  Every above-the-fold budget is void until a third-party round-trip completes.

**Self-hosting the three families as subset woff2, with `size-adjust` / `ascent-override` /
`descent-override` on the fallback stack, is a prerequisite of this design, not an
optimisation.**

### 3.4 `line-height: 1.7` is inherited from a CMS field

`BaseLayout.astro:42` emits `html { line-height: ${typo.baseLineHeight} }`. Every element
that does not set its own `line-height` inherits 1.7 — micro-labels budgeted at 12–14px ink
extents have real line boxes of 20–22px, a **+23.5px** first-screen error.

**Rule: every element on this page sets an explicit `line-height`. No exceptions.**

### 3.5 The cascade — verified empirically, and it constrains everything

`designSystemCSS` is injected as an **unlayered** `<style>` in `<head>`. All Astro and
Tailwind CSS is inside `@layer properties/theme/base/components/utilities`. **Unlayered
declarations beat every layer**, regardless of specificity or source order.

Measured in a real browser against the running dev server:

| probe | computed (17px root) | verdict |
|---|---|---|
| `<h2>` bare | 25.5px | CMS unlayered rule wins |
| `<h2 class="text-[1.75rem]">` (Tailwind, layered) | **25.5px** | **utility loses** |
| `<h2>` + unlayered class rule | **29.75px** | unlayered class wins |
| `<h1>` bare | 34px | CMS `h1:not(.hero-title)` applies |
| `<h1 class="hero-title">` | 17px (inherit) | **escape hatch works** |

**Implementation rules that follow:**

1. **Tailwind text-size utilities cannot set heading sizes on this site.** Never rely on
   `text-*` on `h1`–`h3`.
2. **Homepage type must be set in Astro component `<style>` blocks**, which are scoped and
   unlayered, giving `h2[data-astro-cid-…]` specificity (0,1,1) — beating the CMS `h2` at
   (0,0,1).
3. **Never put homepage type sizing in `@layer base`.** It will lose silently.
4. `h1` uses the `.hero-title` escape hatch and the component supplies its own size.

**Live bug this proves:** `TopicsGrid.astro:16` declares `md:text-[1.75rem]` on its h2. That
utility is in `@layer utilities` and has therefore **never applied at any viewport width**.
The heading has always rendered at 1.5rem.

---

## 4. The dynamic contract

> **No number rendered on this site is ever written by hand. Every count, bar width, total
> and ledger derives from `getCollection()` at build time, and a hard-written integer fails
> the build.**

When CCS publishes question 135 the h1 says 135, agriculture's census bar grows and the
totals line updates, with nobody editing anything. If they unpublish twenty it says 114.

The current site has exactly this bug: the byline promises "10 themes" as a literal string.

### 4.1 `src/lib/corpus.ts` — one export, both lanes

```ts
export interface CorpusTheme {
  slug: string;            // 'goods-and-services-tax'
  dir: string;             // 'gst' — the FAQ folder name, which differs from slug
  title: string;
  shortTitle: string;      // <= 24ch, for the census; defaults to title
  description: string;
  sectionOrder: number;    // 1..N, stable — people bookmark §04
  themeHue: number;        // 0..359
  questions: number;       // published FAQ files
  entries: number;         // index rows after (Part N) collapse
  videos: number;
  hasSyllabus: boolean;
  rows: CorpusRow[];
}

export interface CorpusRow {
  id: string;              // stable anchor: 'q-gst-04'
  question: string;        // YAML-parsed, never regex-extracted
  href: string;
  folio: number;           // 1..N within theme, unpadded
  parts?: { label: string; href: string }[];  // multi-part serials
}

export interface Corpus {
  themes: CorpusTheme[];   // ordered by sectionOrder
  totalQuestions: number;  // 134 today
  totalEntries: number;    // 126 today
  totalThemes: number;
  totalVideos: number;
  totalSyllabi: number;
  maxEntries: number;      // census bar scale denominator
}
```

Every rendered number comes from this object. Components never count anything themselves.

### 4.2 Build assertions — these fail the build, they do not warn

1. Every theme has a `themeHue` and it is unique.
2. Every theme has a `sectionOrder`; the set is exactly `1..N` with no gaps or duplicates.
3. `(Part N)` collapse is **case-insensitive** — the corpus contains `(Part 2)` alongside
   `(part 3)`. A case-sensitive collapse silently yields 130 rows instead of 126.
   `src/content/corpus.lock.json` pins `caseFoldedRows: 4`; a mismatch fails.
4. Every theme colour pair meets its target ratio, measured on the **gamut-clipped hex**,
   not on the OKLCH intent.
5. No hard-written corpus integer appears in any component, copy string, `aria-label` or
   structured-data field.
6. Theme count ≤ 10 (see §5.1.1).

### 4.3 Scale invariance

| element | formula | behaviour at 60 / 400 questions |
|---|---|---|
| census bar | `width: calc(var(--n) / var(--max) * var(--bar-run))` | always scales to the largest theme; shape preserved |
| leader size | solved at build against a fixed block height | independent of corpus size |
| colophon emblem | `rows = ceil(entries / floor((run − gaps) / pitch))` | 126 → one band, 190 → two, 400 → four |
| section rhythm | derived from real row count | no assumption of ~13 rows |

The colophon emblem's width and depth become a truthful reading of corpus size — screenshot
it in 2027 and 2029 and you get two different objects, and the difference is the work done.

---

## 5. Design system

### 5.1 Colour

Ten theme hues, derived by optimiser rather than by eye: all 360 hues were generated in
three renditions, then a restart-and-local-search maximised the **minimum pairwise OKLab ΔE
across all three simultaneously**. Result **min ΔE 7.21**. Spacing is deliberately uneven —
53° crossing teal→blue where the eye barely registers change, 30° in violet→magenta where it
registers a lot.

| theme | H | rationale |
|---|---|---|
| livelihoods | 21 | vermilion — the informal street economy, the most physically present theme |
| labour-and-manufacturing | 62 | burnt amber — industrial. **The incumbent CCS orange survives here** as one theme's ink rather than as the whole site |
| agriculture | 103 | wheat-olive. **Deliberately not green** — green-for-agriculture is the pastoral cliché this theme's own editorial line argues against |
| economic-growth | 141 | green — conventional and honest; taking green from agriculture and giving it to growth is the highest-value reassignment in the set |
| goods-and-services-tax | 173 | ledger green-teal — accounting-paper convention; GST is the most machine-like theme |
| trade | 226 | maritime cyan-blue — ports, containers, freight |
| constitutionalism | 258 | juridical blue, deliberately closest to the neutral ramp so it reads nearest the institution's own voice |
| public-choice | 288 | indigo-violet, placed adjacent to constitutionalism because the disciplinary adjacency is real |
| feminism | 318 | violet — the WSPU suffrage colour, explicitly not the gendered-pink default |
| education | 349 | rose-crimson. **Arbitrary** — it takes the remaining slot. Stated plainly rather than rationalised |

Six are semantically honest, one encodes a real adjacency, one is a deliberate anti-cliché,
one is a historical citation, one is arbitrary.

**Equal luminance by construction** is the mechanism that stops ten hues reading as a toy
shop: measured spread **1.013:1** across all ten inks. No hue can shout louder than another
because none is lighter than another.

#### 5.1.1 The ten-hue ceiling

The set holds exactly ten at min ΔE 7.21. At eleven it collapses to **3.91** — confusable.
Requirement §4 means CCS can add theme eleven whenever they like, so:

- The build **fails** with a message written for a non-engineer: *"An eleventh theme was
  added. The colour system holds ten distinguishable hues. Contact the site maintainer to
  extend the palette or group this theme under an existing one."*
- Anything less silently ships two themes a reader cannot tell apart.

#### 5.1.2 Warm-paper re-solve — required, not optional

The published hue table was solved against **cool** paper (`#FCFDFE`). Verified
independently: ink 6.96–7.05, fill 4.57–4.64, luminance spread 1.013:1 — the document's
claims hold exactly.

Against the **warm** paper this design uses, the same hexes drop to **ink 6.87–6.96** and
**fill 4.51–4.57**. Fill sits 0.01 above the 4.5 AA floor, which is no headroom.

**Action:** re-solve all ten inks and fills against the chosen warm paper, targeting ink
≥ 7.05 and fill ≥ 4.65. Do not copy the cool-paper hexes across.

#### 5.1.3 CSS shape

```css
[data-theme="agriculture"] {
  --t-ink: …;  --t-fill: …;  --t-wash: …;
  --t-edge: …; --t-on-dark: …; --t-dark-wash: …;
}
```

Components reference `--t-*` only, never a theme name — a new theme is one CSS block and
zero component edits. Hue angles live as **bare integers in `src/lib/theme-hues.ts`**, never
in `colors.json`; the build does the colour maths in Node and emits **literal hex**.

> `oklch(52% 0.15 var(--hue))` cannot be validated at parse time, so an older engine accepts
> the declaration and then falls back to `inherit` — not to a preceding hex. Every mark would
> render in inherited text colour on exactly the browsers a fallback was written for.
> Emitting literal hex removes the entire browser-support conversation.

### 5.2 The CMS narrows from 24 colour pickers to three

On 19 August 2026 someone at CCS set `colorPrimary` to `#1afc2a` (electric green), then set
`colorBgPage` to `#06064b` with white text, then reverted all of it — three commits in one
session, three days before the feedback document. That experiment is why "more vibrant
colours" is on the list.

It failed for a structural reason: changing one token in a palette tuned for a single warm
hue, while borders stayed `#E8E2DC` and cards stayed `#FFFFFF`, cannot produce anything but
a broken page. **The 24 pickers are the bug, not the feature.**

Replace with:

| control | type |
|---|---|
| `inkHue` | one integer |
| `contrastMode` | two-option select |
| per-topic `themeHue` | named select |

This must be **sold as an upgrade, not shipped quietly** — CCS actively uses these controls.
The pitch is true: the thing they tried on 19 August becomes one number that cannot break
anything.

Also narrow `baseFontSize` (currently 75–150% in 6.25 steps, 13 values) to **93.75–118.75%**.
Five of the current thirteen values push the measure outside the 45–80 character band.

### 5.3 Type

One rule governs the whole scale: **two emotional sizes — enormous and precise — with
nothing in between doing hierarchy work.**

There is exactly one piece of display type on the page and it is a question. Everything else
is deliberately, uniformly undramatic. Restraint everywhere except one place is what makes
the display setting land.

- **The leader question** is fitted **at build to a constant block height**, not clamped to
  the viewport. Whichever question an editor selects — 29 characters or 260 — the block is
  the same height and the first screen keeps its architecture.
- **The measure is defined as a multiple of the type size**, `--field-max: calc(--q × 2.5 ×
  --lc-alphabet)`, where the lowercase alphabet length is read from the shipped woff2 at
  build. Characters-per-line therefore becomes a constant of the design rather than a
  consequence of the viewport, and it survives the CMS root-size field.

### 5.4 Marks — "The Register"

One hairline per question in a left gutter, right-flush to a constant line, each **as long as
its question**, each on that question's first baseline.

The property that matters: **it is falsifiable by pointing.** Point at a long rule, read a
long question, 126 times. Most generative marks are unfalsifiable by construction — a hash
goes in, a pattern comes out, and nobody can be told what it means.

- `vector-effect: non-scaling-stroke` so weight is in CSS pixels, not viewBox units.
- **Below 56px, do not render the mark.** Below that the row pitch drops under 5 CSS px and
  the mark greys into a smudge — the failure that killed three of four proposed mark systems.
- Single data channel. A two-channel version had eight measurable rank inversions; the
  second channel was deleted rather than defended.
- Ships with a one-clause legend.

### 5.5 The ledger

Replaces the fixed three-badge FAQ/Video/Syllabus row.

```
AGRICULTURE          18 QUESTIONS · 6 VIDEOS · READING PATH
CONSTITUTIONALISM    17 QUESTIONS · 9 ENTRIES · READING PATH
TRADE                15 QUESTIONS
ECONOMIC GROWTH      5 QUESTIONS
```

Because the format is a list of what exists rather than a grid of slots, **absence is
invisible: nothing looks missing because nothing was promised.** Seven themes with no video
stop reading as seven broken themes. It self-updates from the collection.

The census counts **entries**, not questions — it is a table of contents for the index
beneath it and must count the rows it links to. Constitutionalism reads 9, and its section
ledger reconciles: `17 QUESTIONS · 9 ENTRIES`.

**No zero-padding anywhere.** Folios print unpadded (`4`, `§4`) and align with
`tabular-nums`. Padding to a digit count silently breaks shared anchors the day a theme
passes 99 entries.

---

## 6. The responsive system

Four lanes. One rule generates every boundary:

> **A track opens at the smallest width at which the surplus right margin alone pays for it.
> No track ever takes width from the reading column, and the reading column's width in ems is
> monotonically non-decreasing with viewport width.**

Verified by sweeping every integer content width 320→3440 under both scrollbar models: zero
field-monotonicity violations, zero em-measure violations.

| lane | content width |
|---|---|
| **Sheet** | < 565 |
| **Wide sheet** | 565–813 |
| **Page** | 814–1160, and any width ≥1161 whose height is under the gate |
| **Plate** | ≥1161 wide and ≥632 (fine pointer) / ≥712 (coarse) tall |

**The theorem this buys:** above 692px content width, not one of the 126 questions ever
changes its line count again, at any width up to 3440, at any CMS root setting.

### 6.1 Measurement discipline

- Android-first: measure at **360×740 with the URL bar showing (~618px usable)**, not
  375×812.
- Real desktop heights are **768 and 800**, not 900. A 1366×768 at 125% scaling with a
  taskbar reports **1092×494**.
- Media queries evaluate against `documentElement.clientWidth` **including** the scrollbar
  per Media Queries Level 4. A 1024px Windows window matches `min-width: 1024px`.

### 6.2 The 27-inch answer

At 2560×1440 the page is **333 | 1345 | 867** — 13.1% inner margin, 52.9% plate, 34.1%
fore-edge, reading column 33px left of centre.

Three pieces of arithmetic make that composed rather than left over:

1. **Outer margin is exactly 2.6× the inner**, by construction, at every width above 753 —
   inside the Van de Graaf and Tschichold canons for a book page. The same rule at 1024, at
   1366, at 2560; not a wide-screen special case.
2. **The fore-edge (866px) is narrower than the widest object on the page (the 953px row).**
   A margin wider than what it surrounds is a void; narrower is a margin. They go equal at
   content width 2664, so a 27-inch QHD sits 119px inside the boundary.
3. **The plate is terminal.** Above content 1900 nothing in the reading apparatus grows. The
   page has a text block and a page size, which is what a book has and a fluid layout does
   not.

At 2560 the design becomes *more* legible: index questions at 25.5px (20% larger than on a
phone, partially correcting for viewing distance), census bars at 300px, a 128px mark gutter.
And **chromatic area falls to 0.27%**, against 0.44% at 768 — the screen grows faster than
the colour does, while each individual gesture gets larger. That is the honest answer to
"more vibrant": emphatic gestures made of a vanishing quantity of ink.

Nothing goes in the fore-edge. A second question column doubles the left edges on a page
whose entire discipline is one left edge, breaks the folio's continuous numeral column, and
destroys the 1:1 register between a stem and its question.

### 6.3 The tablet answer

Portrait and landscape are different problems and land in different lanes.

- **Portrait is a height problem.** 768 stays a wide sheet; **820 and 834 become the page**,
  because 814 is the first width where the mark gutter costs the reading column nothing. All
  get the whole question above the fold with 200–300px to spare.
- **Landscape is a worse height problem** and is governed by the plate's height gate.
- At 768–1024 the viewport is wide but **touch is primary**, so no hover behaviour is
  load-bearing anywhere in these lanes.

### 6.4 Zero JavaScript — and what it costs

A static site cannot conditionally omit a script. `matchMedia`-gating a desktop module still
downloads, parses and evaluates it on every phone, so "zero JS below 1200" was true of
behaviour and false of bytes.

**The IntersectionObserver census cross-highlight is cut for everyone.** Replaced by
`:target` highlighting in pure CSS, emitted per theme, which covers the real navigation flow:
click a contents row, or open a shared `#s-gst` link, and the census shows where you went,
persistently.

What is genuinely lost is the census tracking you as you scroll. That job is done instead by
the section head you just passed — 42.5px EBG 600 with a 2px coloured rule bleeding to the
screen edge — and by the hue of every row stem beside you.

Removed with it: a `rootMargin` tie-break bug, an un-called `.observe`, a resize-into-the-
plate bug, and an entire class of "usually right".

### 6.5 Other judgment calls, made

| question | decision |
|---|---|
| Mobile navbar | Scrolls away below the plate; pins at the plate. One pinned element, 64px, at every width. Below the gate the single pinned element is the 44px running head. |
| Mobile vs desktop chroma | **No difference.** One register, `ink` only, everywhere. The justification for a more saturated phone rested on "three hues are never visible at once" — measured false at 768×940, 1366×644, 1905×943 and 2545×1303. |
| Section descriptions on phone | Cut. They survive on the desktop margin and on topic pages. ~880px saved. **Flag to CCS in advance** — somebody wrote those sentences. |
| h1 count | Dynamic always. `134 QUESTIONS · 126 ENTRIES` reconciles the two figures. |

---

## 7. Blockers — nothing compiles until these clear

1. **`src/content.config.ts`** — add `sectionOrder: z.number().int()`,
   `themeHue: z.number().int()`, `shortTitle: z.string().max(24).optional()`.
   **Nine of ten topics currently have `order: 1`** — the editorial sequence has no home in
   the content at all, and §01–§10 must be stable because people bookmark and share them.
2. **`src/content/topics/*.json`** — populate all three fields on all ten; strip the trailing
   space from `"Economic Growth "`; decide display names for `India's Constitution` and
   `Small entrepreneurs`.
3. **Palette re-key** to the real FAQ folder names (`gst`, `labor`, `pubc`) which differ from
   the topic slugs.
4. **Self-host the three font families.** §3.3.
5. **`src/content/corpus.lock.json`** — new, pinning `caseFoldedRows: 4`.
6. ~~Every consumer of `question:` must use a YAML parser.~~ **Resolved — no change needed.**
   Verified: no site code extracts frontmatter by regex. Astro content collections already
   parse YAML correctly, so `entry.data.question` has always been right. The truncation in
   §3.1 affected *analysis tooling only*. Any new analysis script must still use a parser.
7. **Verify the unlayered cascade escape** from `BaseLayout.astro:72–74` in a throwaway
   branch before anything else. Everything downstream depends on it.

---

## 8. Build sequence — 29.0 developer-days

| phase | days | content |
|---|---|---|
| **0 · Hygiene** | 2.0 | Cascade verification; gate `netlify-identity-widget.js` to `/admin/`; navbar opaque, blur removed; fix the three contrast failures in §1.2; `.fade-up` off the homepage; `--nav-height` token (the glossary A–Z bar hardcodes `top-[4rem]`) |
| **0c · Font pipeline** | 2.0 | Self-host + subset EBG/Roboto/JBM as woff2; metric-matched fallbacks; preload; remove Google preconnects. **Prerequisite for everything.** 113KB → ~48KB |
| **1 · Data contract** | 2.0 | `src/lib/corpus.ts`; all six build assertions; YAML parsing throughout |
| **2 · Tokens** | 1.5 | Warm-paper re-solve (§5.1.2); neutral ramp; `--t-*` indirection; type scale; motion tokens |
| **3 · Breakpoint solver** | 1.5 | `breakpoints.ts` — solve boundaries from (corpus, metrics, root, theme count) rather than hand-writing four numbers |
| **4 · Sweeps in CI** | 1.5 | Field-monotonicity and zero-rewrap, every integer width 320→3440, both scrollbar models |
| **5 · Leader solver** | 1.5 | Real word-boundary wrapping per (lane × height branch); fallback rule; build log |
| **6 · Mobile lane** | 4.0 | Masthead, fitted leader, contents page, section heads, 126 rows, folio rail, running head, colophon |
| **7 · Desktop plate** | 5.0 | Grid; `#contents` relocation to sticky census; section head in field; five-cell row; fore-edge folio; colophon Register |
| **8 · Leaf pages** | 2.0 | Prev/next-in-theme and back-to-index. **`relatedFAQs` is populated on 0 of 134 entries** and the only onward path from a leaf today is the comments box. A homepage promising 134 questions that delivers readers into a dead end is a beautifully typeset trap. Ships **with** the homepage, not after. |
| **9 · Content & CMS** | 1.0 | Leader relation widget + allowlist; `shortTitle`; `sectionOrder`; CMS narrowing (§5.2) |
| **10 · QA** | 3.5 | Matrix in §9 |
| | **29.0** | |

Roughly a third of the increase over the original 15.5-day estimate is the font pipeline (an
unstated dependency of every version of this design), a third is sweep-based verification
replacing endpoint spot-checks, and a third is content and schema work the site needs
regardless of which design ships.

---

## 9. Acceptance criteria

**Correctness**

- [ ] No hard-written corpus integer anywhere; build fails if one appears
- [ ] `(Part N)` collapse is case-insensitive; `corpus.lock.json` matches
- [ ] Every `question:` read through a YAML parser
- [ ] Every colour pair meets target on the gamut-clipped hex
- [ ] Adding an eleventh theme fails the build with a message a non-engineer can act on

**Performance** (mid-range Android, Slow 4G)

- [x] **No page-level JavaScript.** The homepage components ship none: every
      destination is a plain anchor and the census highlight is pure CSS.
      *Corrected from "zero JavaScript on `/`", which was never achievable —
      the shared layout carries cookie consent, outbound-link tagging and a
      third-party `gtag`, none of which is this project's to remove.* Glossary
      hover (3.7 KB) is now a dynamic chunk loaded only where glossary terms
      exist, taking the BaseLayout entry chunk to 0.5 KB.
- [x] Document ≤ 20KB over the wire — **16.2 KB brotli** (82.3 KB raw, 20.0 KB gzip)
- [x] Fonts same-origin and preloaded — 3 variable woff2, **0 third-party font requests** (was 5 across 2 origins)
- [ ] LCP ≤ 1.5s, CLS 0 — needs measurement on real hardware

**Layout** (verified by sweep, 24 widths from 320 to 3440)

- [x] Zero horizontal overflow at every width
- [x] Reading column non-decreasing as the viewport widens
- [x] Lane boundaries solved rather than chosen: **646 / 774 / 1224**

**Accessibility**

- [ ] WCAG AA on every pair, measured not asserted
- [ ] Full keyboard traversal: census links, all rows, section feet
- [ ] Works with JS off, and with fonts blocked
- [ ] `prefers-reduced-motion` honoured
- [ ] Find-in-page reaches every question (no `<details>` anywhere)

**Responsive matrix**

360×740 · 360×640 · 375×812 · 412×915 · 768 · 820 · 834 · 1024 · 1180 · 1194 (with and
without Magic Keyboard) · 1092×494 (1366×768 @125% + taskbar) · 1366×768 (with and without
bookmarks bar) · 1440×740 · 1920 · 2560 native · 4K @150% · 3440 ultrawide

Plus Safari 15 for percentage-in-`clamp()` inside `grid-template-columns`, and for a sticky
sibling inside a grid item.

**Physical device check, not a simulator:** a mid-range Android session outdoors in daylight
before merge.

---

## 10. Known risks

1. **EB Garamond 600 advance is assumed at +2.2% over the measured 400.** Every h1 and h2 fit
   rests on it. Measure the real 600 binary during self-hosting and re-run before treating
   any fitted number as final.
2. **`--field-max` reaching its cap depends on grid's maximize-tracks step** distributing
   free space to the only growable non-`fr` track. Correct per spec and in current engines,
   but adding a second `minmax(0, X)` to the page grid silently breaks it. Comment it in
   source next to the declaration.
3. **`position: sticky` on a grid item's child, with a percentage inside `clamp()` in
   `grid-template-columns`,** is lightly-trodden territory. Verify in Safari early.
4. **The design has no defence against padding a thin section** except the argument and a
   named owner. When CCS sees `ECONOMIC GROWTH · 5 QUESTIONS` the pressure will be to add a
   fake third link rather than five more questions.
5. **The 223-character Decap-mangled slugs** are real and worth fixing, but that is a content
   migration with a redirect matrix, and it is not this project.

---

## 11. What we are deliberately not doing

| not doing | why |
|---|---|
| Spinning tiles, flips, any reveal animation | Conceals a destination behind a state change, fails on touch, must be waited out |
| Illustration, photography, commissioned assets | No budget ask, no self-extension to theme eleven, competes with the type |
| Populating the unused `icon` field | A commissioning task disguised as a config edit |
| Changing any font family | Sitewide re-typesetting of 134 essays for a problem that is entirely about size |
| A search index on the landing page | 377KB inline on a mid-range Android is indefensible, and it is the easiest mistake to make while honouring "big search bar" |
| `<details>` disclosures on the index | Find-in-page does not reliably expand them |
| Filter chips, facets, client-side state | Every destination is a plain anchor: shareable, back-safe, keyboard-native |
| A 100vh hero | `vh` plus Android browser chrome is the most reliable way to ship a broken mobile layout |
| Algorithmic or rotating front-page selection | "Why is that question at the top?" must have a human answer, not a hash |
| An eleventh theme hue | min ΔE collapses 7.21 → 3.91 |
| CSS `columns` masonry | Breaks reading order for keyboard and screen-reader users |
| Box-shadows, radius or gradients on the homepage | `--shadow-*` is keyed to a colour being deleted; `radiusLg` is an unguarded numeric an editor can set to 999 |
