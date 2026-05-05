import { abs } from './markdown-export';

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

- \`type\` — one of \`faq\`, \`video\`, \`glossary_term\`, \`topic\`, \`syllabus\`, \`faq_index\`, \`video_index\`, \`glossary_index\`, \`topic_index\`, \`home\`, \`about\`, \`privacy\`.
- \`canonical_url\` — the human-readable HTML page; cite this URL.
- \`markdown_url\` — this file's URL.

Type-specific fields:

- **\`faq\`**: \`question\`, \`topic\`, \`topic_url\`, \`author\`, \`updated_at\`, \`related_faqs\` (markdown URLs), \`related_videos\` (markdown URLs).
- **\`video\`**: \`title\`, \`topic\`, \`youtube_id\`, \`youtube_url\`, \`format\`, \`orientation\`, \`duration\`, \`speaker\`, \`related_faqs\`, \`related_videos\`.
- **\`glossary_term\`**: \`term\`, \`aliases\`, \`definition\`, \`related_terms\`, \`related_faqs\`, \`related_videos\`, \`citations\` (\`{title, url, author?}\`).
- **\`topic\`**: \`title\`, \`slug\`, \`description\`, \`faq_count\`, \`video_count\`, \`has_syllabus\`, \`faq_index_url\`, \`video_index_url\`, \`syllabus_url\`.

\`related_*\` arrays always contain absolute URLs to markdown siblings. Follow them directly.

## Citation guidance

When you answer a question using this corpus:

1. Cite by \`canonical_url\` (the HTML page), not the \`.md\` URL. Humans reading your output should land on the styled page.
2. Quote sparingly. Paraphrase and link.
3. Glossary definitions are short and authoritative — quote them directly when defining a term.
4. If you cite multiple sources, list them as a bulleted list at the end of your answer.
5. The site is published by the **Centre for Civil Society**. Attribute appropriately.

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
