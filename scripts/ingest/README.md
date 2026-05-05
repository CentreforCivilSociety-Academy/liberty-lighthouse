# Ingestion scripts

Scripts that populate the federated external corpora and the LLM-synthesised wiki layer. All scripts are idempotent and hash-skip on rerun.

## Quickstart

```bash
# Install once
npm install

# Pull latest Spontaneous Order RSS
npm run ingest:rss -- --rss-url https://spontaneousorder.in/feed

# One-shot backlog import
npm run ingest:rss -- --backlog-file ./backlog.json

# Import a book
npm run ingest:book -- \
  --book-slug freedom-and-classical-liberalism \
  --book-title "Freedom and Classical Liberalism" \
  --author "Parth Shah" \
  --year 2018 \
  --source ./book.json

# Regenerate wiki layer (needs OPENROUTER_API_KEY)
OPENROUTER_API_KEY=sk-... npm run ingest:wiki

# Dry-run any of them
npm run ingest:rss -- --rss-url ... --dry-run
```

## Scripts

### `lib.ts`
Shared helpers: HTML→markdown via Turndown, slugification, SHA-256 hashing for change detection, MDX file writing via gray-matter, frontmatter-hash loader for hash-skip.

### `spontaneous-order.ts`
Pulls Substack posts from RSS or a JSON backlog and writes them to `src/content/external/spontaneous-order/{slug}.mdx`. Each post's `source_hash` (SHA-256 of the HTML body) is stored in frontmatter; on rerun, posts whose hash hasn't changed are skipped.

### `book.ts`
Reads a JSON manifest of `{ chapters: [{number, title, html}, ...] }` and writes one MDX per chapter to `src/content/external/ccs-books/{book-slug}/{chapter-slug}.mdx`. Manifest format will be finalised when the first book arrives.

### `wiki-regen.ts`
Walks every source file (FAQs, videos, glossary, federated externals), computes hashes, compares against the `source_hashes` recorded in existing wiki entries, and re-synthesises any wiki page whose source dependencies have changed.

The actual LLM call is currently a stub returning `[]`. When you're ready to enable wiki regen:

1. Implement the `synthesise()` function in `wiki-regen.ts` to call OpenRouter.
2. Decide on the prompt — propose entities, topic summaries, or comparisons based on the source.
3. Set `OPENROUTER_API_KEY` in GitHub Actions secrets and locally.
4. Flip `.github/workflows/wiki-regen.yml` from `workflow_dispatch` only to a `schedule` cron.

The hash-skip pipeline is wired up so token spend grows with churn, not corpus size.

## Cron

Both `rss-ingest` and `wiki-regen` have GitHub Actions workflows under `.github/workflows/`. Both ship as `workflow_dispatch` only (manual trigger) until inputs are in place. To switch to autonomous: edit the workflow YAML, uncomment the `schedule:` block, and merge.

## Permission

Document the licence for each external source before ingesting. CCS owns Spontaneous Order and the in-house books, so internal use is covered, but third-party content needs explicit permission and may need a `licence:` field in frontmatter.
