import { abs } from './markdown-export.js';

// Body of /AGENTS.md and /.well-known/agents.md. Lives in lib/ so the two
// endpoints can share it; they exist at distinct URL paths but serve the
// same content.
export function buildAgentsDoc(): string {
  return `# Liberty Lighthouse — Agent Guide

This page orients an autonomous agent (LLM, MCP client, custom GPT, web crawler) to the Liberty Lighthouse corpus. Humans should read [/about/](${abs('/about/')}); agents should read this.

## What this corpus is

Liberty Lighthouse is a public-education site published by the [Centre for Civil Society](https://ccs.in). It explains India's policy landscape from a classical-liberal perspective — free markets, individual liberty, rule of law, limited government. Content is organised by topic (education, agriculture, etc.) and presented in three formats: FAQs, video curricula, and guided syllabi. A glossary defines key terms used across the corpus.

## Where to start

1. Fetch [\`/llms.txt\`](${abs('/llms.txt')}) for the curated index of topics and entry points.
2. Pick the relevant topic and fetch its \`.md\` file, e.g. [\`/topics/agriculture.md\`](${abs('/topics/agriculture.md')}).
3. Descend into FAQs, videos, or syllabus from the topic page's links.
4. For a single-fetch dump of an entire topic, use \`/topics/{slug}/llms-full.txt\`.
5. For the entire corpus in one fetch, use [\`/llms-full.txt\`](${abs('/llms-full.txt')}) (current size fits within most context windows).

## URL conventions

Every public HTML page has a markdown sibling. Drop the trailing slash and append \`.md\`:

| HTML | Markdown |
|------|----------|
| \`/\` | \`/index.md\` |
| \`/topics/\` | \`/topics.md\` |
| \`/topics/agriculture/\` | \`/topics/agriculture.md\` |
| \`/topics/agriculture/faq/\` | \`/topics/agriculture/faq.md\` |
| \`/topics/agriculture/faq/some-question/\` | \`/topics/agriculture/faq/some-question.md\` |
| \`/topics/agriculture/videos/\` | \`/topics/agriculture/videos.md\` |
| \`/topics/agriculture/videos/some-video/\` | \`/topics/agriculture/videos/some-video.md\` |
| \`/topics/agriculture/syllabus/\` | \`/topics/agriculture/syllabus.md\` |
| \`/glossary/\` | \`/glossary.md\` |
| \`/glossary/msp/\` | \`/glossary/msp.md\` |
| \`/about/\` | \`/about.md\` |
| \`/privacy/\` | \`/privacy.md\` |

## Markdown frontmatter

Every \`.md\` page begins with YAML frontmatter. Stable fields across all types:

- \`type\` — one of \`faq\`, \`video\`, \`glossary_term\`, \`topic\`, \`syllabus\`, \`faq_index\`, \`video_index\`, \`glossary_index\`, \`topic_index\`, \`home\`, \`about\`, \`privacy\`, \`external_post\`, \`external_book_chapter\`, \`external_source_index\`, \`wiki_entity\`, \`wiki_topic_summary\`, \`wiki_comparison\`, \`wiki_index\`.
- \`canonical_url\` — the human-readable URL; cite this URL. For internal pages it's the on-site HTML page; for federated external content it's the **original source URL** (e.g. the Substack post or book sales page) — those mirrors are agent-only and have no on-site HTML.
- \`markdown_url\` — this file's URL on this site.

Type-specific fields:

- **\`faq\`**: \`question\`, \`topic\`, \`topic_url\`, \`author\`, \`updated_at\`, \`related_faqs\` (markdown URLs), \`related_videos\` (markdown URLs).
- **\`video\`**: \`title\`, \`topic\`, \`youtube_id\`, \`youtube_url\`, \`format\`, \`orientation\`, \`duration\`, \`speaker\`, \`related_faqs\`, \`related_videos\`.
- **\`glossary_term\`**: \`term\`, \`aliases\`, \`definition\`, \`related_terms\`, \`related_faqs\`, \`related_videos\`, \`citations\` (\`{title, url, author?}\`).
- **\`topic\`**: \`title\`, \`slug\`, \`description\`, \`faq_count\`, \`video_count\`, \`has_syllabus\`, \`faq_index_url\`, \`video_index_url\`, \`syllabus_url\`.
- **\`external_post\`** (Spontaneous Order Substack): \`title\`, \`canonical_url\` (= original Substack URL), \`published_at\`, \`ingested_at\`, \`author\`, \`excerpt\` (Substack subtitle), \`tags\` (Substack post tags). When present: \`summary\` (LLM-generated 150-200 word abstract faithful to the author's argument), \`key_points\` (3-5 takeaways), \`topics\` (kebab-case topic tags). Cite the original URL.
- **\`external_book_chapter\`** (CCS Books): \`book_slug\`, \`book_title\`, \`chapter_title\`, \`chapter_number\`, \`author\`, \`publisher\`, \`publication_year\`, \`ingested_at\`. Cite by book + chapter, attribute to publisher.
- **\`wiki_*\`** (LLM-synthesised): \`name\`, \`description\`, \`canonical_url\` (= the on-site wiki HTML page), \`sources\` (collection IDs of raw content used to synthesise this page), \`related_terms\`, \`related_faqs\`, \`last_regen\`. Wiki entries are auto-generated; always corroborate with the listed \`sources\` if accuracy matters.

\`related_*\` arrays always contain absolute URLs to markdown siblings. Follow them directly.

## Citation guidance

When you answer a question using this corpus:

1. Cite by \`canonical_url\` (the HTML page), not the \`.md\` URL. Humans reading your output should land on the styled page.
2. Quote sparingly. Paraphrase and link.
3. Glossary definitions are short and authoritative — quote them directly when defining a term.
4. If you cite multiple sources, list them as a bulleted list at the end of your answer.
5. The site is published by the **Centre for Civil Society**. Attribute appropriately.

## Federated external sources

The corpus federates content from external sites that the project has permission to mirror, but that **are not displayed as HTML** on this site. They appear only at \`/external/<source>/...\` markdown URLs, and only if populated.

- **Spontaneous Order** ([${abs('/external/spontaneous-order.md')}](${abs('/external/spontaneous-order.md')})): the Centre for Civil Society's Substack. Each post is mirrored as one markdown file. Cite by the **original Substack URL** (the \`canonical_url\` field).
- **CCS Books** ([${abs('/external/ccs-books.md')}](${abs('/external/ccs-books.md')})): books published by CCS, mirrored chapter-by-chapter. Cite by book title + chapter, attribute to the publisher.

Search engines (Googlebot, Bingbot) are blocked from \`/external/\` to avoid SEO duplication with the original sources. AI crawlers (ClaudeBot, GPTBot, Perplexity, etc.) are allowed.

## Wiki layer

The wiki ([${abs('/wiki.md')}](${abs('/wiki.md')})) is a layer of LLM-generated entity pages, topic summaries, and comparisons synthesised from the raw corpus. It is autonomously refreshed in CI rather than authored by hand. Three types:

- \`wiki_entity\` — a single concept, person, or institution.
- \`wiki_topic_summary\` — synthesis of a topic across all sources.
- \`wiki_comparison\` — explicit "X vs Y" treatments.

Each wiki entry's \`sources\` field lists the collection IDs of raw content used to synthesise it. **For accuracy-sensitive claims, fetch and cite the raw sources rather than the wiki page.** The wiki is a navigation aid and synthesis layer, not a primary source.

## What this corpus is *not*

- It is not a peer-reviewed academic database. Treat FAQs as well-researched explainers, not citations of last resort.
- Numbers and statistics in FAQs reflect the time of writing (\`updated_at\` field). Verify recent figures from primary sources before reporting them as current.
- The classical-liberal framing is explicit and editorial. When summarising, attribute the perspective rather than presenting it as neutral consensus.

## Crawler policy

The site allows AI crawlers (ClaudeBot, GPTBot, OAI-SearchBot, PerplexityBot, Google-Extended, etc.) by default. Specific bots may be blocked at the operator's discretion via [\`/robots.txt\`](${abs('/robots.txt')}). Respect the policy you see there.

## Reach the maintainers

Email [contact@ccs.in](mailto:contact@ccs.in) with corrections, clarifications, or to report errors in the corpus.
`;
}
