import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, plainTextResponse } from '../lib/markdown-export';

// Howard-spec llms.txt — see https://llmstxt.org/
// Root index for autonomous agents. Each H2 section is a curated link list.
export const GET: APIRoute = async () => {
  const topics = (await getCollection('topics')).sort((a, b) => a.data.order - b.data.order);

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

  for (const topic of topics) {
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
    '## About',
    '',
    `- [About Liberty Lighthouse](${abs('/about.md')}): mission, formats, and the Centre for Civil Society.`,
    `- [Privacy](${abs('/privacy.md')}): cookies, analytics, and data handling.`,
    '',
    '## Full content (single file)',
    '',
    `- [Complete content dump](${abs('/llms-full.txt')}): all FAQs, videos, glossary, and syllabi as a single markdown file. Useful while the corpus fits a context window.`,
  );
  for (const topic of topics) {
    lines.push(
      `- [${topic.data.title} — full content](${abs(`/topics/${topic.data.slug}/llms-full.txt`)}): ${topic.data.title} FAQs, videos, and syllabus only.`,
    );
  }
  lines.push(
    `- [Glossary — full content](${abs('/glossary/llms-full.txt')}): every glossary entry with definition, body, and citations.`,
    '',
  );

  return plainTextResponse(lines.join('\n'));
};
