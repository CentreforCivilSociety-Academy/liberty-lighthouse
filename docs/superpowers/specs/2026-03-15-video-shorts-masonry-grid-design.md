# Video & Shorts Masonry Grid — Design Spec

## Summary

Add support for YouTube Shorts alongside regular videos in a mixed masonry grid layout. Videos and shorts coexist in a single content collection with a `format` field. The masonry grid creates visual rhythm through different card heights (16:9 for horizontal videos, 9:16 for shorts and vertical videos). Detail pages adapt their player layout based on orientation.

"Extended notes" refers to the MDX body content (not a schema field) — rendered via `<Content />` on the detail page.

## Data Model

### Schema Changes (`content.config.ts`)

Add two fields to the existing `videos` collection:

```ts
format: z.enum(["video", "short"]).default("video"),
orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
```

- `format: "short"` implies vertical orientation (the `orientation` field is ignored — rendering always treats it as vertical regardless of what it's set to)
- `format: "video"` uses the `orientation` field to determine player layout
- All other fields (title, description, speaker, duration, body/extended notes, related content) remain identical across formats

### CMS Config (`public/admin/config.yml`)

Add two dropdowns to the videos collection:

- **Format** — select: "Video" (default) or "Short"
  - Hint: "Choose 'Short' for YouTube Shorts (vertical, brief clips). Choose 'Video' for regular YouTube videos."
- **Orientation** — select: "Horizontal" (default) or "Vertical"
  - Hint: "Only applies to Videos. Select 'Vertical' if the video is in portrait/vertical format. Shorts are always vertical."

> **Note:** The CMS config already omits `relatedFAQs`, `relatedSyllabus`, `relatedVideos`, and `updatedAt` from the UI (they're optional in the schema and can be edited in raw files). This is intentional for non-technical users. No change needed here.

### Updated VideoCard Props

```ts
interface Props {
  id: string;
  title: string;
  topic: string;
  youtubeId: string;
  duration?: string;
  speaker?: string;
  description: string;
  format: "video" | "short";
  orientation: "horizontal" | "vertical";
}
```

The component uses `format` and effective orientation (shorts always vertical) to pick the card variant.

## List Page: Mixed Masonry Grid

### Layout

CSS `columns`-based masonry layout replacing the current 2-column `grid`:

- **Desktop (≥1024px):** 3 columns, `column-gap: var(--spacing-lg)`
- **Tablet (768–1023px):** 2 columns
- **Mobile (<768px):** 1 column (stacked)

Items are sorted by `order` field. Videos and shorts intermix freely. The masonry effect emerges naturally from different card heights.

**Reading order trade-off:** CSS `columns` fills top-to-bottom per column, so DOM order 1–9 renders as columns [1,4,7], [2,5,8], [3,6,9] rather than rows. This is acceptable for a media gallery where users scan visually rather than sequentially. The `order` field controls relative position, and the visual stagger is part of the masonry aesthetic.

### Card Variants

**Horizontal Video Card (format: "video", orientation: "horizontal"):**
- 16:9 `aspect-video` thumbnail from YouTube (`hqdefault.jpg`)
- Play button overlay (accent color circle with triangle)
- Duration badge (bottom-right)
- Below thumbnail: title (Fraunces), speaker, description (2-line clamp)
- Standard card border, radius, hover shadow

**Vertical Video Card (format: "video", orientation: "vertical"):**
- 4:3 `aspect-[4/3]` thumbnail (matches YouTube's `hqdefault.jpg` native ratio, avoids heavy cropping)
- "Vertical" badge (top-left) to signal orientation before clicking
- Same text layout below (title, speaker, description)
- Taller card than horizontal creates masonry stagger

**Short Card (format: "short"):**
- 4:3 `aspect-[4/3]` thumbnail (same crop-safe ratio as vertical videos)
- Title overlaid at bottom with gradient (`bg-gradient-to-t from-black/70`)
- Duration badge (bottom-right, over gradient)
- Small "Shorts" badge (top-left) — inline SVG lightning bolt + "Shorts" text label
- No text section below — all info is overlaid
- On hover: slight scale-up (1.02) for a tactile feel

> **Thumbnail rationale:** YouTube's auto-generated `hqdefault.jpg` is always 480x360 (4:3). Using `aspect-[9/16]` would crop ~60% of the image. Instead, we use `aspect-[4/3]` for vertical/short cards — still taller than 16:9 cards for masonry rhythm, but without destructive cropping. The 9:16 experience happens on the detail page where the actual YouTube player renders at native ratio.

### CSS Implementation

```css
.masonry-grid {
  columns: 3;
  column-gap: var(--spacing-lg);
}

.masonry-grid > * {
  break-inside: avoid;
  margin-bottom: var(--spacing-lg);
}

@media (max-width: 1023px) {
  .masonry-grid { columns: 2; }
}

@media (max-width: 767px) {
  .masonry-grid { columns: 1; }
}

/* Shorts hover scale */
.short-card {
  transition: transform var(--duration-normal) var(--ease-out);
}

.short-card:hover {
  transform: scale(1.02);
}

@media (prefers-reduced-motion: reduce) {
  .short-card:hover {
    transform: none;
  }
}
```

## Detail Page

### Horizontal Video (existing behavior, unchanged)
- Full-width `lite-youtube` embed with 16:9 aspect ratio
- Title, metadata, description, extended notes below at prose width
- Related content section at bottom

### Vertical Video / Short
- **Desktop (≥768px):** Side-by-side layout
  - Left: Player at `max-width: 24rem` with 9:16 aspect ratio
  - Right: Title, speaker, duration, description, extended notes at prose width
  - Uses CSS grid: `grid-template-columns: minmax(18rem, 24rem) 1fr` with gap
  - `minmax` prevents cramping at tablet widths
- **Mobile (<768px):** Stacked layout
  - Player centered, `max-width: 20rem`, 9:16 aspect
  - Content below

### YouTube Embed URLs
- Regular videos: `https://youtube.com/watch?v={youtubeId}`
- Shorts: `https://youtube.com/shorts/{youtubeId}` (also works with standard watch URL)

`lite-youtube-embed` handles both formats identically via the `videoid` attribute.

### URL Pattern
All entries (videos and shorts) use the same URL: `/topics/{topic}/videos/{slug}/`. No separate routing for shorts.

## Placeholder Content

10 entries with real YouTube IDs from liberty/policy channels. All IDs are unique.

### Horizontal Videos (5)

| # | Title | YouTube ID | Topic | Speaker | Duration |
|---|-------|-----------|-------|---------|----------|
| 1 | Free to Choose: The Power of the Market | D3N2sNnGwa4 | education | Milton Friedman | 57:35 |
| 2 | Concentrated Benefits and Dispersed Costs | UCQkCyCvk9M | education | — | 3:16 |
| 3 | A Deep Dive into Education Policy | fa_ZXlqwmSM | education | Ajay Shah & Amit Varma | 1:42:00 |
| 4 | eBaithak: The Monetary Crises Ahead | dIOXzkthXvQ | agriculture | CCS Panel | 1:15:00 |
| 5 | What Does It Take to Open a Private School in Delhi? | zk9T5mG7i5A | education | CCS Research | 7:12 |

### Vertical Videos (2)

| # | Title | YouTube ID | Topic | Speaker | Duration |
|---|-------|-----------|-------|---------|----------|
| 6 | Kiran Bedi on Delhi's Air Pollution | PYIbcQTzUho | education | Kiran Bedi | 45:00 |
| 7 | Larry Sanger on Wikipedia and Information | bTPiFzleaj8 | education | Larry Sanger | 1:05:00 |

### Shorts (3)

| # | Title | YouTube ID | Topic | Duration |
|---|-------|-----------|-------|----------|
| 8 | Friedman's Law of Spending | 5RDMdc5r5z8 | education | 0:58 |
| 9 | Why Farmers Can't Trade Freely | dIOXzkthXvQ | agriculture | 0:45 |
| 10 | One Million Teacher Vacancies | PYIbcQTzUho | education | 1:02 |

> Note: Shorts #9 and #10 share YouTube IDs with entries #4 and #6 as placeholder stand-ins. This is acceptable because MDX filenames (which determine slugs and routes) are unique. In production, these would use actual YouTube Shorts IDs. The schema, card UI, and detail page work identically regardless.

## Files to Modify

1. **`src/content.config.ts`** — Add `format` and `orientation` fields to video schema
2. **`src/components/video/VideoCard.astro`** — Add variant rendering (update Props interface, 3 card modes)
3. **`src/pages/topics/[topic]/videos/index.astro`** — Replace 2-col grid with masonry layout, pass format/orientation to cards
4. **`src/pages/topics/[topic]/videos/[slug].astro`** — Add side-by-side layout for vertical content
5. **`public/admin/config.yml`** — Add format and orientation dropdowns to videos collection
6. **`src/content/videos/`** — Create 10 placeholder MDX files (unique filenames)
7. **`src/content/topics/`** — Ensure agriculture and education topic JSON files exist
8. **`src/lib/collections.ts`** — No changes needed (existing queries work; format filtering can be added later if needed)
9. **`src/pages/search.astro`** — Add `format` to search index so results can display a "Short" badge

## Design Tokens Used

- Fonts: `--font-display` (Fraunces) for titles, `--font-body` (Source Sans 3) for descriptions
- Colors: `--color-accent` (#C4703C) for play button, `--color-bg-card` for card background
- Spacing: `--spacing-lg` for grid gap and card padding
- Radius: `--radius-lg` for card corners
- Shadows: `--shadow-md` for hover state
- Transitions: `--duration-normal` with `--ease-out` for hover effects

## Accessibility

- All thumbnails have empty `alt=""` (decorative, the link text provides context)
- Play button has `aria-hidden="true"` (the card link itself is the interactive element)
- Shorts badge uses inline SVG lightning bolt + visible "Shorts" text label (not icon-only)
- `prefers-reduced-motion` disables hover scale animation on short cards
- Focus-visible outlines on all card links
- Reading order: CSS columns fills top-to-bottom per column, not row-by-row. This is acceptable for a visual media gallery and does not affect screen reader navigation (DOM order is preserved)

## ResourceTabs Label

The existing "Videos" tab label and count will include both videos and shorts. No label change needed — shorts are a subcategory of video content, and the tab already says "Videos" which encompasses both.
