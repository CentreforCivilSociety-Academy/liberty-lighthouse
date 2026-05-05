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

Liberty Lighthouse is an open educational platform created by the **Centre for Civil Society** (CCS), one of India's most respected independent think tanks. Our mission is to make rigorous policy research accessible to students, educators, journalists, policymakers, and engaged citizens.

We believe that India's most pressing policy challenges — in education, agriculture, healthcare, governance, and livelihoods — deserve clear, evidence-based analysis grounded in the principles of individual liberty, free markets, rule of law, and limited government.

## What you'll find here

Liberty Lighthouse organises knowledge across policy topics through three complementary formats:

- **Frequently Asked Questions** — concise, expert-written answers to common policy questions, each grounded in research and evidence.
- **Video Curricula** — curated video resources from leading scholars and practitioners, organised into structured learning sequences.
- **Guided Syllabi** — step-by-step learning paths that guide you through a topic, combining readings, key concepts, and discussion questions.

## About the Centre for Civil Society

Founded in 1997, the Centre for Civil Society is an independent, non-partisan think tank that advances social change through public policy. CCS has consistently been ranked among the top think tanks in India and South Asia by the University of Pennsylvania's Global Go To Think Tank Index.

CCS pursues its mission through research, policy engagement, and education — training the next generation of policy leaders through programs like the Researching Reality Internship and iPolicy.

[Visit CCS](https://ccs.in)
`;

  return markdownResponse(matter.stringify(body, fm));
};
