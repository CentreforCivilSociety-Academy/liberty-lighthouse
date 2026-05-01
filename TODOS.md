# TODOs

Deferred items, all non-blocking. Captured during the glossary feature reviews
(CEO + Eng + Codex outside-voice) so they don't get lost.

## T1 — Embeddings-based "see also" terms (P2)
**What:** Auto-suggest related glossary terms via vector similarity.
**Why:** `relatedTerms` is hand-curated. Embeddings would surface non-obvious adjacencies.
**Cons:** Needs an embedding pipeline; out of scope for a static site without an inference layer.
**Where to start:** Off-site batch job that emits a `relatedTerms` JSON, consumed at build.

## T2 — LLM Q&A on a glossary entry (P3)
**What:** "Ask about MSP" button on each term page.
**Why:** Lets readers go deeper without leaving the entry.
**Cons:** Real LLM dependency, prompt management, cost.

## T3 — Multilingual term variants (P3)
**What:** Hindi / Marathi alias support so a term auto-links across language editions.
**Why:** Audience is Indian; many will think in regional languages first.
**Cons:** Requires aliases-with-locale field on the schema and per-locale rendering.

## T4 — Auto-extract candidate terms from existing FAQ/video bodies (P2)
**What:** ML-assisted glossary growth — suggest "this phrase appears 12 times across articles, want to define it?"
**Why:** Saves curation effort; surfaces the actual jargon authors use.

## T5 — Term popularity badge (P3)
**What:** "Most-discussed terms" leaderboard on `/glossary/`, optionally with per-term mention count.
**Why:** Helps newcomers see which concepts are central.
**Cons:** Either build-time count (cheap, stale unless rebuild) or runtime via analytics (more work).

## T6 — Add Playwright e2e (P2)
**What:** Browser-driven e2e suite. Currently we have vitest unit tests + manual QA.
**Why:** Once the hover/tap interaction surface is real and used, regressions become possible.
**When:** When CI exists.

## T7 — CI integration of `npm test` (P2)
**What:** Run vitest in CI on every PR.
**Why:** Tests don't protect what they don't run on. Solo-dev discipline-grade today.
**When:** When a CI workflow lands for this repo.

## T9 — Audit other JSON-LD schema builders for wrong-field bugs (P3)
**What:** Sister-check of T8. Verify Video / Breadcrumb / Organization / WebSite / DefinedTerm / DefinedTermSet schema builders in [src/lib/structured-data.ts](src/lib/structured-data.ts) don't have similar "field is set to the wrong source" bugs.
**Why:** T8 was caught by Codex outside-voice; we don't know if the same class of bug hides in adjacent builders. SEO impact compounds silently.
**Cons:** Low ROI if all clean; ~30 min scan + tests.
**When:** Next time `structured-data.ts` is touched, or as a standalone cleanup PR.
