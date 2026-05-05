# External corpora

Content here is ingested from external sites by `scripts/ingest/*`. It is **not rendered to public HTML pages** — only to agent-readable markdown endpoints (`/external/<source>/<slug>.md`, `/llms-full.txt`).

## Sources

### `spontaneous-order/`
The Spontaneous Order Substack, run by the Centre for Civil Society. Posts are ingested via RSS by `scripts/ingest/spontaneous-order.ts` and the `.github/workflows/rss-ingest.yml` cron.

Each file is one Substack post:
```
spontaneous-order/<post-slug>.mdx
```

### `ccs-books/`
Books from the Centre for Civil Society. Stable corpus — added via one-shot import by `scripts/ingest/book.ts`. Each chapter is one MDX file:
```
ccs-books/<book-slug>/<chapter-slug>.mdx
```

## Why "external"
The original sources have their own canonical URLs (Substack, book sales pages). Mirroring them publicly would create SEO duplication. Keeping them as agent-only `.md` endpoints lets the wiki and agent tools query them while respecting the source's primary canonical.

## SEO policy
- Search engines (Googlebot, Bingbot, etc.) are blocked from `/external/` via `/robots.txt`.
- AI crawlers (ClaudeBot, GPTBot, Perplexity, etc.) are allowed.
- `/external/` paths are excluded from `sitemap.xml`.

## Permission
Confirm written permission from each source owner before ingesting. CCS owns Spontaneous Order and the books, so internal use is covered, but document the licence in each book's `book_slug` directory if it differs from the default.
