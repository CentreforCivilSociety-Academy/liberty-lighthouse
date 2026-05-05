# Wiki layer

LLM-generated entity pages, topic summaries, and comparisons. Synthesised from the internal corpus (FAQs, videos, glossary, syllabi) and federated external sources (`src/content/external/`) by `scripts/ingest/wiki-regen.ts`.

## What lives here

- **Entity pages** (`type: entity`) — a single concept, person, or institution with cross-references.
- **Topic summaries** (`type: topic_summary`) — synthesis of a topic across all sources.
- **Comparisons** (`type: comparison`) — explicit "X vs Y" treatments.

## How it stays fresh

`scripts/ingest/wiki-regen.ts` runs (manually or via `.github/workflows/wiki-regen.yml`):

1. Hashes every source file (faqs, videos, glossary, external).
2. Skips entity pages whose `source_hashes` match the current hashes — no LLM call.
3. For changed sources, calls an LLM (via OpenRouter) to extract entities and update entity pages.
4. Commits the regenerated wiki layer back to `main`.

This is Karpathy's "compounding artifact" — the wiki accumulates over time rather than being rediscovered on every query.

## Hand-editing

Wiki pages **can** be hand-edited; the script preserves a `manual_override: true` frontmatter flag if set. Default workflow is to let the LLM regen, edit only when correction is needed.

## Public visibility

Unlike `src/content/external/`, wiki pages **do** render to public HTML at `/wiki/<slug>/`. Humans can read them.
