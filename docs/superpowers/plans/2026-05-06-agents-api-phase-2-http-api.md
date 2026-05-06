# Agents API — Phase 2: Public HTTP API — Implementation Plan

> **For agentic workers:** REQUIRED: Use @superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. Each task follows @superpowers:test-driven-development.

**Goal:** Expose the BM25 search library (Phase 1) as a public, anonymous HTTP API at `/api/v1/{index,search,fetch,glossary,topics}`. Every endpoint returns JSON with citation blocks. Pure handler functions live in `src/lib/agents-api/` so Phase 3's MCP transport can reuse them without re-implementing logic.

**Architecture:** Vercel-native serverless functions at root `api/v1/*.ts` (Node.js runtime, Express-like `(req, res)` shape — matches existing [api/auth.js](../../../api/auth.js), [api/comment-auth.js](../../../api/comment-auth.js)). HTTP wrappers parse query strings, call pure handlers in `src/lib/agents-api/handlers/`, and format JSON responses with CORS headers and a structured error envelope. **No Astro config changes** — leaves the static site untouched. Pure handlers return typed payloads or throw `AgentError`; wrappers catch and convert to the §8 error shape.

**Production runtime path resolution.** Vercel functions run with `cwd = /var/task` and only get the files the bundler traces (JS/TS imports + JSON imports). Raw `fs.readdirSync('src/content/...')` calls are **not** traced and would fail at runtime. Two fixes apply across the phase:

1. **`vercel.json` `includeFiles` glob** — bundles the content trees the handlers need into every `api/v1/*.ts` function. Task 8 wires this. We bundle `src/content/{topics,glossary,faqs,videos}/**`; the 1094-file `external/` tree is **not** bundled because the BM25 index already contains everything search needs from it.

2. **Handler `contentDir` defaults are `import.meta.url`-anchored, not `process.cwd()`-anchored.** Each handler computes its default content path via `fileURLToPath(new URL('../../../content', import.meta.url))` from inside `src/lib/agents-api/handlers/`. This walks: `handlers/` → `agents-api/` → `lib/` → `src/` → into `content/`. The path resolves against the source file's own URL, which survives Vercel's bundling regardless of how cwd is set. Tests can still override with explicit `contentDir`.

**Tech Stack:** TypeScript ESM (Node ≥20), Vitest 4, gray-matter (already a dep), Vercel's auto-detected `api/` directory for serverless functions, `@modelcontextprotocol/sdk` (only for type imports — actual MCP wiring is Phase 3).

**Spec:** Implements §5 (tool surface), §6 (citation contract), §7 (HTTP endpoints), §8 (error taxonomy) of [docs/agents-api.md](../../agents-api.md). Does not implement MCP transport (Phase 3) or Vercel deploy verification (deferred via Phase 1's flag in §10 of that plan).

---

## Scope

**In scope:**
- Pure handler functions for all five tools (`read_index`, `search`, `fetch`, `list_glossary`, `list_topics`).
- HTTP wrappers at root `api/v1/*.ts` calling the handlers.
- CORS infrastructure (`Access-Control-Allow-Origin: *`, no auth).
- Error taxonomy: `BAD_REQUEST` / `NOT_FOUND` / `UPSTREAM_ERROR` / `VALIDATION_ERROR` with §8 envelope.
- Refactor llms.txt generation from `src/pages/llms.txt.ts` into a reusable helper (mirrors the existing pattern at `src/lib/agents-doc.ts` for AGENTS.md).
- Tests: per-handler unit tests, a smoke test for the wrapper composition.
- Local build verification (`npm run build` still succeeds; no regressions in existing routes).

**Out of scope (deferred):**
- Phase 3: Streamable HTTP MCP at `/api/v1/mcp`.
- Phase 4+: OpenAPI spec, Custom GPT, `/ai` page, telemetry, admin dashboard, privacy update.
- Refactoring [mcp/server.ts](../../../mcp/server.ts) — keeps working as-is. Phase 3 may unify it.
- Cache headers on the new endpoints (defer to whichever Vercel default is fine; tune later if needed).
- Rate limiting (intentional per design doc §4 — public, anonymous, no infra).
- Vercel preview deploy and live function-bundling verification (one-shot manual check after merge).

**Success criteria for this phase:**
1. `npm test` passes including new tests under `tests/agents-api/`.
2. From a Vitest test, calling each handler with valid input returns the §5-shaped payload; calling with invalid input throws an `AgentError` with the right code.
3. From a Vitest test that simulates the wrapper composition, the full request/response cycle returns the right JSON for each endpoint, with CORS headers, with the right HTTP status on error.
4. `npm run build` continues to succeed end-to-end (Astro static build + the existing root `api/` files; Vercel will detect and bundle the new `api/v1/*` files at deploy time).
5. Every committed file ≤200 lines (focused responsibilities). Total new code ≤900 lines.

---

## File Structure

**Library (`src/lib/agents-api/`):**

| File | Responsibility | Size budget |
|---|---|---|
| `types.ts` | Public payload types: `IndexPayload`, `SearchPayload`, `FetchPayload`, `GlossaryPayload`, `TopicsPayload`. Derived from §5/§6. | ≤90 lines |
| `cors.ts` | `CORS_HEADERS` const, `withCors(headers)` helper. | ≤25 lines |
| `errors.ts` | `AgentError` class with `code` + `message` + optional `details`; `errorPayload()` builder; HTTP status mapping. | ≤80 lines |
| `index-content.ts` | Builds the llms.txt content as a string. Refactored from [src/pages/llms.txt.ts](../../../src/pages/llms.txt.ts). Used by both the existing page route and the new `read_index` handler. | ≤120 lines |
| `handlers/read-index.ts` | `handleReadIndex(): Promise<IndexPayload>`. Composes llms.txt + AGENTS.md + corpus_summary. | ≤80 lines |
| `handlers/search.ts` | `handleSearch(input): Promise<SearchPayload>`. Validates k/kinds, calls agent-search, packages hits. | ≤90 lines |
| `handlers/fetch.ts` | `handleFetch(input): Promise<FetchPayload>`. Validates URL is on lighthouse domain, fetches it, parses frontmatter, returns markdown + citation. | ≤100 lines |
| `handlers/list-glossary.ts` | `handleListGlossary(input): Promise<GlossaryPayload>`. Reads glossary collection, applies filter, returns terms + citations. | ≤80 lines |
| `handlers/list-topics.ts` | `handleListTopics(): Promise<TopicsPayload>`. Reads topics, returns slug+title+description+counts+citation. | ≤80 lines |
| `index.ts` | Barrel: types, errors, handlers. | ≤25 lines |

**HTTP wrappers (`api/v1/`):**

| File | Responsibility | Size budget |
|---|---|---|
| `_lib/respond.ts` | Helpers shared by the 5 wrappers: parse query, JSON response builder, error catcher. Lives under `api/v1/_lib/` so Vercel doesn't try to deploy it as a route (leading underscore convention). | ≤60 lines |
| `index.ts` | GET `/api/v1/index` → `handleReadIndex`. | ≤30 lines |
| `search.ts` | GET `/api/v1/search?q=&k=&kinds=` → `handleSearch`. | ≤40 lines |
| `fetch.ts` | GET `/api/v1/fetch?url=` → `handleFetch`. | ≤30 lines |
| `glossary.ts` | GET `/api/v1/glossary?filter=` → `handleListGlossary`. | ≤30 lines |
| `topics.ts` | GET `/api/v1/topics` → `handleListTopics`. | ≤30 lines |

**Tests (`tests/agents-api/`):**

| File | Responsibility |
|---|---|
| `errors.test.ts` | AgentError shape, errorPayload formatter, HTTP status mapping |
| `cors.test.ts` | CORS_HEADERS shape |
| `index-content.test.ts` | llms.txt-string builder against fixture corpus |
| `read-index.test.ts` | Composes content + summary correctly |
| `search.test.ts` | Validates input, calls agent-search, packages hits |
| `fetch.test.ts` | Domain validation, frontmatter parsing, error paths |
| `list-glossary.test.ts` | Reads, filters, returns shape |
| `list-topics.test.ts` | Reads, returns shape with counts |
| `respond.test.ts` | Wrapper helpers — request parsing, error envelope, CORS attachment |
| `wrappers.test.ts` | Smoke test of one wrapper end-to-end (mock req/res) to lock the integration shape |

**Existing files modified:**

- [src/pages/llms.txt.ts](../../../src/pages/llms.txt.ts) — refactored to call the new helper. Behavior identical; line count drops ~80 lines.

---

## Conventions for this plan

- **TDD is non-negotiable.** Per @superpowers:test-driven-development, every implementation step is preceded by a failing test step. Implementer must run the test, see it fail, then implement, then re-run.
- **Commit per task.** Match the repo's existing commit style (capitalized imperative subject, no `feat(scope):` prefix).
- **Pure handlers.** Handler functions are pure data-transformers (or async, when they fetch). They throw `AgentError` on bad input or upstream failure. Wrappers catch and convert. No `req`/`res` objects inside `handlers/*`.
- **No new runtime deps.** Use what's already in [package.json](../../../package.json): `gray-matter`, plus Node built-ins.
- **Vercel-native handler shape.** Match existing [api/auth.js](../../../api/auth.js) — `export default function handler(req, res) {}`. Use `req.query.foo` for query params (Vercel parses the query string into an object). Use `res.status(N).json(payload)` for responses.
- **Path aliases:** the project uses `@lib/*` → `src/lib/*` (see [tsconfig.json:13](../../../tsconfig.json)). New code may use `@lib/agents-api/...`; relative imports inside the package are fine.
- **File headers:** every new `.ts` file gets a one-paragraph JSDoc explaining its responsibility.
- **Tests mock `fetch` where handlers fetch the deployed origin.** `vi.mock('node:fetch')` or stubbing global fetch — pick whichever vitest 4 idiom is cleanest, document the choice in the test file header.

---

## Chunk 1: Shared infrastructure (Tasks 1–2)

This chunk delivers types, errors, CORS, and refactors the llms.txt-content generator out of the page route into a reusable helper. Output: a working library that the handlers in Chunk 2 can consume; existing `/llms.txt` route continues to render identically.

### Task 1: Types, errors, CORS

**Files:**
- Create: `src/lib/agents-api/types.ts`
- Create: `src/lib/agents-api/cors.ts`
- Create: `src/lib/agents-api/errors.ts`
- Create: `src/lib/agents-api/index.ts` (barrel)
- Create: `tests/agents-api/types.test.ts`
- Create: `tests/agents-api/cors.test.ts`
- Create: `tests/agents-api/errors.test.ts`

**Context:** The error envelope and CORS shape are common to every endpoint. The types are the public payload contracts the handlers return and the wrappers serialize. Pure data structures + one error class — no logic.

- [ ] **Step 1: Create the directory and barrel.**

```bash
mkdir -p src/lib/agents-api/handlers tests/agents-api
```

Write `src/lib/agents-api/index.ts`:

```typescript
/**
 * Liberty Lighthouse agents-api package.
 *
 * Pure handlers for the public agents API (HTTP + later MCP). Handlers
 * return typed payloads or throw AgentError. The HTTP wrappers in
 * `api/v1/*.ts` adapt them to (req, res) and Phase 3's MCP transport
 * adapts them to JSON-RPC. See docs/agents-api.md §5–§8.
 */
export * from './types.js';
export * from './errors.js';
export { CORS_HEADERS, withCors } from './cors.js';
```

- [ ] **Step 2: Write failing tests for types.**

Write `tests/agents-api/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type { Citation } from '../../src/lib/agent-search';
import type {
  IndexPayload,
  SearchPayload,
  FetchPayload,
  GlossaryPayload,
  TopicsPayload,
} from '../../src/lib/agents-api/types';

describe('agents-api payload types', () => {
  it('IndexPayload shape', () => {
    expectTypeOf<IndexPayload>().toMatchTypeOf<{
      llms_txt: string;
      agents_md: string;
      corpus_summary: {
        topics: number;
        faqs: number;
        videos: number;
        glossary: number;
        wiki: number;
        external: number;
        last_updated: string;
      };
    }>();
  });

  it('SearchPayload shape', () => {
    expectTypeOf<SearchPayload>().toMatchTypeOf<{
      query: string;
      hits: Array<{
        rank: number;
        score: number;
        kind: string;
        title: string;
        snippet: string;
        citation: Citation;
      }>;
    }>();
  });

  it('FetchPayload shape', () => {
    expectTypeOf<FetchPayload>().toMatchTypeOf<{
      markdown: string;
      citation: Citation;
    }>();
  });

  it('GlossaryPayload shape', () => {
    expectTypeOf<GlossaryPayload>().toMatchTypeOf<{
      terms: Array<{
        term: string;
        short_definition: string;
        citation: Citation;
      }>;
    }>();
  });

  it('TopicsPayload shape', () => {
    expectTypeOf<TopicsPayload>().toMatchTypeOf<{
      topics: Array<{
        slug: string;
        title: string;
        description: string;
        counts: { faqs: number; videos: number };
        citation: Citation;
      }>;
    }>();
  });
});
```

- [ ] **Step 3: Implement the types.**

Write `src/lib/agents-api/types.ts`:

```typescript
/**
 * Public payload contracts for the agents API.
 *
 * Each endpoint's handler returns one of these. Wrappers serialize them
 * to JSON. Shapes match docs/agents-api.md §5 (tool surface).
 */
import type { Citation, SearchHit, ContentKind } from '../agent-search/types.js';

export interface CorpusSummary {
  topics: number;
  faqs: number;
  videos: number;
  glossary: number;
  wiki: number;
  external: number;
  last_updated: string;
}

export interface IndexPayload {
  llms_txt: string;
  agents_md: string;
  corpus_summary: CorpusSummary;
}

export interface SearchPayload {
  query: string;
  hits: SearchHit[];
}

export interface FetchPayload {
  markdown: string;
  citation: Citation;
}

export interface GlossaryTerm {
  term: string;
  short_definition: string;
  citation: Citation;
}

export interface GlossaryPayload {
  terms: GlossaryTerm[];
}

export interface TopicListing {
  slug: string;
  title: string;
  description: string;
  counts: {
    faqs: number;
    videos: number;
  };
  citation: Citation;
}

export interface TopicsPayload {
  topics: TopicListing[];
}

/** Inputs to handlers. */
export interface SearchInput {
  query: string;
  k?: number;
  kinds?: ContentKind[];
}

export interface FetchInput {
  url: string;
}

export interface ListGlossaryInput {
  filter?: string;
}
```

- [ ] **Step 4: Run types test (should pass — types resolve).**

```bash
npm test -- tests/agents-api/types.test.ts
```

Expected: PASS — 5 type-shape assertions.

- [ ] **Step 5: Write failing tests for CORS.**

Write `tests/agents-api/cors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CORS_HEADERS, withCors } from '../../src/lib/agents-api/cors';

describe('CORS_HEADERS', () => {
  it('allows any origin', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*');
  });

  it('allows GET and OPTIONS', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('GET');
    expect(CORS_HEADERS['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

describe('withCors', () => {
  it('merges CORS headers with the given object', () => {
    const merged = withCors({ 'content-type': 'application/json' });
    expect(merged['content-type']).toBe('application/json');
    expect(merged['Access-Control-Allow-Origin']).toBe('*');
  });

  it('does not mutate the input', () => {
    const input = { 'x-foo': 'bar' };
    withCors(input);
    expect(Object.keys(input)).toEqual(['x-foo']);
  });
});
```

Run: `npm test -- tests/agents-api/cors.test.ts`. Expect FAIL — module missing.

- [ ] **Step 6: Implement CORS.**

Write `src/lib/agents-api/cors.ts`:

```typescript
/**
 * CORS headers for the public agents API.
 *
 * Anonymous and public per docs/agents-api.md §4 — no auth, any origin.
 * Wrappers in api/v1/*.ts attach these to every response.
 */

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

export function withCors(
  headers: Record<string, string>,
): Record<string, string> {
  return { ...headers, ...CORS_HEADERS };
}
```

- [ ] **Step 7: Run CORS test, verify pass.**

```bash
npm test -- tests/agents-api/cors.test.ts
```

Expected: PASS — 4 cases.

- [ ] **Step 8: Write failing tests for AgentError.**

Write `tests/agents-api/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  AgentError,
  errorPayload,
  errorStatus,
} from '../../src/lib/agents-api/errors';

describe('AgentError', () => {
  it('carries code, message, and optional details', () => {
    const err = new AgentError('BAD_REQUEST', 'q is required');
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('q is required');
    expect(err.details).toBeUndefined();
  });

  it('accepts details', () => {
    const err = new AgentError('VALIDATION_ERROR', 'invalid kind', {
      kind: 'evil',
    });
    expect(err.details).toEqual({ kind: 'evil' });
  });

  it('is an instanceof Error', () => {
    expect(new AgentError('NOT_FOUND', 'gone')).toBeInstanceOf(Error);
  });
});

describe('errorPayload', () => {
  it('returns the §8 shape', () => {
    const err = new AgentError('BAD_REQUEST', 'missing q');
    expect(errorPayload(err)).toEqual({
      error: { code: 'BAD_REQUEST', message: 'missing q' },
    });
  });

  it('includes details when present', () => {
    const err = new AgentError('VALIDATION_ERROR', 'invalid kind', {
      kind: 'evil',
    });
    expect(errorPayload(err)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'invalid kind',
        details: { kind: 'evil' },
      },
    });
  });
});

describe('errorStatus', () => {
  it('maps codes to HTTP statuses', () => {
    expect(errorStatus('BAD_REQUEST')).toBe(400);
    expect(errorStatus('VALIDATION_ERROR')).toBe(400);
    expect(errorStatus('NOT_FOUND')).toBe(404);
    expect(errorStatus('UPSTREAM_ERROR')).toBe(502);
  });
});
```

Run: `npm test -- tests/agents-api/errors.test.ts`. Expect FAIL.

- [ ] **Step 9: Implement errors.**

Write `src/lib/agents-api/errors.ts`:

```typescript
/**
 * Error taxonomy for the agents API.
 *
 * Handlers throw `AgentError`. Wrappers catch, call errorPayload() to
 * build the §8 response envelope, and use errorStatus() to pick the
 * HTTP status code. Unknown errors get UPSTREAM_ERROR/500 — the wrapper
 * is responsible for that mapping (not this module).
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UPSTREAM_ERROR';

export class AgentError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.details = details;
  }
}

export interface ErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorPayload(err: AgentError): ErrorPayload {
  const out: ErrorPayload = {
    error: { code: err.code, message: err.message },
  };
  if (err.details) out.error.details = err.details;
  return out;
}

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UPSTREAM_ERROR: 502,
};

export function errorStatus(code: ErrorCode): number {
  return STATUS[code];
}
```

- [ ] **Step 10: Run errors tests, verify pass.**

```bash
npm test -- tests/agents-api/errors.test.ts
```

Expected: PASS — all 7 cases.

- [ ] **Step 11: Commit.**

```bash
git add src/lib/agents-api/types.ts src/lib/agents-api/cors.ts \
        src/lib/agents-api/errors.ts src/lib/agents-api/index.ts \
        tests/agents-api/types.test.ts tests/agents-api/cors.test.ts \
        tests/agents-api/errors.test.ts
git commit -m "Add agents-api types, errors, and CORS infrastructure"
```

---

### Task 2: Refactor llms.txt content into a reusable builder

**Files:**
- Create: `src/lib/agents-api/index-content.ts`
- Create: `tests/agents-api/index-content.test.ts`
- Modify: `src/pages/llms.txt.ts` (call the new helper)

**Context:** The existing `src/pages/llms.txt.ts` (98 lines) builds the Howard-spec llms.txt content inline. The Phase 2 `read_index` handler needs to return the same content as a string. Mirror the pattern at [src/lib/agents-doc.ts](../../../src/lib/agents-doc.ts) (already used by AGENTS.md.ts): extract a pure `buildLlmsTxt()` function. The page route becomes a one-line wrapper that calls it and returns a `text/plain` response.

The pattern at `agents-doc.ts:buildAgentsDoc()` returns a string; `src/pages/AGENTS.md.ts` is 7 lines:
```typescript
import { markdownResponse } from '../lib/markdown-export';
import { buildAgentsDoc } from '../lib/agents-doc';
export const GET: APIRoute = async () => markdownResponse(buildAgentsDoc());
```

We follow the same shape for llms.txt.

- [ ] **Step 1: Write failing tests for the builder.**

Write `tests/agents-api/index-content.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildLlmsTxt } from '../../src/lib/agents-api/index-content';
import type { CorpusInputs } from '../../src/lib/agents-api/index-content';

const CORPUS: CorpusInputs = {
  topics: [
    {
      data: {
        title: 'Agriculture',
        slug: 'agriculture',
        description: 'Indian farm policy.',
        order: 1,
      },
    },
    {
      data: {
        title: 'Education',
        slug: 'education',
        description: 'Indian school policy.',
        order: 2,
      },
    },
  ],
  spontaneousOrder: [],
  ccsBooks: [],
  wikiCount: 5,
};

describe('buildLlmsTxt', () => {
  it('starts with the Howard-spec H1 + tagline', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).toMatch(/^# Liberty Lighthouse\n/);
    expect(txt).toContain('> A classical liberal resource');
  });

  it('lists topics in `order` order', () => {
    const txt = buildLlmsTxt(CORPUS);
    const agriIdx = txt.indexOf('Agriculture');
    const eduIdx = txt.indexOf('Education');
    expect(agriIdx).toBeGreaterThan(0);
    expect(eduIdx).toBeGreaterThan(agriIdx);
  });

  it('omits the Wiki section when wikiCount is 0', () => {
    const txt = buildLlmsTxt({ ...CORPUS, wikiCount: 0 });
    expect(txt).not.toContain('## Wiki');
  });

  it('includes Wiki section when wikiCount > 0', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).toContain('## Wiki');
    expect(txt).toContain('5 entries');
  });

  it('omits federated section when both external sources empty', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).not.toContain('## Federated external sources');
  });

  it('includes Spontaneous Order when populated', () => {
    const txt = buildLlmsTxt({
      ...CORPUS,
      spontaneousOrder: [{}, {}, {}] as never[],
    });
    expect(txt).toContain('Spontaneous Order index');
    expect(txt).toContain('3 posts');
  });

  it('uses absolute URLs (https://liberty-lighthouse.vercel.app)', () => {
    const txt = buildLlmsTxt(CORPUS);
    expect(txt).toContain('https://liberty-lighthouse.vercel.app/');
  });
});
```

Run: `npm test -- tests/agents-api/index-content.test.ts`. Expect FAIL.

- [ ] **Step 2: Implement the builder.**

Write `src/lib/agents-api/index-content.ts`:

```typescript
/**
 * llms.txt content builder.
 *
 * Pure function that takes corpus shape (counts + topic listings) and
 * returns the Howard-spec llms.txt as a string. Used by both the
 * existing /llms.txt route and the new /api/v1/index handler.
 *
 * Refactored from src/pages/llms.txt.ts. Mirrors the pattern at
 * src/lib/agents-doc.ts:buildAgentsDoc.
 */
import { abs } from '../markdown-export.js';

export interface CorpusInputs {
  topics: ReadonlyArray<{
    data: {
      title: string;
      slug: string;
      description: string;
      order: number;
    };
  }>;
  spontaneousOrder: ReadonlyArray<unknown>;
  ccsBooks: ReadonlyArray<{ data: { book_slug: string } }>;
  /** Count of non-draft wiki entries. */
  wikiCount: number;
}

export function buildLlmsTxt(input: CorpusInputs): string {
  const sortedTopics = [...input.topics].sort(
    (a, b) => a.data.order - b.data.order,
  );

  const lines: string[] = [
    '# Liberty Lighthouse',
    '',
    "> A classical liberal resource for understanding India's policy landscape through curated FAQs, video curricula, glossary terms, and guided syllabi. A project of the Centre for Civil Society.",
    '',
    '## How to use this corpus',
    '',
    `- [Schema and conventions](${abs('/AGENTS.md')}): start here for citation rules, URL conventions, and frontmatter shape.`,
    '- Every public page has a markdown sibling — append `.md` to any URL.',
    "- For a single-file dump of a topic, fetch that topic's `llms-full.txt`.",
    '- Cite by canonical URL (the human-readable HTML page); the `canonical_url` field in any markdown file is the right link.',
    '',
    '## Topics',
    '',
  ];

  for (const topic of sortedTopics) {
    lines.push(
      `- [${topic.data.title}](${abs(`/topics/${topic.data.slug}.md`)}): ${topic.data.description}`,
    );
  }

  lines.push(
    '',
    '## Reference',
    '',
    `- [Glossary](${abs('/glossary.md')}): definitions of policy, economics, and civil-society terms used across the corpus.`,
    `- [Topics index](${abs('/topics.md')}): list of policy domains.`,
    '',
  );

  if (input.wikiCount > 0) {
    lines.push(
      '## Wiki',
      '',
      `- [Wiki index](${abs('/wiki.md')}): auto-generated entity pages, topic summaries, and comparisons (${input.wikiCount} entries).`,
      `- [Wiki — full content](${abs('/wiki/llms-full.txt')}): every wiki entry in a single file.`,
      '',
    );
  }

  if (input.spontaneousOrder.length > 0 || input.ccsBooks.length > 0) {
    lines.push('## Federated external sources', '');
    if (input.spontaneousOrder.length > 0) {
      lines.push(
        `- [Spontaneous Order index](${abs('/external/spontaneous-order.md')}): ${input.spontaneousOrder.length} posts from CCS's Substack.`,
        `- [Spontaneous Order — full content](${abs('/external/spontaneous-order/llms-full.txt')}): every post in one file.`,
      );
    }
    if (input.ccsBooks.length > 0) {
      const bookCount = new Set(input.ccsBooks.map((c) => c.data.book_slug))
        .size;
      lines.push(
        `- [CCS Books index](${abs('/external/ccs-books.md')}): ${bookCount} book${bookCount === 1 ? '' : 's'}, ${input.ccsBooks.length} chapter${input.ccsBooks.length === 1 ? '' : 's'}.`,
        `- [CCS Books — full content](${abs('/external/ccs-books/llms-full.txt')}): every chapter in one file.`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## About',
    '',
    `- [About Liberty Lighthouse](${abs('/about.md')}): mission, formats, and the Centre for Civil Society.`,
    `- [Privacy](${abs('/privacy.md')}): cookies, analytics, and data handling.`,
    '',
    '## Full content (single file)',
    '',
    `- [Complete content dump](${abs('/llms-full.txt')}): all FAQs, videos, glossary, syllabi (and external/wiki content if populated) as a single markdown file. Useful while the corpus fits a context window.`,
  );
  for (const topic of sortedTopics) {
    lines.push(
      `- [${topic.data.title} — full content](${abs(`/topics/${topic.data.slug}/llms-full.txt`)}): ${topic.data.title} FAQs, videos, and syllabus only.`,
    );
  }
  lines.push(
    `- [Glossary — full content](${abs('/glossary/llms-full.txt')}): every glossary entry with definition, body, and citations.`,
    '',
  );

  return lines.join('\n');
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/index-content.test.ts
```

Expected: PASS — all 7 cases.

- [ ] **Step 4: Refactor `src/pages/llms.txt.ts` to use the helper.**

Replace the entire file with:

```typescript
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { plainTextResponse } from '../lib/markdown-export';
import { buildLlmsTxt } from '../lib/agents-api/index-content';

// Howard-spec llms.txt — see https://llmstxt.org/
// Root index for autonomous agents. Each H2 section is a curated link list.
export const GET: APIRoute = async () => {
  const [topics, spontaneousOrder, ccsBooks, wiki] = await Promise.all([
    getCollection('topics'),
    getCollection('spontaneousOrder'),
    getCollection('ccsBooks'),
    getCollection('wiki', ({ data }) => !data.draft),
  ]);
  return plainTextResponse(
    buildLlmsTxt({
      topics,
      spontaneousOrder,
      ccsBooks,
      wikiCount: wiki.length,
    }),
  );
};
```

- [ ] **Step 5: Verify the existing route still produces byte-identical output.**

This is a refactor with no intended behavior change. Capture the pre-refactor output, do the refactor, capture the post-refactor output, diff them.

```bash
# Before applying Step 4 (the refactor), capture baseline:
git stash  # park the helper changes
npm run build
cp dist/llms.txt /tmp/llms.txt.before
git stash pop  # restore helper changes

# After Step 4 (with helper now wired in):
npm run build
diff -q dist/llms.txt /tmp/llms.txt.before
```

Expected: `diff -q` exits 0 (files identical). If diff reports any difference, the refactor introduced a regression — fix before committing.

(If for some reason `git stash` is awkward in your workflow — e.g. you've already applied Step 4 — capture the baseline by checking out the previous llms.txt output from `git show HEAD:src/pages/llms.txt.ts` rendered via `tsx`. Either path works; the goal is byte parity.)

- [ ] **Step 6: Commit.**

```bash
git add src/lib/agents-api/index-content.ts \
        src/pages/llms.txt.ts \
        tests/agents-api/index-content.test.ts
git commit -m "Extract llms.txt content builder for reuse by /api/v1/index"
```

---

## Chunk 2: Pure handlers (Tasks 3–6)

This chunk delivers the five tool handlers as pure functions. Each takes typed input, returns a typed payload, and throws `AgentError` on bad input. No HTTP coupling. Output: a working library that the HTTP wrappers in Chunk 3 (and Phase 3's MCP transport) can consume.

### Task 3: read_index handler

**Files:**
- Create: `src/lib/agents-api/handlers/read-index.ts`
- Create: `tests/agents-api/read-index.test.ts`
- Modify: `src/lib/agents-api/index.ts` (export handler)

**Context:** The `read_index` handler returns the full text of llms.txt + AGENTS.md + a corpus_summary computed from the BM25 index. The first two are computed via the helpers from Task 2 and `agents-doc.ts`. The corpus_summary aggregates counts from `loadIndex()` (Phase 1).

The handler is async because `loadIndex()` is async, and because building llms.txt requires reading the content collections (we'll inject these as dependencies for testability, with a default that uses `astro:content` — but that means the handler can only run inside an Astro/SSR context, which root-`api/v1/` functions are NOT).

**Decision:** the handler reads collections via the `agent-search` package's `readCollections()` (which uses fs+gray-matter, works in plain Node). At call time it passes the resulting `IndexedDoc[]` (already loaded via `loadIndex` for the corpus_summary) into a small adapter that produces the `CorpusInputs` shape `buildLlmsTxt` expects.

But — the agent-search index doesn't preserve enough information to reconstruct `topic` collection entries with `order` and `description` fields. The index only stores `id`, `kind`, `title`, `tf`, `length`, `text`, `citation`. We need topic descriptions and orders for llms.txt.

**Resolution:** the handler reads topics directly via fs+gray-matter (a small ad-hoc loader, ~25 lines, mirroring the pattern in [astro.config.mjs:23-43](../../../astro.config.mjs)). For wiki/spontaneousOrder/ccsBooks counts, it uses the `loadIndex()` result. This keeps the handler self-contained and pure-Node.

- [ ] **Step 1: Write failing tests.**

Write `tests/agents-api/read-index.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { handleReadIndex } from '../../src/lib/agents-api/handlers/read-index';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(
  __dirname,
  '../agent-search/fixtures/content',
);

describe('handleReadIndex', () => {
  beforeAll(() => {
    const idx = buildIndex({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    _setIndexForTesting(idx);
  });

  it('returns llms_txt, agents_md, and corpus_summary', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(typeof payload.llms_txt).toBe('string');
    expect(typeof payload.agents_md).toBe('string');
    expect(payload.corpus_summary).toBeDefined();
  });

  it('llms_txt starts with H1', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(payload.llms_txt).toMatch(/^# Liberty Lighthouse\n/);
  });

  it('agents_md is non-empty markdown', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(payload.agents_md.length).toBeGreaterThan(100);
  });

  it('corpus_summary counts match the fixture corpus', async () => {
    const payload = await handleReadIndex({ contentDir: FIXTURES });
    expect(payload.corpus_summary.topics).toBeGreaterThan(0);
    expect(payload.corpus_summary.glossary).toBeGreaterThan(0);
    expect(payload.corpus_summary.faqs).toBeGreaterThanOrEqual(1);
    expect(payload.corpus_summary.videos).toBeGreaterThanOrEqual(1);
    expect(typeof payload.corpus_summary.last_updated).toBe('string');
  });
});
```

Run: `npm test -- tests/agents-api/read-index.test.ts`. Expect FAIL.

- [ ] **Step 2: Implement the handler.**

Write `src/lib/agents-api/handlers/read-index.ts`:

```typescript
/**
 * read_index handler.
 *
 * Returns the full text of /llms.txt + /AGENTS.md + a corpus_summary
 * derived from the BM25 index. Pure-Node — reads topics directly from
 * disk (mirrors astro.config.mjs:23-43), uses loadIndex() for counts.
 *
 * See docs/agents-api.md §5.1.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { loadIndex } from '../../agent-search/load-index.js';
import { buildAgentsDoc } from '../../agents-doc.js';
import { buildLlmsTxt, type CorpusInputs } from '../index-content.js';
import type { IndexPayload, CorpusSummary } from '../types.js';

// Anchored to this file's location, NOT process.cwd() — Vercel functions
// have cwd = /var/task and src/content/ is bundled relative to the
// function's source location via vercel.json includeFiles.
// handlers/ → agents-api/ → lib/ → src/ → content/.
const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

interface HandleOpts {
  /** Override for tests. Defaults to the bundled src/content/ tree. */
  contentDir?: string;
}

function readTopicsFromDisk(contentDir: string): CorpusInputs['topics'] {
  const dir = join(contentDir, 'topics');
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((f) => {
    const raw = readFileSync(join(dir, f), 'utf8');
    const data = JSON.parse(raw) as {
      title: string;
      slug: string;
      description: string;
      order: number;
    };
    return { data };
  });
}

export async function handleReadIndex(
  opts: HandleOpts = {},
): Promise<IndexPayload> {
  const contentDir = opts.contentDir ?? DEFAULT_CONTENT_DIR;
  const idx = await loadIndex();

  // Counts by kind from the BM25 index.
  const counts: Record<string, number> = {};
  for (const doc of idx.docs) {
    counts[doc.kind] = (counts[doc.kind] ?? 0) + 1;
  }

  // We need topic listings (with description+order) for buildLlmsTxt.
  // The BM25 index doesn't preserve these fields, so read from disk.
  const topics = readTopicsFromDisk(contentDir);

  // For the `external` count split: we don't differentiate spontaneous-order
  // vs ccs-books in the kind label. Approximate by inspecting doc ids.
  const spontaneousOrderDocs = idx.docs.filter((d) =>
    d.id.startsWith('external/spontaneous-order/'),
  );
  const ccsBookDocs = idx.docs.filter((d) =>
    d.id.startsWith('external/ccs-books/'),
  );
  // Build minimal shape for buildLlmsTxt — it only inspects .data.book_slug.
  const ccsBooksInput = ccsBookDocs.map((d) => {
    const bookSlug = d.id.split('/')[2] ?? 'unknown';
    return { data: { book_slug: bookSlug } };
  });

  const llms_txt = buildLlmsTxt({
    topics,
    spontaneousOrder: spontaneousOrderDocs,
    ccsBooks: ccsBooksInput,
    wikiCount: counts.wiki ?? 0,
  });
  const agents_md = buildAgentsDoc();

  const corpus_summary: CorpusSummary = {
    topics: counts.topic ?? 0,
    faqs: counts.faq ?? 0,
    videos: counts.video ?? 0,
    glossary: counts.glossary ?? 0,
    wiki: counts.wiki ?? 0,
    external: counts.external ?? 0,
    last_updated: idx.meta.built_at.slice(0, 10),
  };

  return { llms_txt, agents_md, corpus_summary };
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/read-index.test.ts
```

Expected: PASS — all 4 cases.

- [ ] **Step 4: Update barrel.**

Edit `src/lib/agents-api/index.ts` to add:

```typescript
export { handleReadIndex } from './handlers/read-index.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agents-api/handlers/read-index.ts \
        src/lib/agents-api/index.ts \
        tests/agents-api/read-index.test.ts
git commit -m "Add read_index handler returning llms.txt + AGENTS.md + corpus summary"
```

---

### Task 4: search handler

**Files:**
- Create: `src/lib/agents-api/handlers/search.ts`
- Create: `tests/agents-api/search.test.ts`
- Modify: `src/lib/agents-api/index.ts`

**Context:** The handler validates input (q non-empty, k integer 1–25, kinds against `VALID_KINDS`), calls `agent-search.search()`, and packages hits into `SearchPayload`. `agent-search`'s own `assertValidKinds` already throws on invalid kinds — we wrap that throw into `AgentError('VALIDATION_ERROR', ...)`.

- [ ] **Step 1: Write failing tests.**

Write `tests/agents-api/search.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { handleSearch } from '../../src/lib/agents-api/handlers/search';
import { AgentError } from '../../src/lib/agents-api/errors';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('handleSearch', () => {
  beforeAll(() => {
    const idx = buildIndex({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    _setIndexForTesting(idx);
  });

  it('returns SearchPayload with query and hits', async () => {
    const payload = await handleSearch({ query: 'MSP' });
    expect(payload.query).toBe('MSP');
    expect(Array.isArray(payload.hits)).toBe(true);
    expect(payload.hits.length).toBeGreaterThan(0);
  });

  it('top hit is glossary for "MSP"', async () => {
    const payload = await handleSearch({ query: 'MSP' });
    expect(payload.hits[0].kind).toBe('glossary');
    expect(payload.hits[0].citation.canonical_url).toContain('/glossary/msp/');
  });

  it('respects k', async () => {
    const payload = await handleSearch({ query: 'msp', k: 1 });
    expect(payload.hits.length).toBe(1);
  });

  it('throws BAD_REQUEST on empty query', async () => {
    await expect(handleSearch({ query: '' })).rejects.toThrowError(AgentError);
    try {
      await handleSearch({ query: '' });
    } catch (err) {
      expect((err as AgentError).code).toBe('BAD_REQUEST');
    }
  });

  it('throws BAD_REQUEST on whitespace-only query', async () => {
    await expect(handleSearch({ query: '   ' })).rejects.toThrowError(
      AgentError,
    );
  });

  it('throws VALIDATION_ERROR on invalid kind', async () => {
    await expect(
      handleSearch({ query: 'msp', kinds: ['evil-kind' as never] }),
    ).rejects.toThrowError(AgentError);
    try {
      await handleSearch({ query: 'msp', kinds: ['evil-kind' as never] });
    } catch (err) {
      expect((err as AgentError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('clamps k to 25 max', async () => {
    const payload = await handleSearch({ query: 'msp', k: 100 });
    expect(payload.hits.length).toBeLessThanOrEqual(25);
  });

  it('throws BAD_REQUEST when k is not a positive integer', async () => {
    await expect(
      handleSearch({ query: 'msp', k: -1 }),
    ).rejects.toThrowError(AgentError);
    await expect(
      handleSearch({ query: 'msp', k: 1.5 }),
    ).rejects.toThrowError(AgentError);
  });
});
```

Run: `npm test -- tests/agents-api/search.test.ts`. Expect FAIL.

- [ ] **Step 2: Implement.**

Write `src/lib/agents-api/handlers/search.ts`:

```typescript
/**
 * search handler.
 *
 * Validates inputs, calls agent-search.search(), packages hits into a
 * SearchPayload. Throws AgentError on bad inputs.
 *
 * See docs/agents-api.md §5.2.
 */
import { search } from '../../agent-search/search.js';
import { AgentError } from '../errors.js';
import type { SearchInput, SearchPayload } from '../types.js';

const MAX_K = 25;

export async function handleSearch(
  input: SearchInput,
): Promise<SearchPayload> {
  const query = (input.query ?? '').trim();
  if (!query) {
    throw new AgentError('BAD_REQUEST', 'query parameter "q" is required');
  }

  if (input.k !== undefined) {
    if (!Number.isInteger(input.k) || input.k < 1) {
      throw new AgentError(
        'BAD_REQUEST',
        '"k" must be a positive integer',
        { k: input.k },
      );
    }
  }

  let hits;
  try {
    hits = await search(query, {
      k: input.k !== undefined ? Math.min(MAX_K, input.k) : undefined,
      kinds: input.kinds,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('invalid kind')) {
      throw new AgentError(
        'VALIDATION_ERROR',
        err.message,
        input.kinds ? { kinds: input.kinds } : undefined,
      );
    }
    throw err;
  }

  return { query, hits };
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/search.test.ts
```

Expected: PASS — all 8 cases.

- [ ] **Step 4: Update barrel.**

Add to `src/lib/agents-api/index.ts`:

```typescript
export { handleSearch } from './handlers/search.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agents-api/handlers/search.ts \
        src/lib/agents-api/index.ts \
        tests/agents-api/search.test.ts
git commit -m "Add search handler with input validation"
```

---

### Task 5: fetch handler

**Files:**
- Create: `src/lib/agents-api/handlers/fetch.ts`
- Create: `tests/agents-api/fetch.test.ts`
- Modify: `src/lib/agents-api/index.ts`

**Context:** The handler validates the URL is on the lighthouse domain (or localhost for dev), fetches the markdown via `globalThis.fetch`, parses the frontmatter to build a citation block, and returns `{markdown, citation}`. Mirrors the pattern in [mcp/server.ts:get_page](../../../mcp/server.ts).

The base URL is configurable via `LIGHTHOUSE_BASE_URL` env var (default: `https://liberty-lighthouse.vercel.app`). For tests, we stub `globalThis.fetch`.

- [ ] **Step 1: Write failing tests.**

Write `tests/agents-api/fetch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFetch } from '../../src/lib/agents-api/handlers/fetch';
import { AgentError } from '../../src/lib/agents-api/errors';

const SAMPLE_MD = `---
title: "MSP definition"
canonical_url: "https://liberty-lighthouse.vercel.app/glossary/msp/"
markdown_url: "https://liberty-lighthouse.vercel.app/glossary/msp.md"
last_modified: "2026-04-12"
---

# Minimum Support Price

The floor price...`;

describe('handleFetch', () => {
  beforeEach(() => {
    // vi.stubGlobal is the vitest 4 idiom for replacing global functions.
    // It survives non-configurable properties (which spyOn does not handle
    // reliably in happy-dom).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(SAMPLE_MD, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns markdown + citation for an on-site URL', async () => {
    const payload = await handleFetch({
      url: 'https://liberty-lighthouse.vercel.app/glossary/msp.md',
    });
    expect(payload.markdown).toBe(SAMPLE_MD);
    expect(payload.citation.canonical_url).toBe(
      'https://liberty-lighthouse.vercel.app/glossary/msp/',
    );
    expect(payload.citation.title).toBe('MSP definition');
    expect(payload.citation.last_modified).toBe('2026-04-12');
  });

  it('throws BAD_REQUEST on missing url', async () => {
    await expect(handleFetch({ url: '' })).rejects.toThrowError(AgentError);
  });

  it('throws BAD_REQUEST on off-site URL', async () => {
    await expect(
      handleFetch({ url: 'https://malicious.example.com/foo.md' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws NOT_FOUND when upstream returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 })),
    );
    await expect(
      handleFetch({ url: 'https://liberty-lighthouse.vercel.app/missing.md' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws UPSTREAM_ERROR on 5xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    await expect(
      handleFetch({ url: 'https://liberty-lighthouse.vercel.app/glossary/msp.md' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('throws UPSTREAM_ERROR if frontmatter is missing canonical_url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no frontmatter at all', { status: 200 })),
    );
    await expect(
      handleFetch({ url: 'https://liberty-lighthouse.vercel.app/glossary/msp.md' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('accepts localhost URLs (for dev)', async () => {
    const payload = await handleFetch({
      url: 'http://localhost:3219/glossary/msp.md',
    });
    expect(payload.markdown).toBe(SAMPLE_MD);
  });
});
```

Run: `npm test -- tests/agents-api/fetch.test.ts`. Expect FAIL.

- [ ] **Step 2: Implement.**

Write `src/lib/agents-api/handlers/fetch.ts`:

```typescript
/**
 * fetch handler.
 *
 * Fetches the markdown for any URL on the lighthouse domain (or localhost
 * in dev), parses frontmatter into a citation block, returns
 * {markdown, citation}. Refuses off-site URLs.
 *
 * See docs/agents-api.md §5.3. Mirrors mcp/server.ts:get_page.
 */
import matter from 'gray-matter';
import { AgentError } from '../errors.js';
import type { FetchInput, FetchPayload } from '../types.js';
import type { Citation, ContentKind } from '../../agent-search/types.js';

const DEFAULT_BASE = 'https://liberty-lighthouse.vercel.app';

function getBaseHostname(): string {
  const base = process.env.LIGHTHOUSE_BASE_URL ?? DEFAULT_BASE;
  return new URL(base).hostname;
}

function isOnSite(url: string): boolean {
  try {
    const u = new URL(url);
    const allowed = new Set([
      getBaseHostname(),
      'localhost',
      '127.0.0.1',
    ]);
    return allowed.has(u.hostname);
  } catch {
    return false;
  }
}

function citationFromFrontmatter(data: Record<string, unknown>): Citation {
  const canonical_url = data.canonical_url as string | undefined;
  const markdown_url = data.markdown_url as string | undefined;
  const title = data.title as string | undefined;
  if (!canonical_url || !markdown_url || !title) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      'fetched markdown missing required frontmatter (canonical_url/markdown_url/title)',
    );
  }
  // Type guess: try to infer kind from URL shape.
  const kind: ContentKind = inferKind(canonical_url);
  const last_modified =
    (data.last_modified as string | undefined) ??
    (data.updatedAt as string | undefined) ??
    (data.published_at as string | undefined) ??
    new Date().toISOString().slice(0, 10);
  return { canonical_url, markdown_url, title, kind, last_modified };
}

function inferKind(url: string): ContentKind {
  if (url.includes('/glossary/')) return 'glossary';
  if (url.includes('/wiki/')) return 'wiki';
  if (url.includes('/external/')) return 'external';
  if (url.includes('/faq/')) return 'faq';
  if (url.includes('/videos/')) return 'video';
  if (url.includes('/topics/')) return 'topic';
  return 'topic';
}

export async function handleFetch(input: FetchInput): Promise<FetchPayload> {
  const url = (input.url ?? '').trim();
  if (!url) {
    throw new AgentError('BAD_REQUEST', 'query parameter "url" is required');
  }
  if (!isOnSite(url)) {
    throw new AgentError(
      'BAD_REQUEST',
      'url must be on the Liberty Lighthouse domain',
      { url },
    );
  }

  let res: Response;
  try {
    res = await globalThis.fetch(url, {
      headers: { 'User-Agent': 'liberty-lighthouse-api/0.1.0' },
    });
  } catch (err) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      `fetch failed: ${(err as Error).message}`,
    );
  }
  if (res.status === 404) {
    throw new AgentError('NOT_FOUND', `upstream 404: ${url}`);
  }
  if (!res.ok) {
    throw new AgentError(
      'UPSTREAM_ERROR',
      `upstream ${res.status}: ${res.statusText}`,
    );
  }
  const markdown = await res.text();
  const { data } = matter(markdown);
  const citation = citationFromFrontmatter(
    data as Record<string, unknown>,
  );
  return { markdown, citation };
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/fetch.test.ts
```

Expected: PASS — 7 cases.

- [ ] **Step 4: Update barrel.**

Add to `src/lib/agents-api/index.ts`:

```typescript
export { handleFetch } from './handlers/fetch.js';
```

- [ ] **Step 5: Commit.**

```bash
git add src/lib/agents-api/handlers/fetch.ts \
        src/lib/agents-api/index.ts \
        tests/agents-api/fetch.test.ts
git commit -m "Add fetch handler with domain validation and frontmatter parsing"
```

---

### Task 6: list_glossary + list_topics handlers

**Files:**
- Create: `src/lib/agents-api/handlers/list-glossary.ts`
- Create: `src/lib/agents-api/handlers/list-topics.ts`
- Create: `tests/agents-api/list-glossary.test.ts`
- Create: `tests/agents-api/list-topics.test.ts`
- Modify: `src/lib/agents-api/index.ts`

**Context:** Two thin enumeration handlers. They read directly from disk via gray-matter (mirroring `read-collections.ts`). Both pure-Node. Listed under one task because each is small (~60 lines).

- [ ] **Step 1: Write failing tests for list_glossary.**

Write `tests/agents-api/list-glossary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleListGlossary } from '../../src/lib/agents-api/handlers/list-glossary';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('handleListGlossary', () => {
  it('returns all non-draft terms when no filter', async () => {
    const payload = await handleListGlossary(
      {},
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    const terms = payload.terms.map((t) => t.term);
    expect(terms).toContain('Minimum Support Price (MSP)');
    expect(terms).toContain('Voucher System');
    expect(terms.find((t) => t.toLowerCase().includes('draft'))).toBeUndefined();
  });

  it('filters by case-insensitive substring on term', async () => {
    const payload = await handleListGlossary(
      { filter: 'msp' },
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    expect(payload.terms.length).toBe(1);
    expect(payload.terms[0].term).toContain('MSP');
  });

  it('filters by case-insensitive substring on definition', async () => {
    const payload = await handleListGlossary(
      { filter: 'parents' },
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    // "Voucher System" definition mentions "parents"
    expect(payload.terms.length).toBe(1);
    expect(payload.terms[0].term).toContain('Voucher');
  });

  it('builds citation with canonical_url', async () => {
    const payload = await handleListGlossary(
      {},
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    const msp = payload.terms.find((t) => t.term.includes('MSP'))!;
    expect(msp.citation.canonical_url).toBe(
      'https://example.com/glossary/msp/',
    );
    expect(msp.citation.kind).toBe('glossary');
  });

  it('returns empty array when filter matches nothing', async () => {
    const payload = await handleListGlossary(
      { filter: 'xyzzynonsense' },
      { contentDir: FIXTURES, siteUrl: 'https://example.com' },
    );
    expect(payload.terms).toEqual([]);
  });
});
```

Run: `npm test -- tests/agents-api/list-glossary.test.ts`. Expect FAIL.

- [ ] **Step 2: Implement list_glossary.**

Write `src/lib/agents-api/handlers/list-glossary.ts`:

```typescript
/**
 * list_glossary handler.
 *
 * Reads the glossary collection from disk, applies an optional
 * substring filter (case-insensitive, against term and definition),
 * returns terms + citations.
 *
 * See docs/agents-api.md §5.4.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import type {
  GlossaryPayload,
  GlossaryTerm,
  ListGlossaryInput,
} from '../types.js';
import type { Citation } from '../../agent-search/types.js';

const DEFAULT_SITE = 'https://liberty-lighthouse.vercel.app';
// Anchored to this file's location — see read-index.ts for rationale.
const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

interface HandleOpts {
  contentDir?: string;
  siteUrl?: string;
}

export async function handleListGlossary(
  input: ListGlossaryInput,
  opts: HandleOpts = {},
): Promise<GlossaryPayload> {
  const contentDir = opts.contentDir ?? DEFAULT_CONTENT_DIR;
  const siteUrl = (opts.siteUrl ?? DEFAULT_SITE).replace(/\/$/, '');
  const dir = join(contentDir, 'glossary');

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));
  } catch {
    return { terms: [] };
  }

  const filter = input.filter?.trim().toLowerCase();
  const terms: GlossaryTerm[] = [];

  for (const f of files) {
    const slug = f.replace(/\.mdx?$/, '');
    const raw = readFileSync(join(dir, f), 'utf8');
    const { data } = matter(raw);
    const d = data as Record<string, unknown>;
    if (d.draft) continue;
    const term = (d.term as string) ?? slug;
    const definition = (d.definition as string) ?? '';
    if (filter) {
      const haystack = `${term} ${definition}`.toLowerCase();
      if (!haystack.includes(filter)) continue;
    }
    const citation: Citation = {
      canonical_url: `${siteUrl}/glossary/${slug}/`,
      markdown_url: `${siteUrl}/glossary/${slug}.md`,
      title: term,
      kind: 'glossary',
      last_modified:
        (d.updatedAt as string) ??
        new Date().toISOString().slice(0, 10),
    };
    terms.push({ term, short_definition: definition, citation });
  }

  return { terms };
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/list-glossary.test.ts
```

Expected: PASS — 5 cases.

- [ ] **Step 4: Write failing tests for list_topics.**

Write `tests/agents-api/list-topics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleListTopics } from '../../src/lib/agents-api/handlers/list-topics';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('handleListTopics', () => {
  it('returns topics in `order` order', async () => {
    const payload = await handleListTopics({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    expect(payload.topics.length).toBe(2);
    expect(payload.topics[0].slug).toBe('agriculture');
    expect(payload.topics[1].slug).toBe('education');
  });

  it('builds citation with canonical_url', async () => {
    const payload = await handleListTopics({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    expect(payload.topics[0].citation.canonical_url).toBe(
      'https://example.com/topics/agriculture/',
    );
    expect(payload.topics[0].citation.kind).toBe('topic');
  });

  it('counts faqs and videos for each topic', async () => {
    const payload = await handleListTopics({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    const agri = payload.topics.find((t) => t.slug === 'agriculture')!;
    // Fixture has 1 faq and 1 video under agriculture, 0 of each under education
    // (the draft-faq under education is excluded).
    expect(agri.counts.faqs).toBe(1);
    expect(agri.counts.videos).toBe(1);
  });
});
```

Run: `npm test -- tests/agents-api/list-topics.test.ts`. Expect FAIL.

- [ ] **Step 5: Implement list_topics.**

Write `src/lib/agents-api/handlers/list-topics.ts`:

```typescript
/**
 * list_topics handler.
 *
 * Reads the topics collection from disk, returns slug+title+description
 * +counts (FAQ + video for each topic) + citation. Counts come from
 * counting non-draft files in faqs/<slug>/ and videos/<slug>/.
 *
 * See docs/agents-api.md §5.5.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import type { TopicsPayload, TopicListing } from '../types.js';
import type { Citation } from '../../agent-search/types.js';

const DEFAULT_SITE = 'https://liberty-lighthouse.vercel.app';
const DEFAULT_CONTENT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content',
);

interface HandleOpts {
  contentDir?: string;
  siteUrl?: string;
}

function countNonDraft(dir: string): number {
  let n = 0;
  try {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const s = statSync(p);
      if (s.isFile() && /\.mdx?$/.test(f)) {
        const { data } = matter(readFileSync(p, 'utf8'));
        if (!(data as Record<string, unknown>).draft) n++;
      }
    }
  } catch {
    // missing dir = 0
  }
  return n;
}

interface TopicFile {
  title: string;
  slug: string;
  description: string;
  order: number;
}

export async function handleListTopics(
  opts: HandleOpts = {},
): Promise<TopicsPayload> {
  const contentDir = opts.contentDir ?? DEFAULT_CONTENT_DIR;
  const siteUrl = (opts.siteUrl ?? DEFAULT_SITE).replace(/\/$/, '');
  const dir = join(contentDir, 'topics');

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return { topics: [] };
  }

  // Read once, capture the order field, sort, then map to public shape.
  const parsed: TopicFile[] = files.map((f) => {
    const raw = readFileSync(join(dir, f), 'utf8');
    return JSON.parse(raw) as TopicFile;
  });
  parsed.sort((a, b) => a.order - b.order);

  return {
    topics: parsed.map((data) => ({
      slug: data.slug,
      title: data.title,
      description: data.description,
      counts: {
        faqs: countNonDraft(join(contentDir, 'faqs', data.slug)),
        videos: countNonDraft(join(contentDir, 'videos', data.slug)),
      },
      citation: {
        canonical_url: `${siteUrl}/topics/${data.slug}/`,
        markdown_url: `${siteUrl}/topics/${data.slug}.md`,
        title: data.title,
        kind: 'topic',
        last_modified: new Date().toISOString().slice(0, 10),
      },
    })),
  };
}
```

- [ ] **Step 6: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/list-topics.test.ts
```

Expected: PASS — 3 cases.

- [ ] **Step 7: Update barrel.**

Add to `src/lib/agents-api/index.ts`:

```typescript
export { handleListGlossary } from './handlers/list-glossary.js';
export { handleListTopics } from './handlers/list-topics.js';
```

- [ ] **Step 8: Commit.**

```bash
git add src/lib/agents-api/handlers/list-glossary.ts \
        src/lib/agents-api/handlers/list-topics.ts \
        src/lib/agents-api/index.ts \
        tests/agents-api/list-glossary.test.ts \
        tests/agents-api/list-topics.test.ts
git commit -m "Add list_glossary and list_topics handlers"
```

---

## Chunk 3: HTTP wrappers and verification (Tasks 7–8)

This chunk wires the handlers into Vercel-native serverless functions at root `api/v1/*.ts`. Each wrapper parses the query string, calls the handler, attaches CORS, formats the response (success or error envelope). Output: `npm run build` produces a working build that Vercel will deploy with the new endpoints live.

### Task 7: HTTP wrappers + shared response helpers

**Files:**
- Create: `api/v1/_lib/respond.ts`
- Create: `api/v1/index.ts`
- Create: `api/v1/search.ts`
- Create: `api/v1/fetch.ts`
- Create: `api/v1/glossary.ts`
- Create: `api/v1/topics.ts`
- Create: `tests/agents-api/respond.test.ts`
- Create: `tests/agents-api/wrappers.test.ts`

**Context:** Vercel auto-detects files under `api/` at the repo root and deploys them as Node serverless functions. The handler shape is `export default function handler(req, res) {}` — Express-like, matching the existing [api/auth.js](../../../api/auth.js). The leading underscore on `_lib/` keeps Vercel from trying to deploy it as a route.

Each wrapper is ~20 lines: parse query, call handler, format response. The shared `respond.ts` provides `respond(res, payload)` for success, `respondError(res, err)` for `AgentError`, and `respondUnknown(res, err)` for catch-all 500.

Tests for the shared helpers + one smoke test of a wrapper end-to-end (using a mock req/res) lock the integration shape.

- [ ] **Step 1: Write failing tests for respond helpers.**

Write `tests/agents-api/respond.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
  respondJson,
  respondError,
  respondUnknown,
} from '../../api/v1/_lib/respond';
import { AgentError } from '../../src/lib/agents-api/errors';

function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown = null;
  return {
    status(s: number) {
      statusCode = s;
      return this;
    },
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    json(payload: unknown) {
      body = payload;
    },
    end() {
      /* no-op */
    },
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

describe('respondJson', () => {
  it('writes 200 + CORS + JSON', () => {
    const res = makeRes();
    respondJson(res as never, { ok: true });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.body).toEqual({ ok: true });
  });
});

describe('respondError', () => {
  it('writes mapped status + envelope for AgentError', () => {
    const res = makeRes();
    respondError(res as never, new AgentError('NOT_FOUND', 'gone'));
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'gone' },
    });
  });
});

describe('respondUnknown', () => {
  it('writes 500 + UPSTREAM_ERROR envelope for non-AgentError', () => {
    const res = makeRes();
    respondUnknown(res as never, new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: { code: 'UPSTREAM_ERROR' },
    });
  });
});
```

Run: `npm test -- tests/agents-api/respond.test.ts`. Expect FAIL.

- [ ] **Step 2: Implement respond.ts.**

```bash
mkdir -p api/v1/_lib
```

Write `api/v1/_lib/respond.ts`:

```typescript
/**
 * Shared response helpers + minimal Vercel request/response types for
 * /api/v1/* wrappers.
 *
 * Vercel-native serverless functions use Express-like (req, res). These
 * helpers attach CORS, set status codes, and format the §8 error envelope.
 *
 * `VercelReq` and `VercelRes` are minimal local interfaces — we don't
 * import from `@vercel/node` to avoid pulling in a devDependency for
 * type-only use.
 */
import {
  AgentError,
  errorPayload,
  errorStatus,
} from '../../../src/lib/agents-api/errors.js';
import { CORS_HEADERS } from '../../../src/lib/agents-api/cors.js';

/** Minimal Vercel Node request shape. */
export interface VercelReq {
  /** Query parameters; Vercel may yield string[] for repeated keys. */
  query: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
}

/** Minimal Vercel Node response shape. */
export interface VercelRes {
  status(code: number): VercelRes;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

/**
 * Narrow a Vercel query value to a single string. Returns undefined for
 * missing values, throws BAD_REQUEST for unexpected duplicates.
 */
export function singleString(
  query: VercelReq['query'],
  key: string,
): string | undefined {
  const v = query[key];
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 1) return v[0];
  throw new AgentError(
    'BAD_REQUEST',
    `query parameter "${key}" must be a single value`,
    { key, received: v },
  );
}

function attachCors(res: VercelRes): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
  res.setHeader('content-type', 'application/json; charset=utf-8');
}

export function respondJson(res: VercelRes, payload: unknown): void {
  attachCors(res);
  res.status(200).json(payload);
}

export function respondError(res: VercelRes, err: AgentError): void {
  attachCors(res);
  res.status(errorStatus(err.code)).json(errorPayload(err));
}

export function respondUnknown(res: VercelRes, err: unknown): void {
  attachCors(res);
  const wrapped = new AgentError(
    'UPSTREAM_ERROR',
    err instanceof Error ? err.message : 'unknown error',
  );
  // Force status 500 instead of 502 for truly unexpected errors.
  res.status(500).json(errorPayload(wrapped));
}
```

- [ ] **Step 3: Run tests, verify pass.**

```bash
npm test -- tests/agents-api/respond.test.ts
```

Expected: PASS — 3 cases.

- [ ] **Step 4: Implement the 5 wrappers.**

Write `api/v1/index.ts`:

```typescript
/**
 * GET /api/v1/index — read_index endpoint.
 * See docs/agents-api.md §5.1 and §7.
 */
import { handleReadIndex } from '../../src/lib/agents-api/handlers/read-index.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  _req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const payload = await handleReadIndex();
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
```

Write `api/v1/search.ts`:

```typescript
/**
 * GET /api/v1/search?q=...&k=10&kinds=faq,glossary — search endpoint.
 */
import { handleSearch } from '../../src/lib/agents-api/handlers/search.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import type { ContentKind } from '../../src/lib/agent-search/types.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  singleString,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const q = singleString(req.query, 'q') ?? '';
    const kRaw = singleString(req.query, 'k');
    const k = kRaw !== undefined ? Number(kRaw) : undefined;
    if (kRaw !== undefined && Number.isNaN(k)) {
      throw new AgentError('BAD_REQUEST', '"k" must be a number', { k: kRaw });
    }
    const kindsRaw = singleString(req.query, 'kinds');
    const kinds = kindsRaw
      ? (kindsRaw.split(',').map((s) => s.trim()).filter(Boolean) as ContentKind[])
      : undefined;
    const payload = await handleSearch({ query: q, k, kinds });
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
```

Write `api/v1/fetch.ts`:

```typescript
/**
 * GET /api/v1/fetch?url=... — fetch endpoint.
 */
import { handleFetch } from '../../src/lib/agents-api/handlers/fetch.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  singleString,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const payload = await handleFetch({
      url: singleString(req.query, 'url') ?? '',
    });
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
```

Write `api/v1/glossary.ts`:

```typescript
/**
 * GET /api/v1/glossary?filter=... — list_glossary endpoint.
 */
import { handleListGlossary } from '../../src/lib/agents-api/handlers/list-glossary.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  singleString,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const payload = await handleListGlossary({
      filter: singleString(req.query, 'filter'),
    });
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
```

Write `api/v1/topics.ts`:

```typescript
/**
 * GET /api/v1/topics — list_topics endpoint.
 */
import { handleListTopics } from '../../src/lib/agents-api/handlers/list-topics.js';
import { AgentError } from '../../src/lib/agents-api/errors.js';
import {
  respondJson,
  respondError,
  respondUnknown,
  type VercelReq,
  type VercelRes,
} from './_lib/respond.js';

export default async function handler(
  _req: VercelReq,
  res: VercelRes,
): Promise<void> {
  try {
    const payload = await handleListTopics();
    respondJson(res, payload);
  } catch (err) {
    if (err instanceof AgentError) respondError(res, err);
    else respondUnknown(res, err);
  }
}
```

- [ ] **Step 5: Write a smoke test of one wrapper end-to-end.**

Write `tests/agents-api/wrappers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import topicsHandler from '../../api/v1/topics';
import type { VercelReq, VercelRes } from '../../api/v1/_lib/respond';

function makeRes(): VercelRes & { _state: { status: number; headers: Record<string, string>; body: unknown } } {
  const state = { status: 200, headers: {} as Record<string, string>, body: null as unknown };
  const res: VercelRes & typeof state = {
    _state: state,
    status(code: number) {
      state.status = code;
      return this;
    },
    setHeader(k: string, v: string) {
      state.headers[k] = v;
    },
    json(payload: unknown) {
      state.body = payload;
    },
    end() {
      /* no-op */
    },
  } as never;
  return res;
}

describe('api/v1/topics wrapper (integration shape)', () => {
  it('returns 200 + topics payload + CORS headers against real src/content/', async () => {
    // Smoke test. Runs against the real src/content/ tree (no fixture
    // injection — the wrapper doesn't expose contentDir, by design).
    // Per-handler coverage of list-topics with fixtures lives in
    // tests/agents-api/list-topics.test.ts. This test only locks the
    // HTTP wiring: CORS attachment, status code, JSON shape.
    const req: VercelReq = { query: {} };
    const res = makeRes();
    await topicsHandler(req, res);
    expect(res._state.status).toBe(200);
    expect(res._state.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res._state.headers['content-type']).toContain('application/json');
    const body = res._state.body as { topics: unknown[] };
    expect(Array.isArray(body.topics)).toBe(true);
  });
});
```

> **Note for the implementer:** the smoke test runs against the real `src/content/` because the wrapper doesn't accept a content-dir override (deliberate — production wrappers shouldn't expose test seams). The fixture-based coverage of `handleListTopics` lives in `tests/agents-api/list-topics.test.ts` (Task 6). If the real corpus has zero topics this smoke test fails — that's a real signal worth catching.

- [ ] **Step 6: Run all wrapper tests.**

```bash
npm test -- tests/agents-api/respond.test.ts tests/agents-api/wrappers.test.ts
```

Expected: PASS — 3 + 1 cases.

- [ ] **Step 7: Run the full test suite.**

```bash
npm test
```

Expected: all tests green. Real-corpus suite still skipped (no env var).

- [ ] **Step 8: Run `npm run build`.**

```bash
npm run build
```

Expected: prebuild runs `build:agent-index` (1148 docs); Astro static build succeeds. Vercel will detect `api/v1/*` at deploy time and bundle them as serverless functions — that's not exercised locally, only in deploy.

- [ ] **Step 9: Commit.**

```bash
git add api/v1/ tests/agents-api/respond.test.ts tests/agents-api/wrappers.test.ts
git commit -m "Add HTTP wrappers for /api/v1/{index,search,fetch,glossary,topics}"
```

---

### Task 8: vercel.json + operator notes + verification sweep

**Files:**
- Modify: `vercel.json` — add `functions` field with `includeFiles` glob
- Create: `api/v1/README.md` — operator note for deploy verification

**Context:** Phase 2 ships the code; the actual verification that Vercel bundles the BM25 index AND the content tree into the function happens on first preview deploy. This task wires the `vercel.json` config that makes the bundle include `src/content/{topics,glossary,faqs,videos}/**`, and documents the deploy gate so it's not lost between phases.

- [ ] **Step 1: Update `vercel.json` to bundle content for the v1 API.**

The existing file (`vercel.json`) currently only declares headers for `/admin/config.yml`. Extend it with a `functions` field that bundles the content tree into every `api/v1/*.ts` function. Final content:

```json
{
  "headers": [
    {
      "source": "/admin/config.yml",
      "headers": [
        {
          "key": "Content-Type",
          "value": "text/yaml; charset=utf-8"
        }
      ]
    }
  ],
  "functions": {
    "api/v1/*.ts": {
      "includeFiles": "src/content/{topics,glossary,faqs,videos}/**"
    }
  }
}
```

The glob bundles ~50 markdown/JSON files (small) into each of the 5 functions. The 1094-file `external/` tree is **deliberately excluded** — search results that point into external content are served via the BM25 index (already bundled via the agent-search dynamic import); fetching an external page is the agent's responsibility (it can call our `/api/v1/fetch` endpoint with the canonical_url, which runs `globalThis.fetch` against the upstream publisher).

- [ ] **Step 2: Write the operator note.**

Write `api/v1/README.md`:

````markdown
# /api/v1 — Public Agents API

Vercel-native serverless functions exposing the Liberty Lighthouse corpus to AI agents.

## Endpoints

| Method | Path | Tool |
|---|---|---|
| GET | `/api/v1/index` | read_index |
| GET | `/api/v1/search?q=&k=10&kinds=faq,glossary` | search |
| GET | `/api/v1/fetch?url=...` | fetch |
| GET | `/api/v1/glossary?filter=...` | list_glossary |
| GET | `/api/v1/topics` | list_topics |

Public. Anonymous. Returns JSON. CORS open. Citation contract per [/AGENTS.md](https://liberty-lighthouse.vercel.app/AGENTS.md).

## First-deploy verification

The BM25 index is built at `npm run build` time into `src/lib/agent-search/_generated/index.json`. The runtime loader (`src/lib/agent-search/load-index.ts`) dynamic-imports it via `import('./_generated/index.json')`. **Vercel's bundler must trace and include the JSON file in the function output**, or the first call to `/api/v1/search` will throw "module not found."

After the first Vercel preview deploy:

1. Open the deployment in the Vercel dashboard.
2. Navigate to the function for `/api/v1/search`.
3. Inspect the bundled output — the `_generated/index.json` should be present.
4. Smoke-test: `curl '<deploy-url>/api/v1/search?q=msp'` should return JSON with `hits`.

If the JSON isn't bundled (rare but possible for some adapter configurations), the fallback is to publish the index as a static asset under `public/` and have `load-index.ts` fetch it via HTTP. That's tracked as the secondary path in [docs/agents-api.md §10](../../docs/agents-api.md).

## Local development

The wrappers run against `src/content/` directly. Run a smoke test locally:

```bash
npm run build:agent-index   # build the BM25 index
npm test -- tests/agents-api/   # full handler+wrapper coverage
```

There is no local equivalent of the Vercel function runtime in this phase. Phase 3's MCP transport will share the same handlers and is testable via `npx @modelcontextprotocol/inspector`.
````

- [ ] **Step 3: Run the full verification sweep.**

```bash
npm test
AGENT_SEARCH_REAL=1 npm test -- tests/agent-search/real-corpus.test.ts
npm run build
```

Each must succeed. `npm test` count should be ~80 (Phase 1) + ~30 (this phase's tests) = ~110 passing.

Note: `npm run build` (Astro) does **not** verify that Vercel will bundle the new `api/v1/*` functions correctly — that's a separate Vercel-deploy concern, deferred to first preview deploy per the README.

- [ ] **Step 4: Verify file sizes.**

```bash
find src/lib/agents-api api/v1 -name '*.ts' -not -path '*/_lib/*' | xargs wc -l | sort -n
```

Each file ≤200 lines. Wrapper files should be very small (~25 lines each).

- [ ] **Step 5: Commit.**

```bash
git add vercel.json api/v1/README.md
git commit -m "Wire vercel.json includeFiles and document agents API deploy gate"
```

---

## Verification gate (whole phase)

Before declaring Phase 2 complete:

```bash
# 1. All unit tests pass.
npm test

# 2. Real-corpus smoke passes.
AGENT_SEARCH_REAL=1 npm test -- tests/agent-search/real-corpus.test.ts

# 3. Full build succeeds.
npm run build

# 4. No file in either new package exceeds 200 lines.
find src/lib/agents-api api/v1 -name '*.ts' | xargs wc -l | sort -n
```

Then dispatch a final whole-phase code reviewer over commits `<base>..HEAD`.

The Vercel bundling verification is **deferred** until first deploy per Task 8's README — a known gate at the Phase 2 / Phase 3 boundary.

---

## Out-of-band notes for the executing controller

- Skill chain: @superpowers:test-driven-development for every task; @superpowers:verification-before-completion before declaring the phase complete; @superpowers:requesting-code-review for spec + quality reviews per task.
- This phase introduces a new directory pattern (`api/v1/`). Vercel auto-detects this on deploy; locally, nothing executes the wrappers as functions. Test coverage relies on direct handler imports + the smoke test in `wrappers.test.ts`.
- Phase 3 (MCP transport) imports the SAME handlers from `src/lib/agents-api/handlers/`. Don't add HTTP-specific concerns into the handlers — that breaks reuse.
- If any task's file budget is breached, the implementer should split before committing.

## After this plan ships

Phase 3 plan (`docs/superpowers/plans/2026-05-06-agents-api-phase-3-mcp.md`) gets written next, adding `api/v1/mcp.ts` Streamable HTTP MCP transport over the same handlers. Phase 4 (Custom GPT + OpenAPI) and Phase 5 (`/ai` page) follow.
