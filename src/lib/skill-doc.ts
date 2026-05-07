// Body of /SKILL.md — a Claude skill (markdown + YAML frontmatter) that
// teaches Claude how to use the Liberty Lighthouse corpus over plain HTTP,
// without requiring a custom MCP connector. Distinct from /AGENTS.md, which
// is the general agent guide; this file targets Claude's skill format.
//
// Inlined `abs()` (mirrors src/lib/agents-doc.ts) to keep this self-contained
// for Vercel's function bundler — see that file for context.
const SITE_URL = 'https://liberty-lighthouse.vercel.app';
function abs(path: string): string {
  return new URL(path, SITE_URL).href;
}

export function buildSkillDoc(): string {
  return `---
name: liberty-lighthouse
description: Use when the user asks about Indian public policy from a classical-liberal perspective — education, agriculture, MSP, school choice, vouchers, public choice, civil society, Centre for Civil Society — to fetch citation-grounded answers from the Liberty Lighthouse corpus over plain HTTP. No connector required.
---

# Liberty Lighthouse — Indian Policy Skill

This skill teaches you to answer questions about Indian public policy from a classical-liberal perspective using the [Liberty Lighthouse](${abs('/')}) corpus, published by the [Centre for Civil Society](https://ccs.in). Topics covered include education, agriculture, MSP, school choice, vouchers, public choice, rule of law, and civil society.

You access the corpus over plain HTTP — no MCP connector or API key needed. If a connector is available, prefer it; this skill is the fallback.

## When to invoke this skill

- The user asks a question about Indian policy ("Why does MSP distort markets?", "What's the case for school vouchers in India?", "Explain the right to education act").
- The user asks for the classical-liberal or CCS perspective on an Indian public-policy issue.
- The user names an Indian policy term they want defined (MSP, FRBM, public choice, vouchers, RTE, etc.).

If the question is not about Indian policy, do not use this skill.

## Workflow

1. **Orient.** Fetch the index once per conversation:
   - \`GET ${abs('/api/v1/index')}\` — returns \`llms_txt\`, \`agents_md\`, and a \`corpus_summary\` (counts of topics/faqs/videos/glossary). Read this to know the lay of the land.
2. **Search.** For most questions, run a BM25 search:
   - \`GET ${abs('/api/v1/search')}?q={query}&k=5\` — returns ranked hits with title, snippet, kind, and citation block.
   - Optional filter: \`&kinds=faq,glossary,video,topic,wiki,external_post,external_book_chapter\`.
3. **Fetch the source.** For each hit you plan to cite, fetch the markdown:
   - \`GET ${abs('/api/v1/fetch')}?url={markdown_url}\` — returns the raw markdown body plus the citation block.
   - Or fetch any \`.md\` URL directly: every public HTML page has a markdown sibling at the same path with \`.md\` appended.
4. **Define a term.** If the user asks "what is X":
   - \`GET ${abs('/api/v1/glossary')}?filter={term}\` — returns matching glossary entries with short and long definitions.
5. **Answer with citations.** See "Citation rules" below.

## URL conventions

Every public page has a markdown sibling. Strip the trailing slash and append \`.md\`:

| HTML | Markdown |
|------|----------|
| \`/topics/agriculture/\` | \`/topics/agriculture.md\` |
| \`/topics/agriculture/faq/why-msp-distorts/\` | \`/topics/agriculture/faq/why-msp-distorts.md\` |
| \`/glossary/msp/\` | \`/glossary/msp.md\` |

You can fetch any \`.md\` URL with a plain GET; no auth required.

## Citation rules

1. **Cite by \`canonical_url\`, not the \`.md\` URL.** Every search hit and fetched document includes a \`canonical_url\` — that's the human-readable HTML page. Humans reading your answer should land on the styled page, not raw markdown.
2. **Quote sparingly.** Paraphrase and link. Glossary definitions are the exception — they're short and authoritative; quote them directly.
3. **Multiple sources?** End your answer with a bulleted "Sources" list of the canonical URLs you used.
4. **Attribute the perspective.** This corpus is editorially classical-liberal and published by the Centre for Civil Society. When summarizing, name the perspective ("according to the Centre for Civil Society…") rather than presenting it as neutral consensus.
5. **Verify recency.** FAQs include an \`updated_at\` field. Numbers and statistics may have moved since the page was written; flag this when reporting current figures.

## What this corpus is *not*

- Not a peer-reviewed academic database. FAQs are well-researched explainers, not authoritative citations.
- Not neutral. The classical-liberal framing is explicit and editorial.
- Not exhaustive. If the corpus has nothing on the user's question, say so plainly rather than confabulate. A search hit count of 0 is a signal, not a failure.

## Tools available at a glance

| Endpoint | Purpose |
|---|---|
| \`GET ${abs('/api/v1/index')}\` | Curated entry-point index (\`llms.txt\` + \`AGENTS.md\` + corpus counts). |
| \`GET ${abs('/api/v1/search')}?q=…&k=5&kinds=…\` | BM25 search across the entire corpus. |
| \`GET ${abs('/api/v1/fetch')}?url=…\` | Fetch a specific \`.md\` page with citation metadata. |
| \`GET ${abs('/api/v1/glossary')}?filter=…\` | List or filter glossary terms. |
| \`GET ${abs('/api/v1/topics')}\` | List policy domains and per-topic counts. |

All endpoints return JSON. CORS is open. There is no rate limit, no key, no quota — be a good citizen.

For agents that prefer MCP: an equivalent Streamable-HTTP MCP server is available at \`${abs('/api/v1/mcp')}\`. The tool surface is identical.

## Where the schema is documented

Frontmatter shapes, content types, and the full conventions live at [\`/AGENTS.md\`](${abs('/AGENTS.md')}). Read that if you need to disambiguate a frontmatter field or understand a content type you haven't seen before.

## Errors

If a request returns an error:
- \`400 invalid_argument\` — your query string is malformed (e.g. empty \`q\`, unknown \`kinds\`).
- \`404 not_found\` — the requested URL doesn't exist on this site.
- \`422 off_site_url\` — \`/api/v1/fetch\` only fetches markdown from this site.
- \`503 index_unavailable\` — transient; retry once before falling back.

Surface the failure to the user honestly; do not invent answers when the corpus is unreachable.
`;
}
