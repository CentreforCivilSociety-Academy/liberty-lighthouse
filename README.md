# Liberty Lighthouse

A classical liberal resource for understanding India's policy landscape through curated FAQs, video curricula, and guided syllabi. A project of the [Centre for Civil Society](https://ccs.in).

**Live site:** [libertylighthouse.ccs.in](https://libertylighthouse.ccs.in)

## Content Types

- **FAQs** — Curated question-answer pairs on Indian policy topics (education, agriculture)
- **Video Curricula** — YouTube video collections with descriptions and cross-references
- **Guided Syllabi** — Curated reading lists with books, academic papers, reports, articles, and multimedia

## Tech Stack

- [Astro](https://astro.build) — Static site generator
- [Decap CMS](https://decapcms.org) (v3) — Git-based content management at `/admin/`
- [Tailwind CSS](https://tailwindcss.com) (v4) — Utility-first styling
- [Netlify](https://netlify.com) — Hosting and deployment
- [Google Fonts](https://fonts.google.com) — Typography (CMS-configurable)

## CMS Admin

The admin portal at `/admin/` allows non-technical editors to manage:

- **Topics** — Add/edit policy topics with descriptions and guided syllabi
- **FAQs** — Create question-answer pairs with rich text, cross-linked to videos
- **Videos** — Add YouTube videos with metadata, descriptions, and cross-references
- **Typography** — Choose display, body, and mono fonts from 50+ Google Fonts; adjust font sizes
- **Colors** — Full design system color palette, border radii
- **AI & Search Crawlers** — Control which AI bots can access site content (GPTBot, ClaudeBot, etc.)

Authentication is handled via Netlify Identity.

## LLM-Friendly Features

- **`/llms.txt`** — Machine-readable site overview following the [llms.txt spec](https://llmstxt.org/)
- **`/llms-full.txt`** — Full content dump (all FAQs, video descriptions, syllabi) as plain Markdown
- **Copy as Markdown** — Button on content pages to copy rendered content as Markdown
- **Chat About This** — Open a conversation about any page in ChatGPT, Claude, or Gemini
- **JSON-LD Structured Data** — FAQPage, VideoObject, BreadcrumbList, Organization, WebSite schemas
- **CMS-Managed robots.txt** — Admin-controlled crawler permissions with friendly explanations
- **Sitemap** — Auto-generated via `@astrojs/sitemap`

## Development

```sh
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:4321
npm run build        # Build production site to ./dist/
npm run preview      # Preview production build locally
```

## Project Structure

```
src/
  components/        # Astro components (global, home, topics, ui)
  content/           # Content collections (topics, faqs, videos, settings)
  layouts/           # BaseLayout with CMS-driven design system
  lib/               # Utilities (fonts, design-settings, structured-data)
  pages/             # Routes (topics/[topic]/faq/, videos/, syllabus/)
  styles/            # Global CSS with design tokens
public/
  admin/             # Decap CMS config and font preview scripts
```

## Deployment

Deployed automatically via Netlify on push to `main`. The site is statically generated at build time — all CMS settings (typography, colors, crawler permissions) are baked into the build output.
