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
// Inlined to keep the agents-api package self-contained and avoid
// crossing the src/lib/ boundary that Vercel's cloud builder mishandles
// (it drops .js extensions during TS compilation, breaking Node ESM
// at runtime). See src/lib/agents-doc.ts for the same workaround.
const SITE_URL = 'https://liberty-lighthouse.vercel.app';
function abs(path: string): string {
  return new URL(path, SITE_URL).href;
}

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
