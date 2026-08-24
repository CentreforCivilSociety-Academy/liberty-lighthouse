import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { abs, markdownResponse } from '../lib/markdown-export';

// Mirror of src/pages/about.astro. When the prose changes, update both.
export const GET: APIRoute = async () => {
  const fm = {
    type: 'about',
    title: 'About Liberty Lighthouse',
    canonical_url: abs('/about/'),
    markdown_url: abs('/about.md'),
  };

  const body = `# About Liberty Lighthouse

Liberty Lighthouse is an open educational platform created by the **Centre for Civil Society** (CCS), one of India's leading think tanks. Our mission is to make rigorous policy research accessible to students, educators, journalists, and engaged citizens.

## What you'll find here

Liberty Lighthouse organises knowledge across policy topics through three complementary formats:

- **Frequently Asked Questions** — concise, expert-written answers to common policy questions, each grounded in research and evidence.
- **Video Curricula** — video resources to simplify Indian policies.
- **Guided Learning** — for those who want to go further, recommended books and readings.

## AI and MCP access

The whole corpus is readable by AI assistants. Every page has a Markdown twin, the full text is published at [/llms-full.txt](/llms-full.txt), and there is a Model Context Protocol endpoint that lets a model search and cite the corpus directly. [How to connect an assistant](/ai/)

## Contact

Questions, corrections, or suggestions: [contact@ccs.in](mailto:contact@ccs.in)

## About the Centre for Civil Society

Founded in 1997, the Centre for Civil Society is an independent, non-partisan think tank that advances social change through public policy. CCS has consistently been ranked among the top think tanks in India and South Asia by the University of Pennsylvania's Global Go To Think Tank Index.

CCS pursues its mission through research, policy engagement, and education — training the next generation of policy leaders through programs like the Researching Reality Internship and iPolicy.

[Visit CCS](https://ccs.in)
`;

  return markdownResponse(matter.stringify(body, fm));
};
