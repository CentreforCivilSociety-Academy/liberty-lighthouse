import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { abs, plainTextResponse } from '../lib/markdown-export';

// Howard-spec llms.txt — see https://llmstxt.org/
// Root index for autonomous agents. Each H2 section is a curated link list.
export const GET: APIRoute = async () => {
  const [topics, spontaneousOrder, ccsBooks, wiki] = await Promise.all([
    getCollection('topics'),
    getCollection('spontaneousOrder'),
    getCollection('ccsBooks'),
    getCollection('wiki', ({ data }) => !data.draft),
  ]);
  const sortedTopics = topics.sort((a, b) => a.data.order - b.data.order);

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

  // Wiki layer — only listed when populated.
  if (wiki.length > 0) {
    lines.push(
      '## Wiki',
      '',
      `- [Wiki index](${abs('/wiki.md')}): auto-generated entity pages, topic summaries, and comparisons (${wiki.length} entries).`,
      `- [Wiki — full content](${abs('/wiki/llms-full.txt')}): every wiki entry in a single file.`,
      '',
    );
  }

  // Federated external sources — only listed when populated.
  if (spontaneousOrder.length > 0 || ccsBooks.length > 0) {
    lines.push('## Federated external sources', '');
    if (spontaneousOrder.length > 0) {
      lines.push(
        `- [Spontaneous Order index](${abs('/external/spontaneous-order.md')}): ${spontaneousOrder.length} posts from CCS's Substack.`,
        `- [Spontaneous Order — full content](${abs('/external/spontaneous-order/llms-full.txt')}): every post in one file.`,
      );
    }
    if (ccsBooks.length > 0) {
      const bookCount = new Set(ccsBooks.map((c) => c.data.book_slug)).size;
      lines.push(
        `- [CCS Books index](${abs('/external/ccs-books.md')}): ${bookCount} book${bookCount === 1 ? '' : 's'}, ${ccsBooks.length} chapter${ccsBooks.length === 1 ? '' : 's'}.`,
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

  return plainTextResponse(lines.join('\n'));
};
