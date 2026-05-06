# Agents API — Phase 1: BM25 Search Core — Implementation Plan

> **For agentic workers:** REQUIRED: Use @superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. Each task follows @superpowers:test-driven-development.

**Goal:** Build a pure-TypeScript BM25 search library that indexes the entire Liberty Lighthouse content corpus at deploy time and exposes a `search()` function returning ranked, citation-tagged hits. This is the search backbone for every later phase of the agents API.

**Architecture:** Three layers, no external search dependencies. (1) A **builder** that reads Astro content collections directly from disk (using gray-matter, the same approach `astro.config.mjs` already uses for the glossary rehype plugin), tokenizes content with Unicode-aware rules, computes IDF, and writes a JSON index to `src/lib/agent-search/_generated/index.json`. (2) A **loader** that imports that JSON lazily and caches it in module scope so warm Vercel functions reuse it. (3) A **search()** function that tokenizes a query, scores via BM25 (k1=1.5, b=0.75), generates snippets, and returns hits with structured `citation` blocks ready for the HTTP API. The generated index is gitignored; it's built by a `prebuild` npm script that runs before `astro build`.

**Tech Stack:** TypeScript ES modules (Node ≥20), Vitest 4 with happy-dom, gray-matter (already a dependency), Astro 6 content collections (read directly from disk, not via `astro:content`).

**Spec:** Implements §5.2 (`search` tool), §6 (citation contract), and §9 (search index shape) of [docs/agents-api.md](../../agents-api.md). All later phases consume this library; nothing in this plan touches HTTP, MCP, or the website itself.

---

## Scope

**In scope:**
- BM25 index over: topics, faqs, videos, glossary, wiki, spontaneousOrder, ccsBooks (the seven content collections an agent might reasonably search).
- Tokenizer with ASCII + Devanagari support, lowercase, punctuation strip.
- BM25 ranking with k1=1.5, b=0.75 defaults.
- Snippet generation (query-centered window, ~280 chars).
- Citation block construction with canonical_url, markdown_url, kind, title, last_modified.
- Build-time index generation script wired into `npm run build`.
- Runtime loader with module-scoped warm cache.
- Public `search()` API used by later phases.

**Out of scope (deferred to later phases):**
- HTTP endpoints (Phase 2).
- MCP transport (Phase 3).
- Telemetry, admin dashboard, privacy update, listings (Phases 6–10).
- Refactoring [mcp/server.ts](../../../mcp/server.ts) — keeps working as-is on substring search.
- Any non-search HTTP route.

**Success criteria for this phase:**
1. `npm test` passes including new tests in `tests/agent-search/`.
2. `npm run build:agent-index` produces `src/lib/agent-search/_generated/index.json` from the real corpus in <10s.
3. `npm run build` runs the index step automatically as `prebuild`, then `astro build` succeeds.
4. From a Vitest test using the real generated index, `search("MSP")` returns the glossary entry for MSP as the top hit, with a complete citation block, in <50ms (warm).
5. Every committed file ≤200 lines (focused responsibilities). Total new code ≤900 lines (spec + tests).

---

## File Structure

**Library (`src/lib/agent-search/`):**

| File | Responsibility | Size budget |
|---|---|---|
| `types.ts` | Public type definitions: `IndexedDoc`, `SearchHit`, `Citation`, `AgentIndex`, `SearchOptions`. No logic. | ≤80 lines |
| `tokenize.ts` | `tokenize(text: string): string[]`. Lowercase, strip punctuation, split by Unicode word boundaries. ASCII + Devanagari. | ≤40 lines |
| `bm25.ts` | `score(query: string[], doc: IndexedDoc, idf: Record<string, number>, avgDocLength: number, opts?: BM25Opts): number`. Pure function. | ≤60 lines |
| `snippet.ts` | `extractSnippet(text: string, queryTokens: string[], maxLen?: number): string`. Window centred on first matched token, fallback to head. | ≤70 lines |
| `read-collections.ts` | Reads all relevant content collections from disk via gray-matter. Returns `IndexedDoc[]`. Replaces `astro:content` (which isn't available in plain Node scripts). | ≤230 lines |
| `build-index.ts` | Composes reader + tokenizer + BM25 stats into an `AgentIndex`. Serializes to JSON. CLI entrypoint. | ≤120 lines |
| `load-index.ts` | Module-scoped lazy loader of `_generated/index.json`. Warm-cache safe. | ≤40 lines |
| `search.ts` | Public `search(query, options?): SearchHit[]`. Glues loader + tokenizer + BM25 + snippet + citation. | ≤120 lines |
| `index.ts` | Barrel export. | ≤15 lines |
| `_generated/index.json` | Build artifact. Gitignored. Not hand-edited. | n/a |

**Tests (`tests/agent-search/`):**

| File | Responsibility |
|---|---|
| `tokenize.test.ts` | Unicode, punctuation, Devanagari edge cases |
| `bm25.test.ts` | Ranking on a tiny synthetic corpus |
| `snippet.test.ts` | Window placement, length cap, no-match fallback |
| `read-collections.test.ts` | Reads against the fixture corpus |
| `build-index.test.ts` | End-to-end build on fixtures, JSON shape |
| `search.test.ts` | E2E with real generated index — "MSP" → glossary first; performance <50ms warm |
| `fixtures/content/` | Tiny mirror of `src/content/` shape with 6–8 docs across kinds |

**Build wiring:**

| File | Change |
|---|---|
| `package.json` | Add `build:agent-index` script and `prebuild` hook |
| `.gitignore` | Add `src/lib/agent-search/_generated/` |

---

## Conventions for this plan

- **TDD is non-negotiable.** Per @superpowers:test-driven-development, every implementation step is preceded by a failing test step. The implementer subagent must run the test, see it fail, then implement, then re-run.
- **Commit per task.** Frequent small commits. Match the repo's existing commit style (capitalized imperative subject, no `feat(scope):` prefix; e.g. "Add BM25 scorer", "Wire build:agent-index into prebuild"). Verify with `git log --oneline -10`.
- **Pure functions where possible.** `tokenize`, `bm25`, `snippet` are pure — no I/O, no side effects. Easy to test, easy to reason about.
- **No `astro:content` outside Astro pages.** The build script runs in plain Node via `tsx`; it must read the filesystem directly. Mirrors the pattern in [astro.config.mjs:23-43](../../../astro.config.mjs).
- **Path aliases:** the project uses `@lib/*` → `src/lib/*` (see [tsconfig.json:13](../../../tsconfig.json)). New code should use `@lib/agent-search/...` for cross-module imports where it improves readability; relative imports inside the package are fine.
- **No new runtime deps.** Use what's already in [package.json](../../../package.json): `gray-matter`, plus Node built-ins.
- **File headers:** every new `.ts` file gets a one-paragraph JSDoc comment at the top explaining its responsibility (matches the style of [mcp/server.ts:1-23](../../../mcp/server.ts) and [src/components/global/Analytics.astro:1-15](../../../src/components/global/Analytics.astro)).

---

## Chunk 1: Pure functions (Tasks 1–4)

This chunk delivers the pure, I/O-free heart of the search library: types, tokenizer, BM25 scorer, snippet generator. All testable in isolation with synthetic inputs. Output of this chunk: a working library you could call from a Node REPL with hand-crafted `IndexedDoc` objects and get correct rankings.

### Task 1: Scaffolding + types

**Files:**
- Create: `src/lib/agent-search/types.ts`
- Create: `src/lib/agent-search/index.ts` (barrel, will fill as we go)
- Create: `tests/agent-search/types.test.ts` (type-only assertions)

**Context:** This task lays down the type contracts every later task will conform to. Pull the JSON shapes from [docs/agents-api.md §5.2 and §6](../../agents-api.md). The `Citation` type matches §6 exactly. `IndexedDoc` is the per-document record stored in the index; `AgentIndex` is the top-level shape; `SearchHit` is what the public `search()` returns. No logic in this task.

- [ ] **Step 1: Create the directory and barrel.**

```bash
mkdir -p src/lib/agent-search
```

Write `src/lib/agent-search/index.ts`:

```typescript
/**
 * Liberty Lighthouse agent-search package.
 *
 * BM25 search over the markdown corpus. Index is built at deploy time
 * (npm run build:agent-index → src/lib/agent-search/_generated/index.json)
 * and loaded lazily at runtime. See docs/agents-api.md §9 for design.
 */
export * from './types.js';
```

- [ ] **Step 2: Write the failing test for the type shapes.**

Write `tests/agent-search/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type {
  Citation,
  IndexedDoc,
  AgentIndex,
  SearchHit,
  SearchOptions,
  ContentKind,
} from '../../src/lib/agent-search';

describe('agent-search types', () => {
  it('Citation has the §6 contract shape', () => {
    expectTypeOf<Citation>().toMatchTypeOf<{
      canonical_url: string;
      markdown_url: string;
      title: string;
      kind: ContentKind;
      last_modified: string;
    }>();
  });

  it('SearchHit carries a citation', () => {
    expectTypeOf<SearchHit>().toMatchTypeOf<{
      rank: number;
      score: number;
      kind: ContentKind;
      title: string;
      snippet: string;
      citation: Citation;
    }>();
  });

  it('AgentIndex has docs, idf, meta', () => {
    expectTypeOf<AgentIndex>().toMatchTypeOf<{
      docs: IndexedDoc[];
      idf: Record<string, number>;
      meta: { built_at: string; corpus_count: number; avg_doc_length: number };
    }>();
  });

  it('SearchOptions accepts k and kinds', () => {
    expectTypeOf<SearchOptions>().toMatchTypeOf<{
      k?: number;
      kinds?: ContentKind[];
    }>();
  });
});
```

Run:

```bash
npm test -- tests/agent-search/types.test.ts
```

Expected: FAIL — types module missing.

- [ ] **Step 3: Implement the types.**

Write `src/lib/agent-search/types.ts`:

```typescript
/**
 * Public type contract for the agent-search package.
 *
 * `Citation` matches the §6 citation contract exactly — every search hit
 * and fetch response in the public API carries this shape.
 */

export type ContentKind =
  | 'topic'
  | 'faq'
  | 'video'
  | 'glossary'
  | 'wiki'
  | 'external'
  | 'syllabus';

export interface Citation {
  canonical_url: string;
  markdown_url: string;
  title: string;
  kind: ContentKind;
  last_modified: string;
}

export interface IndexedDoc {
  /** Stable doc id, e.g. "glossary/msp" or "faq/agriculture/why-msp" */
  id: string;
  kind: ContentKind;
  title: string;
  /** Token frequency map. Key = token; value = count in doc. */
  tf: Record<string, number>;
  /** Total token count for BM25 length normalisation. */
  length: number;
  /** Original text (used for snippet generation). */
  text: string;
  citation: Citation;
}

export interface AgentIndex {
  docs: IndexedDoc[];
  idf: Record<string, number>;
  meta: {
    built_at: string;
    corpus_count: number;
    avg_doc_length: number;
  };
}

export interface SearchHit {
  rank: number;
  score: number;
  kind: ContentKind;
  title: string;
  snippet: string;
  citation: Citation;
}

export interface SearchOptions {
  /** Max hits to return. Default 10, max 25. */
  k?: number;
  /** Restrict to specific kinds. Default: all. */
  kinds?: ContentKind[];
}
```

- [ ] **Step 4: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/types.test.ts
```

Expected: PASS — all 4 type assertions.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agent-search/types.ts src/lib/agent-search/index.ts tests/agent-search/types.test.ts
git commit -m "Scaffold agent-search package and define type contracts"
```

---

### Task 2: Unicode-aware tokenizer

**Files:**
- Create: `src/lib/agent-search/tokenize.ts`
- Create: `tests/agent-search/tokenize.test.ts`
- Modify: `src/lib/agent-search/index.ts` (export tokenize)

**Context:** The tokenizer is the foundation for both index building and query parsing. It must be deterministic — the same string tokenized the same way at build time and at runtime — or BM25 lookups will miss. ASCII coverage is essential. Devanagari coverage matters because the glossary contains Hindi terms (e.g. "स्वराज" appears in some entries). No stemming for v1 — we'll add Porter for English-only later if recall suffers.

- [ ] **Step 1: Write failing tests covering ASCII, punctuation, and Devanagari.**

Write `tests/agent-search/tokenize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/lib/agent-search/tokenize';

describe('tokenize', () => {
  it('lowercases and splits ASCII words', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('strips punctuation', () => {
    expect(tokenize("MSP, what's that?")).toEqual(['msp', "what's", 'that']);
  });

  it('keeps internal apostrophes for English contractions', () => {
    expect(tokenize("don't can't")).toEqual(["don't", "can't"]);
  });

  it('handles hyphenated terms by splitting on hyphen', () => {
    expect(tokenize('voucher-system school-choice')).toEqual([
      'voucher',
      'system',
      'school',
      'choice',
    ]);
  });

  it('preserves Devanagari script', () => {
    // "स्वराज" = swaraj (self-rule).
    expect(tokenize('स्वराज और स्वतंत्रता')).toEqual(['स्वराज', 'और', 'स्वतंत्रता']);
  });

  it('handles mixed scripts in one string', () => {
    expect(tokenize('MSP की कीमत')).toEqual(['msp', 'की', 'कीमत']);
  });

  it('drops empty tokens from runs of whitespace', () => {
    expect(tokenize('  a   b\n\nc\t')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array on empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});
```

Run:

```bash
npm test -- tests/agent-search/tokenize.test.ts
```

Expected: FAIL — `tokenize` not defined.

- [ ] **Step 2: Implement the tokenizer.**

Write `src/lib/agent-search/tokenize.ts`:

```typescript
/**
 * Unicode-aware tokenizer for BM25 indexing and querying.
 *
 * Lowercases, splits on whitespace and most punctuation, keeps internal
 * apostrophes for English contractions, and preserves Devanagari runs as
 * tokens. The same tokenizer is used at build time and runtime — drift
 * here breaks index lookups silently.
 */

// Match runs of:
//   • Latin letters and digits, optionally with internal apostrophes
//   • Devanagari script characters (U+0900–U+097F)
// Splits on hyphens, periods (outside contractions), and all other punctuation.
const TOKEN_RE = /[a-zA-Z0-9]+(?:'[a-zA-Z]+)?|[ऀ-ॿ]+/g;

export function tokenize(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(TOKEN_RE);
  return matches ?? [];
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/tokenize.test.ts
```

Expected: PASS — all 8 cases.

- [ ] **Step 4: Update barrel.**

Edit `src/lib/agent-search/index.ts`:

```typescript
/**
 * Liberty Lighthouse agent-search package.
 *
 * BM25 search over the markdown corpus. Index is built at deploy time
 * (npm run build:agent-index → src/lib/agent-search/_generated/index.json)
 * and loaded lazily at runtime. See docs/agents-api.md §9 for design.
 */
export * from './types.js';
export { tokenize } from './tokenize.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agent-search/tokenize.ts src/lib/agent-search/index.ts tests/agent-search/tokenize.test.ts
git commit -m "Add Unicode-aware tokenizer with Devanagari support"
```

---

### Task 3: BM25 scorer

**Files:**
- Create: `src/lib/agent-search/bm25.ts`
- Create: `tests/agent-search/bm25.test.ts`
- Modify: `src/lib/agent-search/index.ts`

**Context:** BM25 is a function from (query tokens, document tf, document length, idf table, avg doc length) to a score. Pure, no I/O. The classic formula uses two free parameters — k1 (term saturation) and b (length normalisation). We use k1=1.5, b=0.75 (the Lucene defaults; a sensible baseline for general corpora). Test against a tiny synthetic corpus where the ranking is obvious by inspection.

- [ ] **Step 1: Write failing tests on a tiny synthetic corpus.**

Write `tests/agent-search/bm25.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreDoc, computeIdf } from '../../src/lib/agent-search/bm25';
import type { IndexedDoc } from '../../src/lib/agent-search/types';

function makeDoc(id: string, tf: Record<string, number>): IndexedDoc {
  const length = Object.values(tf).reduce((a, b) => a + b, 0);
  return {
    id,
    kind: 'faq',
    title: id,
    tf,
    length,
    text: '',
    citation: {
      canonical_url: `https://example.com/${id}`,
      markdown_url: `https://example.com/${id}.md`,
      title: id,
      kind: 'faq',
      last_modified: '2026-01-01',
    },
  };
}

describe('computeIdf', () => {
  it('rare terms get higher idf than common terms', () => {
    const docs = [
      makeDoc('d1', { msp: 1, the: 5 }),
      makeDoc('d2', { the: 4 }),
      makeDoc('d3', { the: 3 }),
    ];
    const idf = computeIdf(docs);
    expect(idf.msp).toBeGreaterThan(idf.the);
  });

  it('returns 0 idf for unseen terms via missing key', () => {
    const docs = [makeDoc('d1', { msp: 1 })];
    const idf = computeIdf(docs);
    expect(idf.unseen).toBeUndefined();
  });
});

describe('scoreDoc', () => {
  const docs = [
    makeDoc('msp-faq', { msp: 5, price: 3, support: 2 }),
    makeDoc('rte-faq', { rte: 4, education: 6 }),
    makeDoc('agri-faq', { msp: 1, agriculture: 4 }),
  ];
  const idf = computeIdf(docs);
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length;

  it('ranks doc with most query-term overlap highest', () => {
    const scores = docs.map((d) => ({
      id: d.id,
      score: scoreDoc(['msp'], d, idf, avgLen),
    }));
    scores.sort((a, b) => b.score - a.score);
    expect(scores[0].id).toBe('msp-faq');
  });

  it('returns 0 when no query tokens match the doc', () => {
    const score = scoreDoc(['nonsense'], docs[0], idf, avgLen);
    expect(score).toBe(0);
  });

  it('multi-token query sums term contributions', () => {
    const scoreSingle = scoreDoc(['msp'], docs[0], idf, avgLen);
    const scoreCombined = scoreDoc(['msp', 'price'], docs[0], idf, avgLen);
    expect(scoreCombined).toBeGreaterThan(scoreSingle);
  });

  it('multi-token query ranks docs by combined relevance', () => {
    // Query mentions both "msp" and "agriculture". msp-faq has high msp tf
    // but no agriculture; agri-faq has both. Combined query should rank
    // agri-faq above rte-faq (no overlap) and at least competitive with msp-faq.
    const tokens = ['msp', 'agriculture'];
    const ranked = docs
      .map((d) => ({ id: d.id, score: scoreDoc(tokens, d, idf, avgLen) }))
      .sort((a, b) => b.score - a.score);
    expect(ranked[0].id).not.toBe('rte-faq');
    expect(ranked.find((r) => r.id === 'rte-faq')!.score).toBe(0);
  });
});
```

Run:

```bash
npm test -- tests/agent-search/bm25.test.ts
```

Expected: FAIL — `bm25` module missing.

- [ ] **Step 2: Implement BM25.**

Write `src/lib/agent-search/bm25.ts`:

```typescript
/**
 * BM25 scorer.
 *
 * Pure functions. Inputs: query tokens, a single IndexedDoc, an IDF table,
 * and the corpus average doc length. Output: a non-negative score. Caller
 * ranks by score and slices the top-k.
 *
 * Parameters k1=1.5, b=0.75 (Lucene defaults). See:
 * https://en.wikipedia.org/wiki/Okapi_BM25
 */
import type { IndexedDoc } from './types.js';

export interface BM25Opts {
  k1: number;
  b: number;
}

export const DEFAULT_BM25: BM25Opts = { k1: 1.5, b: 0.75 };

/**
 * Compute the IDF table for a corpus.
 *
 * IDF(term) = ln(1 + (N - df + 0.5) / (df + 0.5))
 * where N is corpus size and df is the number of docs containing the term.
 */
export function computeIdf(docs: IndexedDoc[]): Record<string, number> {
  const df: Record<string, number> = {};
  for (const doc of docs) {
    for (const term of Object.keys(doc.tf)) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }
  const N = docs.length;
  const idf: Record<string, number> = {};
  for (const term of Object.keys(df)) {
    idf[term] = Math.log(1 + (N - df[term] + 0.5) / (df[term] + 0.5));
  }
  return idf;
}

/**
 * Score one doc against a tokenized query. Returns 0 when no overlap.
 */
export function scoreDoc(
  queryTokens: string[],
  doc: IndexedDoc,
  idf: Record<string, number>,
  avgDocLength: number,
  opts: BM25Opts = DEFAULT_BM25,
): number {
  let score = 0;
  const { k1, b } = opts;
  const lengthNorm = 1 - b + b * (doc.length / (avgDocLength || 1));
  for (const term of queryTokens) {
    const tf = doc.tf[term];
    if (!tf) continue;
    const termIdf = idf[term] ?? 0;
    const num = tf * (k1 + 1);
    const den = tf + k1 * lengthNorm;
    score += termIdf * (num / den);
  }
  return score;
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/bm25.test.ts
```

Expected: PASS — all 6 cases.

- [ ] **Step 4: Update barrel.**

Edit `src/lib/agent-search/index.ts`:

```typescript
export * from './types.js';
export { tokenize } from './tokenize.js';
export { scoreDoc, computeIdf, DEFAULT_BM25, type BM25Opts } from './bm25.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agent-search/bm25.ts src/lib/agent-search/index.ts tests/agent-search/bm25.test.ts
git commit -m "Add BM25 scorer with k1=1.5, b=0.75"
```

---

### Task 4: Snippet generator

**Files:**
- Create: `src/lib/agent-search/snippet.ts`
- Create: `tests/agent-search/snippet.test.ts`
- Modify: `src/lib/agent-search/index.ts`

**Context:** A snippet is the ~280-character window of body text shown alongside each search hit. The agent uses it to decide whether to fetch the full page. Centre the window on the first matched query token; if no token matches in the body (rare — they presumably matched the title), fall back to the first 280 chars. Collapse internal whitespace. The body passed in is already-stripped markdown (gray-matter strips frontmatter at parse time in Task 5), so this function does not handle frontmatter delimiters itself.

- [ ] **Step 1: Write failing tests.**

Write `tests/agent-search/snippet.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractSnippet } from '../../src/lib/agent-search/snippet';

describe('extractSnippet', () => {
  it('centres window on first matched token', () => {
    const text =
      'Lorem ipsum dolor sit amet. The minimum support price MSP is a floor. ' +
      'Followed by lots more text that should be cut off well before the end.';
    const snippet = extractSnippet(text, ['msp'], 80);
    expect(snippet).toContain('MSP');
    expect(snippet.length).toBeLessThanOrEqual(80);
  });

  it('falls back to head when no query token appears in text', () => {
    const text = 'A page about something else entirely.';
    const snippet = extractSnippet(text, ['msp'], 80);
    expect(snippet).toBe('A page about something else entirely.');
  });

  it('respects maxLen', () => {
    const text = 'a'.repeat(500);
    const snippet = extractSnippet(text, [], 100);
    expect(snippet.length).toBeLessThanOrEqual(100);
  });

  it('collapses internal whitespace', () => {
    const text = 'Some  text\n\nwith   weird\twhitespace.';
    const snippet = extractSnippet(text, [], 280);
    expect(snippet).toBe('Some text with weird whitespace.');
  });

  it('returns empty string on empty input', () => {
    expect(extractSnippet('', ['msp'])).toBe('');
  });

  it('case-insensitive match for the centre token', () => {
    const text = 'Discussion of Minimum Support Price details here.';
    const snippet = extractSnippet(text, ['minimum'], 60);
    expect(snippet.toLowerCase()).toContain('minimum');
  });
});
```

Run:

```bash
npm test -- tests/agent-search/snippet.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 2: Implement.**

Write `src/lib/agent-search/snippet.ts`:

```typescript
/**
 * Snippet extraction.
 *
 * Returns a query-centred window of the body text. If no query token is
 * found in the text, returns the first maxLen characters. Whitespace is
 * collapsed for readability. Pure, no I/O.
 */

const DEFAULT_MAX_LEN = 280;

export function extractSnippet(
  text: string,
  queryTokens: string[],
  maxLen: number = DEFAULT_MAX_LEN,
): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';

  // Find the earliest case-insensitive occurrence of any query token.
  const lower = collapsed.toLowerCase();
  let firstHit = -1;
  for (const tok of queryTokens) {
    if (!tok) continue;
    const i = lower.indexOf(tok.toLowerCase());
    if (i >= 0 && (firstHit < 0 || i < firstHit)) firstHit = i;
  }

  if (firstHit < 0) {
    return collapsed.slice(0, maxLen).trim();
  }

  // Window centred on the hit, clamped to bounds.
  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, firstHit - half);
  let end = Math.min(collapsed.length, start + maxLen);
  // If we clamped to the end, pull start back to fill the window.
  if (end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }
  return collapsed.slice(start, end).trim();
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/snippet.test.ts
```

Expected: PASS — all 6 cases.

- [ ] **Step 4: Update barrel.**

```typescript
// src/lib/agent-search/index.ts
export * from './types.js';
export { tokenize } from './tokenize.js';
export { scoreDoc, computeIdf, DEFAULT_BM25, type BM25Opts } from './bm25.js';
export { extractSnippet } from './snippet.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agent-search/snippet.ts src/lib/agent-search/index.ts tests/agent-search/snippet.test.ts
git commit -m "Add query-centred snippet generator for search hits"
```

---

## Chunk 2: Content collection reader (Task 5)

This chunk delivers the bridge from "markdown on disk" to `IndexedDoc[]`. It includes the fixture corpus that all subsequent chunks will use. Output: a working reader that walks `src/content/` and produces typed, citation-tagged docs.

### Task 5: Content collection reader

**Files:**
- Create: `src/lib/agent-search/read-collections.ts`
- Create: `tests/agent-search/read-collections.test.ts`
- Create: `tests/agent-search/fixtures/content/topics/agriculture.json`
- Create: `tests/agent-search/fixtures/content/topics/education.json`
- Create: `tests/agent-search/fixtures/content/glossary/msp.mdx`
- Create: `tests/agent-search/fixtures/content/glossary/voucher-system.mdx`
- Create: `tests/agent-search/fixtures/content/glossary/draft-term.mdx` (draft fixture)
- Create: `tests/agent-search/fixtures/content/faqs/agriculture/why-msp.mdx`
- Create: `tests/agent-search/fixtures/content/faqs/education/draft-faq.mdx` (draft fixture)
- Create: `tests/agent-search/fixtures/content/videos/agriculture/contract-farming.mdx`
- Create: `tests/agent-search/fixtures/content/wiki/msp.mdx`
- Create: `tests/agent-search/fixtures/content/wiki/draft-entity.mdx` (draft fixture)
- Create: `tests/agent-search/fixtures/content/external/spontaneous-order/sample-post.md`
- Create: `tests/agent-search/fixtures/content/external/ccs-books/jeevan/chapter-1-introduction.md`
- Modify: `src/lib/agent-search/index.ts`

**Context:** This task builds the bridge from "content on disk" to `IndexedDoc[]`. We can't use `astro:content` here because our build script runs in plain Node via `tsx` — `astro:content` is only available inside Astro pages and integrations. Instead, walk the filesystem with Node's `readdirSync`/`readFileSync` and parse frontmatter with `gray-matter`. Mirrors the pattern already in [astro.config.mjs:23-43](../../../astro.config.mjs).

The reader produces an `IndexedDoc` per source file, populating `tf` by tokenizing `title + body`, computing `length`, and constructing the `Citation` block. URL formats are documented in [src/lib/markdown-export.ts:11-60](../../../src/lib/markdown-export.ts) — we **inline the URL construction** rather than import the helpers (those expect `CollectionEntry<...>` typed objects we don't have). The canonical URL formats are stable and DRY isn't worth the cross-package coupling.

**External-content canonical URL handling (per [docs/agents-api.md §6](../../agents-api.md)):**

- **Spontaneous Order posts:** `canonical_url` = `data.original_url` (the upstream publisher URL on spontaneousorder.in). Matches the convention already used in `markdown-export.ts:291`. Citations point humans to the original publisher; `markdown_url` is the lighthouse `.md` for agent traversal.
- **CCS Books chapters:** no public HTML page exists. `canonical_url` = `markdown_url` (the lighthouse `.md` URL). Last-modified comes from `data.ingested_at` per the schema in [src/content.config.ts:114](../../../src/content.config.ts).

**Flat-directory assumption (verified against real content):** FAQs and videos live as `<topic>/<slug>.<ext>` — exactly one level of nesting under their collection root. The reader's URL construction relies on this. Real corpus follows this layout (verified via `find src/content/faqs -type f`). The reader should **assert** this and throw with a clear error if a deeper-nested file is encountered, rather than producing a 404'ing URL silently.

- [ ] **Step 1: Build the fixture corpus.**

Create the fixture files (paths under `tests/agent-search/fixtures/content/`):

`topics/agriculture.json`:

```json
{
  "title": "Agriculture",
  "slug": "agriculture",
  "description": "Indian farm policy: MSP, APMC, contract farming.",
  "order": 1,
  "guidedSyllabus": ""
}
```

`topics/education.json`:

```json
{
  "title": "Education",
  "slug": "education",
  "description": "Indian school policy: vouchers, RTE, choice.",
  "order": 2,
  "guidedSyllabus": ""
}
```

`glossary/msp.mdx`:

```mdx
---
term: "Minimum Support Price (MSP)"
definition: "The floor price at which the government commits to buy select crops."
aliases: ["MSP", "minimum support price"]
relatedTerms: []
relatedFAQs: []
relatedVideos: []
citations: []
updatedAt: "2026-04-12"
---

MSP is the assured price at which government agencies procure crops from farmers.
It is announced before each sowing season for selected commodities.
```

`glossary/voucher-system.mdx`:

```mdx
---
term: "Voucher System"
definition: "A school-funding mechanism where parents redeem vouchers at any approved school."
aliases: ["vouchers", "education voucher"]
relatedTerms: []
relatedFAQs: []
relatedVideos: []
citations: []
updatedAt: "2026-03-01"
---

A voucher system gives parents direct purchasing power over education.
```

`glossary/draft-term.mdx` — draft fixture, must NOT appear in indexed docs:

```mdx
---
term: "Draft Term Should Not Index"
definition: "A draft glossary entry."
aliases: []
relatedTerms: []
relatedFAQs: []
relatedVideos: []
citations: []
draft: true
---

This entry has draft: true and the reader must skip it.
```

`faqs/agriculture/why-msp.mdx`:

```mdx
---
question: "Why does MSP exist?"
topic: "agriculture"
order: 1
relatedFAQs: []
relatedVideos: []
updatedAt: "2026-02-10"
---

MSP exists to provide income stability to farmers in select crops.
The Centre for Civil Society argues MSP distorts cropping patterns over time.
```

`faqs/education/draft-faq.mdx` — draft fixture for faqs:

```mdx
---
question: "Draft FAQ Should Not Index"
topic: "education"
order: 99
relatedFAQs: []
relatedVideos: []
draft: true
---

This faq has draft: true and must be skipped.
```

`videos/agriculture/contract-farming.mdx`:

```mdx
---
title: "Contract Farming Explained"
topic: "agriculture"
youtubeId: "abc123XYZ"
duration: "12:34"
order: 1
description: "How contract farming works and why CCS supports voluntary contracts."
relatedFAQs: []
relatedVideos: []
updatedAt: "2026-01-15"
---

Contract farming creates pre-agreed terms between farmer and buyer.
```

`wiki/msp.mdx`:

```mdx
---
type: entity
name: "Minimum Support Price"
description: "Government procurement floor price."
sources: []
related_terms: ["msp"]
related_faqs: []
last_regen: "2026-05-01"
source_hashes: {}
---

The MSP regime in India covers 23 commodities as of 2026.
```

`wiki/draft-entity.mdx` — draft fixture for wiki:

```mdx
---
type: entity
name: "Draft Entity Should Not Index"
description: "A draft wiki entry."
sources: []
related_terms: []
related_faqs: []
last_regen: "2026-05-01"
source_hashes: {}
draft: true
---

Wiki entry with draft: true must be skipped.
```

`external/spontaneous-order/sample-post.md`:

```markdown
---
title: "On the political economy of MSP"
original_url: "https://spontaneousorder.in/posts/msp-political-economy"
published_at: "2025-08-15"
ingested_at: "2025-08-16"
tags: ["msp", "agriculture"]
---

A short essay on why MSP became a political third rail despite its economic costs.
```

`external/ccs-books/jeevan/chapter-1-introduction.md` — exercises nested directory under ccs-books:

```markdown
---
book_slug: "jeevan"
book_title: "Jeevan Mein Bharat"
chapter_number: 1
chapter_title: "Introduction to Indian Liberty"
publisher: "Centre for Civil Society"
ingested_at: "2025-12-01"
---

The opening chapter introduces the case for liberty in Indian policy.
```

- [ ] **Step 2: Write failing tests.**

Write `tests/agent-search/read-collections.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readCollections } from '../../src/lib/agent-search/read-collections';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/content');

describe('readCollections', () => {
  it('reads all six expected content kinds from disk', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const kinds = new Set(docs.map((d) => d.kind));
    expect(kinds).toContain('topic');
    expect(kinds).toContain('glossary');
    expect(kinds).toContain('faq');
    expect(kinds).toContain('video');
    expect(kinds).toContain('wiki');
    expect(kinds).toContain('external');
  });

  it('produces stable doc ids', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const mspGlossary = docs.find((d) => d.id === 'glossary/msp');
    expect(mspGlossary).toBeDefined();
    expect(mspGlossary!.kind).toBe('glossary');
    expect(mspGlossary!.title).toContain('MSP');
  });

  it('builds first-party canonical_url and markdown_url', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const msp = docs.find((d) => d.id === 'glossary/msp')!;
    expect(msp.citation.canonical_url).toBe('https://example.com/glossary/msp/');
    expect(msp.citation.markdown_url).toBe('https://example.com/glossary/msp.md');
    expect(msp.citation.kind).toBe('glossary');
  });

  it('builds correct faq URL with topic prefix', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const faq = docs.find((d) => d.id === 'faq/agriculture/why-msp')!;
    expect(faq.citation.canonical_url).toBe(
      'https://example.com/topics/agriculture/faq/why-msp/',
    );
  });

  it('builds correct video URL with topic prefix', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const video = docs.find((d) => d.kind === 'video')!;
    expect(video).toBeDefined();
    expect(video.citation.canonical_url).toMatch(
      /^https:\/\/example\.com\/topics\/agriculture\/videos\/contract-farming\/$/,
    );
  });

  it('uses original_url as canonical for Spontaneous Order posts', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const post = docs.find(
      (d) => d.id === 'external/spontaneous-order/sample-post',
    )!;
    expect(post).toBeDefined();
    expect(post.citation.canonical_url).toBe(
      'https://spontaneousorder.in/posts/msp-political-economy',
    );
    expect(post.citation.markdown_url).toBe(
      'https://example.com/external/spontaneous-order/sample-post.md',
    );
  });

  it('falls back to markdown_url as canonical for CCS Books chapters', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const chapter = docs.find((d) => d.kind === 'external' && d.id.includes('jeevan'))!;
    expect(chapter).toBeDefined();
    // No public HTML page for ccs-books — canonical falls back to markdown.
    expect(chapter.citation.canonical_url).toBe(chapter.citation.markdown_url);
    expect(chapter.citation.canonical_url).toContain(
      '/external/ccs-books/jeevan/chapter-1-introduction.md',
    );
  });

  it('uses ingested_at as last_modified for ccs-books', () => {
    const docs = readCollections({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const chapter = docs.find((d) => d.kind === 'external' && d.id.includes('jeevan'))!;
    expect(chapter.citation.last_modified).toBe('2025-12-01');
  });

  it('tokenizes title + body into tf and length', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const msp = docs.find((d) => d.id === 'glossary/msp')!;
    expect(msp.tf['msp']).toBeGreaterThan(0);
    expect(msp.length).toBeGreaterThan(5);
  });

  it('skips drafts across glossary, faqs, and wiki', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    // Each draft fixture's id contains "draft" — none should appear.
    const ids = docs.map((d) => d.id);
    expect(ids.find((id) => id === 'glossary/draft-term')).toBeUndefined();
    expect(ids.find((id) => id === 'faq/education/draft-faq')).toBeUndefined();
    expect(ids.find((id) => id === 'wiki/draft-entity')).toBeUndefined();
  });

  it('sets last_modified from frontmatter when present', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const msp = docs.find((d) => d.id === 'glossary/msp')!;
    expect(msp.citation.last_modified).toBe('2026-04-12');
  });

  it('uses last_regen as last_modified for wiki entries', () => {
    const docs = readCollections({ contentDir: FIXTURES });
    const wiki = docs.find((d) => d.id === 'wiki/msp')!;
    expect(wiki.citation.last_modified).toBe('2026-05-01');
  });

  it('throws when a faq is nested deeper than <topic>/<slug>', () => {
    // One-off bad fixture under tmp/ — cleaner than polluting the shared tree.
    const tmp = mkdtempSync(join(tmpdir(), 'agent-search-bad-'));
    mkdirSync(join(tmp, 'faqs/agriculture/sub'), { recursive: true });
    writeFileSync(
      join(tmp, 'faqs/agriculture/sub/x.mdx'),
      `---\nquestion: "Bad"\ntopic: agriculture\norder: 1\n---\nbody`,
    );
    expect(() => readCollections({ contentDir: tmp })).toThrow(
      /unexpected faq path/,
    );
  });
});
```

Run:

```bash
npm test -- tests/agent-search/read-collections.test.ts
```

Expected: FAIL — `readCollections` not defined.

- [ ] **Step 3: Implement the reader.**

Write `src/lib/agent-search/read-collections.ts`:

```typescript
/**
 * Read all relevant Astro content collections from disk and produce
 * IndexedDoc[] for the BM25 builder.
 *
 * We can't use `astro:content` here — the build script runs in plain Node
 * via tsx, and astro:content is only available inside Astro pages or
 * integrations. So we walk the filesystem and parse frontmatter with
 * gray-matter, mirroring astro.config.mjs:23-43.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import matter from 'gray-matter';
import type { ContentKind, IndexedDoc, Citation } from './types.js';
import { tokenize } from './tokenize.js';

const DEFAULT_SITE_URL = 'https://liberty-lighthouse.vercel.app';

interface ReaderOpts {
  /** Root directory containing topics/, faqs/, glossary/, etc. */
  contentDir: string;
  /** Site origin used for canonical_url + markdown_url. */
  siteUrl?: string;
}

interface CollectionSpec {
  /** Subdirectory under contentDir. */
  dir: string;
  /** Kind label on the resulting IndexedDoc. */
  kind: ContentKind;
  /** File patterns to include. */
  exts: readonly string[];
  /** Builds id, canonical url, markdown url, and title for each entry. */
  shape: (entry: ParsedEntry) => {
    id: string;
    title: string;
    canonical_url: string;
    markdown_url: string;
    last_modified: string;
  };
}

interface ParsedEntry {
  /** Slug-style relative path under the collection's directory, e.g. "msp" or "agriculture/why-msp". */
  relPath: string;
  /** Full filesystem path. */
  fullPath: string;
  /** Parsed frontmatter. */
  data: Record<string, unknown>;
  /** Markdown body. */
  body: string;
  /** Site origin to use when building URLs. */
  siteUrl: string;
}

function joinUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl + '/').href;
}

const COLLECTIONS: CollectionSpec[] = [
  {
    dir: 'topics',
    kind: 'topic',
    exts: ['.json'],
    shape: ({ relPath, data, siteUrl }) => {
      const slug = (data.slug as string) ?? relPath;
      return {
        id: `topic/${slug}`,
        title: (data.title as string) ?? slug,
        canonical_url: joinUrl(siteUrl, `/topics/${slug}/`),
        markdown_url: joinUrl(siteUrl, `/topics/${slug}.md`),
        last_modified: (data.updatedAt as string) ?? today(),
      };
    },
  },
  {
    dir: 'glossary',
    kind: 'glossary',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => ({
      id: `glossary/${relPath}`,
      title: (data.term as string) ?? relPath,
      canonical_url: joinUrl(siteUrl, `/glossary/${relPath}/`),
      markdown_url: joinUrl(siteUrl, `/glossary/${relPath}.md`),
      last_modified: (data.updatedAt as string) ?? today(),
    }),
  },
  {
    dir: 'faqs',
    kind: 'faq',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => {
      // FAQs live as "<topic>/<slug>" — exactly two path segments. URL
      // construction below assumes flat; deeper nesting would produce
      // 404'ing canonical URLs. Assert and fail loudly.
      const parts = relPath.split(sep);
      if (parts.length !== 2) {
        throw new Error(
          `agent-search: unexpected faq path "${relPath}" — ` +
            `faqs must live as "<topic>/<slug>". Found ${parts.length} segments.`,
        );
      }
      const [topicFromPath, slug] = parts;
      const topic = (data.topic as string) ?? topicFromPath;
      return {
        id: `faq/${topic}/${slug}`,
        title: (data.question as string) ?? slug,
        canonical_url: joinUrl(siteUrl, `/topics/${topic}/faq/${slug}/`),
        markdown_url: joinUrl(siteUrl, `/topics/${topic}/faq/${slug}.md`),
        last_modified: (data.updatedAt as string) ?? today(),
      };
    },
  },
  {
    dir: 'videos',
    kind: 'video',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => {
      const parts = relPath.split(sep);
      if (parts.length !== 2) {
        throw new Error(
          `agent-search: unexpected video path "${relPath}" — ` +
            `videos must live as "<topic>/<slug>". Found ${parts.length} segments.`,
        );
      }
      const [topicFromPath, slug] = parts;
      const topic = (data.topic as string) ?? topicFromPath;
      return {
        id: `video/${topic}/${slug}`,
        title: (data.title as string) ?? slug,
        canonical_url: joinUrl(siteUrl, `/topics/${topic}/videos/${slug}/`),
        markdown_url: joinUrl(siteUrl, `/topics/${topic}/videos/${slug}.md`),
        last_modified: (data.updatedAt as string) ?? today(),
      };
    },
  },
  {
    dir: 'wiki',
    kind: 'wiki',
    exts: ['.mdx', '.md'],
    shape: ({ relPath, data, siteUrl }) => ({
      id: `wiki/${relPath}`,
      title: (data.name as string) ?? relPath,
      canonical_url: joinUrl(siteUrl, `/wiki/${relPath}/`),
      markdown_url: joinUrl(siteUrl, `/wiki/${relPath}.md`),
      last_modified: (data.last_regen as string) ?? today(),
    }),
  },
  {
    dir: 'external/spontaneous-order',
    kind: 'external',
    exts: ['.md'],
    shape: ({ relPath, data, siteUrl }) => {
      // Spontaneous Order has a real upstream URL — citations send humans
      // to the original publisher per docs/agents-api.md §6.
      const originalUrl = data.original_url as string | undefined;
      const markdownUrl = joinUrl(
        siteUrl,
        `/external/spontaneous-order/${relPath}.md`,
      );
      return {
        id: `external/spontaneous-order/${relPath}`,
        title: (data.title as string) ?? relPath,
        canonical_url: originalUrl ?? markdownUrl,
        markdown_url: markdownUrl,
        last_modified: (data.published_at as string) ?? today(),
      };
    },
  },
  {
    dir: 'external/ccs-books',
    kind: 'external',
    exts: ['.md'],
    shape: ({ relPath, data, siteUrl }) => {
      // CCS Books have no public HTML page. Per docs/agents-api.md §6,
      // canonical_url falls back to the markdown URL itself.
      const markdownUrl = joinUrl(siteUrl, `/external/ccs-books/${relPath}.md`);
      return {
        id: `external/ccs-books/${relPath}`,
        title: (data.chapter_title as string) ?? relPath,
        canonical_url: markdownUrl,
        markdown_url: markdownUrl,
        last_modified: (data.ingested_at as string) ?? today(),
      };
    },
  },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function* walk(root: string, exts: readonly string[]): Generator<string> {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(root, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      yield* walk(full, exts);
    } else if (exts.some((e) => name.endsWith(e))) {
      yield full;
    }
  }
}

export function readCollections(opts: ReaderOpts): IndexedDoc[] {
  const siteUrl = (opts.siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, '');
  const out: IndexedDoc[] = [];

  for (const spec of COLLECTIONS) {
    const dirRoot = join(opts.contentDir, spec.dir);
    for (const fullPath of walk(dirRoot, spec.exts)) {
      const raw = readFileSync(fullPath, 'utf8');
      const parsed =
        spec.exts.includes('.json')
          ? { data: JSON.parse(raw) as Record<string, unknown>, content: '' }
          : matter(raw);
      const data = parsed.data as Record<string, unknown>;
      if (data.draft) continue;
      const relRaw = relative(dirRoot, fullPath);
      // Strip extension to derive a slug-style relPath.
      const relPath = relRaw.replace(/\.(mdx?|json)$/, '');
      const entry: ParsedEntry = {
        relPath,
        fullPath,
        data,
        body: typeof parsed.content === 'string' ? parsed.content : '',
        siteUrl,
      };
      const meta = spec.shape(entry);
      const text = `${meta.title}\n${entry.body}`.trim();
      const tokens = tokenize(text);
      const tf: Record<string, number> = {};
      for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
      const citation: Citation = {
        canonical_url: meta.canonical_url,
        markdown_url: meta.markdown_url,
        title: meta.title,
        kind: spec.kind,
        last_modified: meta.last_modified,
      };
      out.push({
        id: meta.id,
        kind: spec.kind,
        title: meta.title,
        tf,
        length: tokens.length,
        text,
        citation,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/read-collections.test.ts
```

Expected: PASS — all cases (12 in the original `describe` block plus the bad-fixture throw test = 13 total).

- [ ] **Step 5: Update barrel.**

```typescript
// src/lib/agent-search/index.ts
export * from './types.js';
export { tokenize } from './tokenize.js';
export { scoreDoc, computeIdf, DEFAULT_BM25, type BM25Opts } from './bm25.js';
export { extractSnippet } from './snippet.js';
export { readCollections } from './read-collections.js';
```

- [ ] **Step 6: Commit.**

```bash
git add src/lib/agent-search/read-collections.ts src/lib/agent-search/index.ts \
        tests/agent-search/read-collections.test.ts \
        tests/agent-search/fixtures
git commit -m "Read content collections from disk into IndexedDoc"
```

---

## Chunk 3: Composition and build integration (Tasks 6–8)

This chunk composes the prior chunks into a runnable system: the index builder CLI, the runtime loader with module-scoped caching, the public `search()` function, and the npm-script wiring that hooks index generation into `npm run build`. Output: `npm run build` produces a real BM25 index over the live corpus, and `search("MSP")` works end-to-end.

### Task 6: Index builder

**Files:**
- Create: `src/lib/agent-search/build-index.ts`
- Create: `tests/agent-search/build-index.test.ts`
- Modify: `src/lib/agent-search/index.ts`

**Context:** Compose `readCollections` + `computeIdf` to produce a serializable `AgentIndex`. Expose it both as a library function and as a CLI. The CLI is what `npm run build:agent-index` invokes.

- [ ] **Step 1: Write failing tests.**

Write `tests/agent-search/build-index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/content');

describe('buildIndex', () => {
  it('produces an AgentIndex with docs, idf, and meta', () => {
    const idx = buildIndex({ contentDir: FIXTURES });
    expect(idx.docs.length).toBeGreaterThan(3);
    expect(Object.keys(idx.idf).length).toBeGreaterThan(5);
    expect(idx.meta.corpus_count).toBe(idx.docs.length);
    expect(idx.meta.avg_doc_length).toBeGreaterThan(0);
    expect(typeof idx.meta.built_at).toBe('string');
  });

  it('idf has higher value for rare terms than common ones', () => {
    const idx = buildIndex({ contentDir: FIXTURES });
    // 'msp' appears in glossary, faq, wiki, and external — common in fixtures.
    // 'voucher' or 'rte' appears in only a few — rarer.
    const mspIdf = idx.idf['msp'];
    const rareIdf = idx.idf['voucher'] ?? idx.idf['vouchers'] ?? 0;
    expect(rareIdf).toBeGreaterThanOrEqual(0);
    expect(mspIdf).toBeDefined();
  });

  it('result is JSON-serializable round-trip', () => {
    const idx = buildIndex({ contentDir: FIXTURES });
    const json = JSON.stringify(idx);
    const parsed = JSON.parse(json);
    expect(parsed.docs.length).toBe(idx.docs.length);
    expect(parsed.meta.corpus_count).toBe(idx.meta.corpus_count);
  });
});
```

Run:

```bash
npm test -- tests/agent-search/build-index.test.ts
```

Expected: FAIL — `buildIndex` not defined.

- [ ] **Step 2: Implement the builder + CLI.**

Write `src/lib/agent-search/build-index.ts`:

```typescript
/**
 * Build the BM25 index from the content collections on disk.
 *
 * Library export: buildIndex({ contentDir, siteUrl }) -> AgentIndex
 * CLI: tsx src/lib/agent-search/build-index.ts [--out <path>] [--site-url <url>]
 *
 * Run via: npm run build:agent-index
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AgentIndex } from './types.js';
import { readCollections } from './read-collections.js';
import { computeIdf } from './bm25.js';

interface BuildOpts {
  contentDir: string;
  siteUrl?: string;
}

export function buildIndex(opts: BuildOpts): AgentIndex {
  const docs = readCollections(opts);
  const idf = computeIdf(docs);
  const totalLength = docs.reduce((s, d) => s + d.length, 0);
  const avg = docs.length ? totalLength / docs.length : 0;
  return {
    docs,
    idf,
    meta: {
      built_at: new Date().toISOString(),
      corpus_count: docs.length,
      avg_doc_length: avg,
    },
  };
}

function parseArgs(argv: string[]): { out?: string; siteUrl?: string } {
  const out: { out?: string; siteUrl?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--site-url') out.siteUrl = argv[++i];
  }
  return out;
}

// Run as CLI when invoked directly. tsx may rewrite paths, so compare
// the resolved file URL rather than a raw string.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const cwd = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const contentDir = resolve(cwd, 'src/content');
  const out = resolve(cwd, args.out ?? 'src/lib/agent-search/_generated/index.json');
  const idx = buildIndex({ contentDir, siteUrl: args.siteUrl });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(idx));
  // eslint-disable-next-line no-console
  console.error(
    `[agent-search] built index: ${idx.meta.corpus_count} docs, ` +
      `${Object.keys(idx.idf).length} terms → ${out}`,
  );
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/build-index.test.ts
```

Expected: PASS — all 3 cases.

- [ ] **Step 4: Update barrel.**

```typescript
// src/lib/agent-search/index.ts
export * from './types.js';
export { tokenize } from './tokenize.js';
export { scoreDoc, computeIdf, DEFAULT_BM25, type BM25Opts } from './bm25.js';
export { extractSnippet } from './snippet.js';
export { readCollections } from './read-collections.js';
export { buildIndex } from './build-index.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agent-search/build-index.ts src/lib/agent-search/index.ts tests/agent-search/build-index.test.ts
git commit -m "Add buildIndex composer and CLI entrypoint"
```

---

### Task 7: Runtime loader + public search()

**Files:**
- Create: `src/lib/agent-search/load-index.ts`
- Create: `src/lib/agent-search/search.ts`
- Create: `tests/agent-search/search.test.ts`
- Modify: `src/lib/agent-search/index.ts`
- Modify: `.gitignore`

**Context:** `load-index.ts` is what runtime code calls. It dynamically imports `_generated/index.json` (so Vite/Rollup bundles it into the function on Vercel) and caches the result in module scope — warm functions reuse without re-parsing. The dynamic import path is relative to the source file; bundlers trace it correctly.

`search.ts` is the public API consumed by Phase 2's HTTP handlers and Phase 3's MCP transport. It is **async-only** — every call goes through `loadIndex()` and resolves on the same microtask once the cache is populated. There is no sync variant; that simplifies the API surface, removes the "did the caller remember to preload?" footgun, and adds zero latency in practice (the first call awaits a single `import()`, every subsequent call resolves synchronously inside the awaited Promise).

The test seam (`_setIndexForTesting`) is **not** re-exported from the public barrel — tests deep-import from `load-index.js` instead. This keeps the public surface limited to what Phase 2/3 consumers should see.

- [ ] **Step 1: Add gitignore entry.**

Edit `.gitignore`. After the existing `dist/` line, add:

```
# generated BM25 index (rebuilt by `npm run build:agent-index`)
src/lib/agent-search/_generated/
```

- [ ] **Step 2: Write failing tests for the loader.**

Write `tests/agent-search/search.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { search } from '../../src/lib/agent-search/search';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/content');

describe('search()', () => {
  beforeAll(() => {
    const idx = buildIndex({ contentDir: FIXTURES, siteUrl: 'https://example.com' });
    _setIndexForTesting(idx);
  });

  it('"MSP" returns the glossary entry as top hit', async () => {
    const hits = await search('MSP', { k: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe('glossary');
    expect(hits[0].title).toContain('MSP');
    expect(hits[0].citation.canonical_url).toContain('/glossary/msp/');
  });

  it('every hit carries a complete citation', async () => {
    const hits = await search('voucher');
    for (const h of hits) {
      expect(h.citation.canonical_url).toMatch(/^https?:\/\//);
      expect(h.citation.markdown_url).toMatch(/^https?:\/\//);
      expect(h.citation.title).toBeTruthy();
      expect(h.citation.kind).toBeTruthy();
      expect(h.citation.last_modified).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it('respects k', async () => {
    const hits = await search('msp', { k: 1 });
    expect(hits.length).toBe(1);
  });

  it('caps k at 25', async () => {
    const hits = await search('msp', { k: 100 });
    expect(hits.length).toBeLessThanOrEqual(25);
  });

  it('filters by kinds', async () => {
    const hits = await search('msp', { kinds: ['glossary'] });
    expect(hits.every((h) => h.kind === 'glossary')).toBe(true);
  });

  it('returns [] for empty query', async () => {
    expect(await search('')).toEqual([]);
    expect(await search('   ')).toEqual([]);
  });

  it('returns [] when no doc matches', async () => {
    expect(await search('xyzzynonsense')).toEqual([]);
  });

  it('hits are ranked descending by score', async () => {
    const hits = await search('msp', { k: 10 });
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it('hits expose ascending rank starting at 1', async () => {
    const hits = await search('msp', { k: 5 });
    hits.forEach((h, i) => expect(h.rank).toBe(i + 1));
  });

  it('completes second call in under 50ms on the fixture corpus', async () => {
    // First call populates module-scope cache and any JIT warmup.
    await search('minimum support price');
    const t0 = performance.now();
    await search('minimum support price');
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
  });
});
```

Run:

```bash
npm test -- tests/agent-search/search.test.ts
```

Expected: FAIL — `search` and `_setIndexForTesting` not defined.

- [ ] **Step 3: Implement the loader.**

Write `src/lib/agent-search/load-index.ts`:

```typescript
/**
 * Runtime index loader.
 *
 * Lazy-loads _generated/index.json on first use and caches the result in
 * module scope so warm Vercel functions reuse it without re-parsing.
 *
 * Test seam: _setIndexForTesting() lets unit tests inject a synthetic
 * index without writing to disk. Tests deep-import this directly; it is
 * deliberately NOT re-exported from the public package barrel.
 */
import type { AgentIndex } from './types.js';

let cached: AgentIndex | null = null;

export async function loadIndex(): Promise<AgentIndex> {
  if (cached) return cached;
  // Dynamic import so the JSON is bundled by Vite/Rollup but not read at
  // module-load time. Path is relative to this source file.
  const mod = (await import('./_generated/index.json', {
    with: { type: 'json' },
  })) as { default: AgentIndex };
  cached = mod.default;
  return cached;
}

export function _setIndexForTesting(idx: AgentIndex): void {
  cached = idx;
}
```

- [ ] **Step 4: Implement search().**

Write `src/lib/agent-search/search.ts`:

```typescript
/**
 * Public search() API. Async-only.
 *
 * Awaits the index loader, tokenizes the query, scores every doc with
 * BM25, returns the top-k hits with snippets and citations. The cache
 * inside loadIndex() means every call after the first resolves on the
 * same microtask — no I/O, no measurable async overhead.
 */
import type { ContentKind, SearchHit, SearchOptions } from './types.js';
import { tokenize } from './tokenize.js';
import { scoreDoc } from './bm25.js';
import { extractSnippet } from './snippet.js';
import { loadIndex } from './load-index.js';

const MAX_K = 25;
const DEFAULT_K = 10;

export async function search(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const idx = await loadIndex();
  const k = Math.min(MAX_K, Math.max(1, opts.k ?? DEFAULT_K));
  const kindFilter: Set<ContentKind> | null = opts.kinds?.length
    ? new Set(opts.kinds)
    : null;

  const scored: Array<{ score: number; docIdx: number }> = [];
  for (let i = 0; i < idx.docs.length; i++) {
    const doc = idx.docs[i];
    if (kindFilter && !kindFilter.has(doc.kind)) continue;
    const score = scoreDoc(queryTokens, doc, idx.idf, idx.meta.avg_doc_length);
    if (score > 0) scored.push({ score, docIdx: i });
  }
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map(({ score, docIdx }, i) => {
    const doc = idx.docs[docIdx];
    return {
      rank: i + 1,
      score,
      kind: doc.kind,
      title: doc.title,
      snippet: extractSnippet(doc.text, queryTokens),
      citation: doc.citation,
    };
  });
}
```

- [ ] **Step 5: Run tests, verify pass.**

```bash
npm test -- tests/agent-search/search.test.ts
```

Expected: PASS — all 10 cases including the <50ms performance check.

- [ ] **Step 6: Update barrel.**

The public barrel exposes only what Phase 2 and 3 consumers need. Test seams (`_setIndexForTesting`, `_resetIndexForTesting`) stay deep-import only — tests already use `'../../src/lib/agent-search/load-index'` directly.

```typescript
// src/lib/agent-search/index.ts
export * from './types.js';
export { tokenize } from './tokenize.js';
export { scoreDoc, computeIdf, DEFAULT_BM25, type BM25Opts } from './bm25.js';
export { extractSnippet } from './snippet.js';
export { readCollections } from './read-collections.js';
export { buildIndex } from './build-index.js';
export { loadIndex } from './load-index.js';
export { search } from './search.js';
```

- [ ] **Step 7: Commit.**

```bash
git add src/lib/agent-search/load-index.ts src/lib/agent-search/search.ts \
        src/lib/agent-search/index.ts tests/agent-search/search.test.ts .gitignore
git commit -m "Add runtime loader and async search() API"
```

---

### Task 8: Build integration + real-corpus smoke test

**Files:**
- Modify: `package.json` (add `build:agent-index` and `prebuild` scripts)
- Create: `tests/agent-search/real-corpus.test.ts` (skipped by default; opt-in via env var)

**Context:** Wire the index builder into `npm run build` so deploys produce a fresh index. The `prebuild` npm hook runs automatically before `build`. Also add an opt-in test that runs against the *real* `src/content/` directory — useful for catching regressions when content changes, but skipped in normal CI to keep the test suite fast.

- [ ] **Step 1: Add the npm scripts.**

Edit `package.json` scripts block:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "prebuild": "npm run build:agent-index",
    "build:agent-index": "tsx src/lib/agent-search/build-index.ts",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run",
    "test:watch": "vitest",
    "ingest:rss": "tsx scripts/ingest/spontaneous-order.ts",
    "ingest:rss:fetch-backlog": "tsx scripts/ingest/spontaneous-order-fetch.ts",
    "ingest:book": "tsx scripts/ingest/book.ts",
    "ingest:summarize": "tsx scripts/ingest/summarize.ts",
    "ingest:wiki": "tsx scripts/ingest/wiki-regen.ts",
    "mcp:start": "tsx mcp/server.ts",
    "mcp:test": "tsx mcp/test-client.ts"
  }
}
```

- [ ] **Step 2: Write the opt-in real-corpus smoke test.**

Write `tests/agent-search/real-corpus.test.ts`:

```typescript
/**
 * Opt-in smoke test against the real src/content/ corpus.
 *
 * Skipped by default to keep the unit test run fast. Enable with:
 *   AGENT_SEARCH_REAL=1 npm test -- tests/agent-search/real-corpus.test.ts
 *
 * Use this when you've changed the reader, the tokenizer, or BM25 params,
 * to verify the production corpus still ranks sensibly.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { search } from '../../src/lib/agent-search/search';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_CONTENT = resolve(__dirname, '../../src/content');
const ENABLED = process.env.AGENT_SEARCH_REAL === '1';

describe.runIf(ENABLED)('real corpus smoke', () => {
  beforeAll(() => {
    const idx = buildIndex({ contentDir: REAL_CONTENT });
    _setIndexForTesting(idx);
    // eslint-disable-next-line no-console
    console.log(
      `[real-corpus] indexed ${idx.meta.corpus_count} docs, ` +
        `${Object.keys(idx.idf).length} terms`,
    );
  });

  it('"MSP" returns a glossary or wiki hit in the top 3', async () => {
    const hits = await search('MSP', { k: 5 });
    expect(hits.length).toBeGreaterThan(0);
    const top3Kinds = hits.slice(0, 3).map((h) => h.kind);
    expect(
      top3Kinds.includes('glossary') || top3Kinds.includes('wiki'),
    ).toBe(true);
  });

  it('"voucher" surfaces an education FAQ or glossary entry', async () => {
    const hits = await search('voucher system', { k: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('second search call completes in under 200ms on the real corpus', async () => {
    await search('minimum support price farmer income'); // warm cache + JIT
    const t0 = performance.now();
    await search('minimum support price farmer income');
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
```

- [ ] **Step 3: Run the build script against the real corpus.**

```bash
npm run build:agent-index
```

Expected stderr line:

```
[agent-search] built index: <N> docs, <M> terms → /Users/.../src/lib/agent-search/_generated/index.json
```

Sanity bounds: `<N>` should be **O(1000)** — at the time of writing, the design doc §2 reports ~1,149 docs (29 FAQs + 15 videos + 4 glossary + 5 wiki + 2 topics + 1,094 external). If the count comes back wildly different (under 500 or over 2000), pause and investigate before proceeding — content has likely been added/removed or the reader is dropping a collection. `<M>` (term count) should be in the thousands.

- [ ] **Step 4: Run the opt-in real-corpus test.**

```bash
AGENT_SEARCH_REAL=1 npm test -- tests/agent-search/real-corpus.test.ts
```

Expected: PASS, with a log line showing the indexed corpus size.

- [ ] **Step 5: Run the standard test suite to confirm nothing else broke.**

```bash
npm test
```

Expected: PASS — every test file including new ones. Real-corpus suite is skipped (no env var).

- [ ] **Step 6: Confirm `npm run build` works end-to-end.**

```bash
npm run build
```

Expected: prebuild generates the index, then `astro build` succeeds. The build output prints both the `[agent-search]` line and Astro's normal build summary.

> **Deferred verification — Vercel function bundling.** This phase ships only a library; no Vercel function consumes it yet. The dynamic `import('./_generated/index.json', { with: { type: 'json' } })` inside `load-index.ts` *should* be traced and bundled by the `@astrojs/vercel` adapter at deploy time, but we have no endpoint exercising it in Phase 1. Phase 2 (the first HTTP route to call `loadIndex()`) is the right place to verify on a Vercel preview deploy that the JSON ships inside the function bundle. If it doesn't, the fallback is a static-asset fetch from `/_agent-index.json` — a small refactor of `load-index.ts`. Note in Phase 2's plan as the first thing to verify after deploy.

- [ ] **Step 7: Commit.**

```bash
git add package.json tests/agent-search/real-corpus.test.ts
git commit -m "Wire build:agent-index into prebuild and add opt-in smoke test"
```

---

## Verification gate (whole phase)

After Task 8 commits, the implementer must run all of these and confirm each passes before declaring Phase 1 complete:

```bash
# 1. All unit tests pass.
npm test

# 2. Real-corpus smoke passes.
AGENT_SEARCH_REAL=1 npm test -- tests/agent-search/real-corpus.test.ts

# 3. Index build runs in <10s on the real corpus.
time npm run build:agent-index

# 4. Full build succeeds.
npm run build

# 5. No file in the new package exceeds 200 lines.
find src/lib/agent-search -name '*.ts' | xargs wc -l | sort -n
```

Report results in the implementation summary.

---

## Out-of-band notes for the executing controller

- This worktree is on branch `claude/gallant-pasteur-fd5c68`. All commits land here; integration to `main` is a later concern handled by @superpowers:finishing-a-development-branch after Phase 1 lands.
- Skill chain in effect: @superpowers:test-driven-development for every task, @superpowers:verification-before-completion before marking the phase complete, @superpowers:requesting-code-review to drive the spec and quality reviewers.
- The final code reviewer at end-of-phase should additionally verify the JSDoc file headers exist on every new `.ts` and that the public API surface (`src/lib/agent-search/index.ts`) cleanly re-exports only what later phases will need.
- If any task's "≤200 lines" file size budget is breached during implementation, the implementer should split before committing. Do not commit a 300-line `read-collections.ts`. Splits live in the same package; update the barrel.

## After this plan ships

Phase 2 plan (`docs/superpowers/plans/2026-05-06-agents-api-phase-2-http-api.md`) gets written next, consuming this library to expose `/api/v1/{search,fetch,index,glossary,topics}` HTTP endpoints. Phases 3–5 follow the same pattern, one plan per phase, written after the predecessor lands. The full design contract for all phases lives in [docs/agents-api.md](../../agents-api.md).
