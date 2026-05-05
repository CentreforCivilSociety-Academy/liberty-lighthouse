# Ingestion scripts

Scripts that populate the federated external corpora and the LLM-synthesised wiki layer. All scripts are idempotent and hash-skip on rerun.

## Quickstart

```bash
# Install once
npm install

# Walk the full Spontaneous Order archive (~1000 posts) and write backlog.json.
# No auth needed — public publication. Resumable; safe to rerun.
npm run ingest:rss:fetch-backlog

# Import the backlog into src/content/external/spontaneous-order/
npm run ingest:rss -- --backlog-file ./backlog.json

# Pull only the latest 20 via RSS (alternative when backlog is already current)
npm run ingest:rss -- --rss-url https://spontaneousorder.in/feed

# Import a book
npm run ingest:book -- \
  --book-slug freedom-and-classical-liberalism \
  --book-title "Freedom and Classical Liberalism" \
  --author "Parth Shah" \
  --year 2018 \
  --source ./book.json

# Regenerate wiki layer (needs OPENROUTER_API_KEY; default model is x-ai/grok-4.1-fast)
OPENROUTER_API_KEY=sk-... npm run ingest:wiki

# Dry-run any of them
npm run ingest:rss:fetch-backlog -- --dry-run
npm run ingest:rss -- --rss-url ... --dry-run
```

## When inputs arrive

| Input | Command | Output |
|---|---|---|
| Spontaneous Order historical archive | `npm run ingest:rss:fetch-backlog` | `./backlog.json` |
| Latest ~20 posts from RSS | `npm run ingest:rss -- --rss-url <feed-url>` | `src/content/external/spontaneous-order/{slug}.md` |
| A backlog.json file | `npm run ingest:rss -- --backlog-file ./backlog.json` | `src/content/external/spontaneous-order/{slug}.md` |
| A book manifest | `npm run ingest:book -- --book-slug ... --source ./book.json` | `src/content/external/ccs-books/{slug}/{chapter}.md` |
| OpenRouter key + ingested SO posts | `OPENROUTER_API_KEY=... npm run ingest:summarize` | adds `summary`, `key_points`, `topics` to each post's frontmatter |
| OpenRouter key + populated source content | `OPENROUTER_API_KEY=... npm run ingest:wiki` | `src/content/wiki/{slug}.mdx` |

The daily GitHub Actions workflow at `.github/workflows/daily-update.yml` chains the first three rows automatically: fetch new posts → ingest → regenerate wiki. Schedule: `0 4 * * *` UTC.

## Scripts

### `lib.ts`
Shared helpers: HTML→markdown via Turndown, slugification, SHA-256 hashing for change detection, MDX file writing via gray-matter, frontmatter-hash loader for hash-skip, minimal arg parser.

### `spontaneous-order-fetch.ts`
Walks Substack's `/api/v1/archive` paginated endpoint and `/api/v1/posts/{slug}` per-post endpoint to produce a `backlog.json` matching the IncomingPost shape that `spontaneous-order.ts` consumes. Substack RSS only exposes ~20 posts; this is the path to the full historical archive.

No authentication — the publication is public. Rate-limited at 1 req/sec by default (configurable with `--rate`). Resumable: skips slugs already in `backlog.json` and slugs already mirrored as `<slug>.mdx` in `--skip-from-dir`. Verifies completeness against `/sitemap.xml` after the crawl and exits non-zero on mismatch.

Flags: `--out`, `--base`, `--rate`, `--limit`, `--skip-from-dir`, `--dry-run`. See the script header for details.

### `spontaneous-order.ts`
Pulls Substack posts from RSS or a JSON backlog (the file emitted by `spontaneous-order-fetch.ts`) and writes them to `src/content/external/spontaneous-order/{slug}.mdx`. Each post's `source_hash` (SHA-256 of the HTML body) is stored in frontmatter; on rerun, posts whose hash hasn't changed are skipped.

### `book.ts`
Reads a JSON manifest of `{ chapters: [{number, title, html}, ...] }` and writes one MDX per chapter to `src/content/external/ccs-books/{book-slug}/{chapter-slug}.mdx`. Manifest format will be finalised when the first book arrives.

### `summarize.ts`
Walks every Spontaneous Order post and adds a structured summary to its frontmatter via OpenRouter. Three new fields per post:
- `summary` — 150-200 word abstract of the post's argument, faithful to the author's framing.
- `key_points` — 3-5 single-sentence takeaways.
- `topics` — 2-4 short kebab-case topic tags (e.g. `school-choice`, `agricultural-subsidies`, `free-trade`).

Hash-skip: each post stores `summary_hash` matching its `source_hash`. On rerun, posts whose body hasn't changed are skipped without an LLM call. Pass `--refresh` to force re-summarisation.

Default model: `x-ai/grok-4.1-fast`. Estimated cost: ~$0.44 for the full ~1,000-post Spontaneous Order corpus, then pennies for new posts. Set a per-key spending cap on OpenRouter for safety.

The summary fields are surfaced in:
- `/external/spontaneous-order/{slug}.md` frontmatter and body (as a "## Summary" section above the original post).
- `/external/spontaneous-order/llms-full.txt` and `/llms-full.txt` (each post's section includes the summary inline).

### `wiki-regen.ts`
Walks every source file (FAQs, videos, glossary, federated externals), computes hashes, compares against the `source_hashes` recorded in existing wiki entries, and re-synthesises any wiki page whose source dependencies have changed.

Default model: `x-ai/grok-4.1-fast` via OpenRouter. Override with `--model <slug>` or the `OPENROUTER_MODEL` env var. Estimated cost: ~$1 for the full backfill of a ~1,000-post Spontaneous Order corpus, then pennies/month at steady state. Set a per-key spending cap on OpenRouter for safety.

The actual LLM call is currently a stub returning `[]`. When you're ready to enable wiki regen:

1. Implement the `synthesise()` function in `wiki-regen.ts` to call OpenRouter.
2. Decide on the prompt — propose entities, topic summaries, or comparisons based on the source.
3. Set `OPENROUTER_API_KEY` in GitHub Actions secrets and locally (`.env.local`).

The hash-skip pipeline is wired up so token spend grows with churn, not corpus size.

## Cron

Three workflows live under `.github/workflows/`:

- `daily-update.yml` — autonomous chain: fetch backlog → ingest → wiki-regen. Runs daily at 04:00 UTC. This is the workflow that keeps the corpus fresh in production.
- `rss-ingest.yml` — manual fallback for the RSS-only path. `workflow_dispatch` only.
- `wiki-regen.yml` — manual full re-synthesis. `workflow_dispatch` only.

## Environment

Local: copy `.env.example` to `.env.local` (gitignored) and fill in the values you need. Currently only `OPENROUTER_API_KEY` matters; the fetcher needs no secrets.

CI: set `OPENROUTER_API_KEY` as a GitHub Actions repo secret. Without it, the daily workflow's wiki-regen step gracefully no-ops.

## Permission

Document the licence for each external source before ingesting. CCS owns Spontaneous Order and the in-house books, so internal use is covered, but third-party content needs explicit permission and may need a `licence:` field in frontmatter.
