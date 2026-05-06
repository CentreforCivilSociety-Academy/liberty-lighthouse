# Liberty Lighthouse — Agents API design

**Status:** approved (2026-05-06).
**Audience:** maintainers + the engineer who'll implement the next phase.
**Purpose:** lock the contract before any TypeScript moves. The implementation plan ([docs/superpowers/plans/](superpowers/plans/), to be written after sign-off) decomposes this into TDD-shaped tasks.

---

## 1. What we're building

A public, anonymous, citation-grounded HTTP surface that exposes the Liberty Lighthouse corpus to any AI agent — ChatGPT (via a Custom GPT Action), Claude Desktop / Claude Code / Cursor / Cline (via Streamable HTTP MCP), or any tool that can read `llms.txt`. Plus a single `/ai` page on the website telling end users how to plug Liberty Lighthouse into the AI tool they already use.

We do **not** run inference. We do **not** host an on-site chat. We do **not** pay for LLM tokens. The user supplies the model.

## 2. What already exists (don't rebuild)

| Artifact | Location | Status |
|---|---|---|
| Per-page markdown twins (append `.md` to any URL) | [src/lib/markdown-export](src/lib/markdown-export) + Astro routes | shipped |
| `/llms.txt` Howard-spec index | [src/pages/llms.txt.ts](src/pages/llms.txt.ts) | shipped |
| `/llms-full.txt` whole-corpus dump | [src/pages/llms-full.txt.ts](src/pages/llms-full.txt.ts) | shipped |
| `/AGENTS.md` schema + citation rules | website route | shipped |
| Stdio MCP server (6 tools) | [mcp/server.ts](mcp/server.ts) | shipped, used by Claude Desktop |
| Custom GPT manual setup guide | [docs/distribution/custom-gpt.md](docs/distribution/custom-gpt.md) | shipped, GPT not yet built |
| Claude Skill (SKILL.md package) | [docs/distribution/claude-skill/](docs/distribution/claude-skill/) | built, not yet published |
| GA4 + consent-mode site analytics | [src/components/global/Analytics.astro](src/components/global/Analytics.astro) | shipped, browser-only |
| Decap CMS admin | [public/admin/](public/admin/) | shipped, content editor |

## 3. What's new (this design)

1. **Public HTTP API** at `/api/v1/*` — the agent-shaped tool surface (search, fetch, index, glossary, topics) backed by a build-time BM25 index.
2. **Streamable HTTP MCP** at `/api/v1/mcp` — thin adapter over (1), enabling one-click installation in claude.com/connectors.
3. **Custom GPT** — actually built and listed (or shared unlisted). Action points at the OpenAPI spec describing (1).
4. **`/ai` page** — user-facing discovery surface linking the GPT, the connector, MCP config snippets, and the raw `llms.txt`.
5. **Telemetry** — anonymous daily counters (invocations / questions / unique sessions). No content logged. No writes on the request path.
6. **Admin stats page** — gated route reading the telemetry source.
7. **Privacy policy addendum** — covering the public API.

## 4. Architectural principles (the Karpathy contract)

These are non-negotiable. Every later decision should be traceable to one of these.

- **Markdown is the source of truth.** No vector embeddings. No RAG pipeline. The Astro content collections and their `.md` siblings are canonical.
- **The LLM is the ranker.** Tools return generous, lightly-ranked candidates. The agent's host model picks and synthesises.
- **Citations are mandatory and structured.** Every search hit and every fetch payload carries a `citation` block with `canonical_url`, `title`, `kind`, `last_modified`. Tool descriptions and the GPT system prompt enforce "no claim without a `canonical_url`."
- **Read-only at runtime.** No request-path writes anywhere. Telemetry uses a side channel (Vercel metrics on demand, or a daily aggregator).
- **Static-and-serverless.** No database. No KV. No Redis. The BM25 index is built at deploy time and shipped inside the function bundle.
- **Public and anonymous.** No API keys. No rate-limiting infrastructure. The corpus is already public.

## 5. Tool surface

Five tools. Identical shapes across MCP and OpenAPI — both are adapters over the same TypeScript handlers in `src/lib/agents-api/`.

### 5.1 `read_index`

Fetch the curated root index plus the schema/citation guide. **Always called first** in a conversation.

**Input:** none.
**Output (JSON):**

```json
{
  "llms_txt": "<full text of /llms.txt>",
  "agents_md": "<full text of /AGENTS.md>",
  "corpus_summary": {
    "topics": 2,
    "faqs": 29,
    "videos": 15,
    "glossary": 4,
    "wiki": 5,
    "external": 1094,
    "last_updated": "2026-05-06"
  }
}
```

### 5.2 `search`

BM25 over the entire corpus. Returns ranked candidates. The LLM filters and decides what to fetch.

**Input:**

```json
{ "query": "what is MSP", "k": 10, "kinds": ["faq","glossary","wiki","topic","video","external"] }
```

`k` defaults to 10, max 25. `kinds` defaults to all.

**Output:**

```json
{
  "query": "what is MSP",
  "hits": [
    {
      "rank": 1,
      "score": 14.32,
      "kind": "glossary",
      "title": "Minimum Support Price (MSP)",
      "snippet": "MSP is the floor price at which the government commits to procure...",
      "citation": {
        "canonical_url": "https://liberty-lighthouse.vercel.app/glossary/msp/",
        "markdown_url": "https://liberty-lighthouse.vercel.app/glossary/msp.md",
        "title": "Minimum Support Price (MSP)",
        "kind": "glossary",
        "last_modified": "2026-04-12"
      }
    }
  ]
}
```

### 5.3 `fetch`

Fetch the markdown for any page on the site. Validates the URL is on the lighthouse domain.

**Input:**

```json
{ "url": "https://liberty-lighthouse.vercel.app/glossary/msp.md" }
```

**Output:**

```json
{
  "markdown": "<full markdown including frontmatter>",
  "citation": {
    "canonical_url": "https://liberty-lighthouse.vercel.app/glossary/msp/",
    "markdown_url": "https://liberty-lighthouse.vercel.app/glossary/msp.md",
    "title": "Minimum Support Price (MSP)",
    "kind": "glossary",
    "last_modified": "2026-04-12"
  }
}
```

### 5.4 `list_glossary`

Cheap precise enumeration. Useful for definition-style questions.

**Input:**

```json
{ "filter": "msp" }
```

`filter` is optional substring match against term and definition.

**Output:**

```json
{
  "terms": [
    {
      "term": "Minimum Support Price (MSP)",
      "short_definition": "Government-set floor price for procurement of select crops.",
      "citation": { ... }
    }
  ]
}
```

### 5.5 `list_topics`

Tiny enumeration (2 topics today). Cheap.

**Input:** none.
**Output:**

```json
{
  "topics": [
    {
      "slug": "agriculture",
      "title": "Agriculture",
      "description": "Indian farm policy: MSP, APMC, contract farming, subsidies.",
      "counts": { "faqs": 14, "videos": 8 },
      "citation": { ... }
    }
  ]
}
```

### 5.6 Tools deliberately *not* exposed

- `list_topic_content` (in current stdio MCP) — replaceable by `search` + `fetch`. Drop on the new surface. Stdio MCP keeps it for backward compat until the refactor.
- Anything that writes — by design.
- Anything that calls an LLM — by design.

## 6. Citation contract

Every response that returns content carries one or more `citation` blocks shaped:

```json
{
  "canonical_url": "<HTML page URL — what humans should click>",
  "markdown_url": "<.md sibling — what agents fetched>",
  "title": "<page title>",
  "kind": "topic|faq|video|glossary|wiki|external|syllabus",
  "last_modified": "<ISO date>"
}
```

**Cite by `canonical_url`.** The `.md` URL is for agent traversal only; humans clicking citations should land on the styled HTML page.

**External-content canonical URLs.** Federated sources have different canonical-URL rules than first-party content:

- **Spontaneous Order posts** — `canonical_url` = the upstream publisher URL (`original_url` field in frontmatter; matches [src/lib/markdown-export.ts:291](src/lib/markdown-export.ts) where the same convention already applies to the `.md` siblings). Citations should send humans to the original publisher.
- **CCS Books chapters** — no public HTML version exists. `canonical_url` = `markdown_url`. The `.md` page is the canonical reference an agent or human can click. Note this in citation explanations so users aren't surprised they're getting markdown.

The Custom GPT system prompt and MCP tool descriptions both include the directive: *"Every substantive claim must be followed by a citation to a `canonical_url` from the corpus. If `search` returns nothing relevant, say so plainly. Do not answer from training data."*

## 7. HTTP API endpoints

| Method | Path | Maps to | Notes |
|---|---|---|---|
| GET | `/api/v1/index` | `read_index` | |
| GET | `/api/v1/search?q=...&k=10&kinds=faq,glossary` | `search` | |
| GET | `/api/v1/fetch?url=...` | `fetch` | URL must be on lighthouse domain |
| GET | `/api/v1/glossary?filter=...` | `list_glossary` | |
| GET | `/api/v1/topics` | `list_topics` | |
| POST/GET | `/api/v1/mcp` | all five | Streamable HTTP MCP transport |
| GET | `/.well-known/openapi.yaml` | OpenAPI 3.1 spec for ChatGPT Action | served as static asset |

CORS: `Access-Control-Allow-Origin: *`. No auth headers required or honored.

## 8. Error taxonomy

Every error response:

```json
{
  "error": {
    "code": "BAD_REQUEST | NOT_FOUND | UPSTREAM_ERROR | VALIDATION_ERROR",
    "message": "<human-readable>",
    "details": { /* optional, structured */ }
  }
}
```

HTTP status codes: 400 for bad input, 404 for unknown URL in `fetch`, 502 for upstream content fetch failures, 500 for unexpected. No 401/403 (public, no auth).

## 9. Search index — concrete shape

- Built at `npm run build` time by a script in `src/lib/agent-search/build-index.ts`.
- Consumes Astro content collections: `topics`, `faqs`, `videos`, `glossary`, `wiki`, `external` (Spontaneous Order + CCS Books), `syllabi` (within topics).
- Tokenizer: lowercase, strip punctuation, ASCII + Devanagari ranges (Hindi terms appear in glossary). No stemming v1; can add Porter for English-only later.
- BM25 parameters: k1=1.5, b=0.75 (defaults).
- Output: a single JSON file (`dist/agent-index.json`) shaped `{ docs: [...], inverted: { token: [{docId, tf}] }, idf: {...}, meta: {...} }`. Estimated size at current corpus: ~3–8MB JSON, gzip to ~1MB.
- Loaded lazily on first request inside the function; cached in module scope (warm functions reuse).

Substring fallback against `/llms-full.txt` stays in place as a sanity-check route (`/api/v1/search?engine=substring`) and as the implementation that powers `mcp/server.ts:search_corpus` until it's refactored.

## 10. Telemetry

**What we count, daily, anonymously:**
- `invocations` — every tool call across MCP + HTTP API.
- `questions` — heuristic: first `read_index` or first `search` per session = one question.
- `unique_sessions` — HMAC-hashed (IP + UA + daily salt). Daily salt rotates; sessions are *not* linkable across days.

**What we never collect:** raw IPs, user agents (beyond hashing), query content, response content, anything else.

**Mechanism (preferred):** Vercel's built-in function-invocation metrics, read by the admin dashboard at view time via Vercel's REST API. Zero writes from our code. (Subject to verification of free-tier API surface — caveat noted in §13.)

**Mechanism (fallback if Vercel API doesn't expose what we need):** a daily GitHub Action runs, reads whatever signal is available, aggregates to `data/usage/YYYY-MM-DD.json` on a `usage-data` orphan branch via a tightly-scoped GitHub App. ~1 commit/day, off the request path. No runtime writes.

The runtime-writes-to-GitHub design (every API call bumps a counter via Contents API) is **rejected** — wrong shape, hits rate limits, conflates request path with persistence.

## 11. Admin dashboard

New route at `src/pages/admin/usage.astro`. Gated behind the same GitHub OAuth that protects Decap CMS. Renders three time-series charts: invocations, questions, unique sessions. Daily and 30-day views. Data source = whichever telemetry mechanism §10 settles on.

## 12. The `/ai` page

User-facing discovery surface. New Astro route at `src/pages/ai.astro`. Sections:

1. **What is this?** One paragraph: "Liberty Lighthouse is AI-readable. Plug it into the tool you already use."
2. **Use with ChatGPT** — link to the published Custom GPT. Note that creating Custom GPTs requires a paid ChatGPT plan; using a shared one is broader.
3. **Use with Claude Desktop** — link to the claude.com/connectors listing once approved; in the meantime, manual MCP config snippet.
4. **Use with Claude Code / Cursor / Cline / Continue** — the MCP HTTP URL plus a JSON config snippet they can paste into their tool's settings.
5. **Use with anything that reads `llms.txt`** — point at the domain.
6. **Build your own** — links to `/.well-known/openapi.yaml`, `AGENTS.md`, the MCP tool list.
7. **How to cite** — examples.
8. **Limits & privacy** — corpus scope, what we collect, link to privacy.

## 13. Out of scope for v1

- On-site chat / `/ask` page. We never run inference.
- LLM API spend of any kind. The user's tool brings the model.
- Embeddings, vector DB, RAG infrastructure.
- Anonymous user identity beyond a daily session hash.
- Per-tool / per-route latency dashboards. Vercel's UI handles that for us.
- Migrating the existing stdio MCP. It keeps working; refactor is optional cleanup, not a launch blocker.

## 14. Open questions before implementation

1. **Vercel metrics API surface.** Does the Vercel free-tier REST API expose function-invocation counts in a clean way? If yes, telemetry is "no writes anywhere, ever." If no, fall back to the daily GitHub Action. **Action:** verify before Phase 6; doesn't block earlier phases.
2. **Custom GPT: browsing-based or Action-based?** [docs/distribution/custom-gpt.md](docs/distribution/custom-gpt.md) currently recommends browsing with Action as optional. With the new `/api/v1/*` endpoints, Action-based becomes more capable (real BM25 search, structured citations) and more deterministic (no LLM-driven URL guessing). **Lean: switch to Action-based as the default once Phase 2 lands. Ship browsing as the launch GPT.**
3. **Claude Skill distribution.** [docs/distribution/claude-skill/](docs/distribution/claude-skill/) is built but undistributed. Options: (a) push to a public GitHub repo as a `claude plugin install`-able package, (b) submit to claude.ai's Skills marketplace once that's open, (c) leave it as docs and let users copy. Not blocking; can be its own follow-up.
4. **Listing readiness materials.** Logo (which size?), support email, "supported countries" answer, conversation starters, listing categories. Need before submitting to claude.com/connectors and the GPT Store. Not blocking implementation.
5. **`usage-data` branch vs. sibling repo.** If the GitHub Action fallback is needed (§10), do we use an orphan branch on the main repo (one place, one auth) or a sibling repo `liberty-lighthouse-usage` (isolated writes, smaller main-repo clone)? **Lean: orphan branch.**

## 15. Implementation roadmap (high-level)

The detailed TDD-shaped plan lives in `docs/superpowers/plans/2026-05-06-agents-api.md` (to be written after this design is approved). High-level phases:

| # | Phase | Outcome | Verify |
|---|---|---|---|
| 0 | This document | Design signed off | Maintainer approves |
| 1 | BM25 search core | `npm run build` produces `dist/agent-index.json`; library in `src/lib/agent-search/` | Fixture-corpus tests pass; `search("MSP")` ranks glossary first in <50ms |
| 2 | Public HTTP API | `/api/v1/{index,search,fetch,glossary,topics}` live on preview deploy | `curl` each; well-formed JSON; p95 <300ms |
| 3 | Streamable HTTP MCP | `/api/v1/mcp` answers MCP protocol over Streamable HTTP | `npx @modelcontextprotocol/inspector` connects; all 5 tools list and execute |
| 4 | OpenAPI spec + Custom GPT | `/.well-known/openapi.yaml` served; private GPT built with Action | Fresh user asks "what is MSP?"; GPT calls `search` → `fetch` → answers with `canonical_url` citation |
| 5 | `/ai` page | Public route at `/ai/` linking GPT + connector + MCP snippets | Page loads; all links resolve; sample MCP config copy-pastes cleanly |
| 6 | Telemetry | Counters captured (Vercel API or GitHub Action fallback) | Counters incrementing; no PII anywhere; privacy policy approved |
| 7 | Admin stats page | `/admin/usage` shows charts | Logged-in admin sees charts; logged-out 401 |
| 8 | Privacy policy update | `/privacy` and `/privacy.md` updated | Side-by-side review |
| 9 | claude.com/connectors submission | Listed in directory | One-click install works in fresh Claude Desktop |
| 10 | GPT Store submission | Listed (optional) | Listing approved |

**MVP cut for first usable launch:** 0 → 1 → 2 → 3 → 4 → 5. Telemetry, listings, and dashboard are post-launch polish.

---

## Sign-off

When this document is approved:
1. Replace the status banner with `Status: approved`.
2. I'll write the detailed TDD plan at `docs/superpowers/plans/2026-05-06-agents-api.md` using the writing-plans skill.
3. Implementation starts with Phase 1.

Until then: red-pen freely. Push back on anything in §4 (principles), §5 (tool surface), §6 (citation contract), §10 (telemetry mechanism), §13 (out of scope), or §14 (open questions). Those are the load-bearing decisions.
