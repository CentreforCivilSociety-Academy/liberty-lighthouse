import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { abs, markdownResponse } from '../lib/markdown-export';
import { getCorpus } from '../lib/corpus';

/**
 * Markdown twin of /questions/ — every published question, grouped by topic.
 *
 * Every HTML page advertises a .md sibling in its <head>, so moving the index
 * off the homepage needs this, or the link it advertises would 404.
 */
export const GET: APIRoute = async () => {
  const corpus = await getCorpus();

  const fm = {
    type: 'index',
    title: 'All questions',
    canonical_url: abs('/questions/'),
    markdown_url: abs('/questions.md'),
    questions: corpus.totalQuestions,
    topics: corpus.totalThemes,
  };

  const lines: string[] = [
    '# All questions',
    '',
    `${corpus.totalQuestions} questions about Indian policy across ${corpus.totalThemes} topics. Each links to the markdown sibling of its answer.`,
    '',
  ];

  for (const theme of corpus.themes) {
    lines.push(`## ${theme.title}`, '', theme.description.replace(/\s+/g, ' ').trim(), '');
    for (const row of theme.rows) {
      lines.push(`- [${row.question}](${abs(row.href.replace(/\/$/, '') + '.md')})`);
    }
    lines.push('');
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
