import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { abs, markdownResponse } from '../lib/markdown-export';

export const GET: APIRoute = async () => {
  const fm = {
    type: 'home',
    title: 'Liberty Lighthouse',
    canonical_url: abs('/'),
    markdown_url: abs('/index.md'),
  };

  const lines: string[] = [
    '# Liberty Lighthouse',
    '',
    "A classical liberal resource for understanding India's policy landscape, published by the Centre for Civil Society. The site is organised by topic, with FAQs, video curricula, glossary terms, and guided syllabi.",
    '',
    '## Where to look',
    '',
    `- **Site map for agents**: [${abs('/llms.txt')}](${abs('/llms.txt')}) — start here. Curated index that points into each section.`,
    `- **Schema for agents**: [${abs('/AGENTS.md')}](${abs('/AGENTS.md')}) — corpus orientation, URL conventions, citation guidance.`,
    `- **Topics**: [${abs('/topics.md')}](${abs('/topics.md')}) — list of policy domains.`,
    `- **Glossary**: [${abs('/glossary.md')}](${abs('/glossary.md')}) — definitions of policy and economics terms.`,
    `- **About**: [${abs('/about.md')}](${abs('/about.md')}) — Liberty Lighthouse and the Centre for Civil Society.`,
    '',
    '## Markdown convention',
    '',
    'Every public page on this site has a markdown sibling — append `.md` to any URL. For example:',
    '',
    `- HTML: ${abs('/topics/agriculture/')}`,
    `- Markdown: ${abs('/topics/agriculture.md')}`,
    '',
    'For a single-file dump of an entire topic, use the topic\'s `llms-full.txt` (e.g. `/topics/agriculture/llms-full.txt`). For everything in one file while the corpus is small, use `/llms-full.txt`.',
    '',
  ];

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
