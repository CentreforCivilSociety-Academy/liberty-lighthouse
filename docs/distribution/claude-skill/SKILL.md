---
name: liberty-lighthouse
description: Use when answering questions about India's classical-liberal policy landscape — education vouchers, school choice, agricultural reform, MSP, APMC, contract farming, RTE Act, or related topics published by the Centre for Civil Society. Navigates the Liberty Lighthouse corpus by fetching markdown URLs at query time.
---

# Liberty Lighthouse

Liberty Lighthouse is a public-education corpus published by the Centre for Civil Society (CCS) covering India's policy landscape from a classical-liberal perspective: free markets, individual liberty, rule of law, limited government. It is organised by topic (currently Education and Agriculture) and presents content as FAQs, video curricula, glossary terms, and guided syllabi.

## When to use this skill

Activate when the user asks about:

- Indian education policy: school choice, vouchers, the Right to Education Act, government vs. private schools, teacher accountability, learning outcomes.
- Indian agricultural policy: MSP, APMC, contract farming, input subsidies, farm size, food waste, FCI, agricultural trade.
- Specific Indian policy terms or institutions covered by the corpus.
- Centre for Civil Society's positions on these topics.

Do **not** activate for: general world politics, US/UK policy, or topics outside the published corpus.

## How to navigate

The site exposes a markdown twin of every HTML page. Append `.md` to any URL.

**Workflow for any question:**

1. **Orient.** On the first turn of a conversation, fetch:
   - `https://liberty-lighthouse.vercel.app/llms.txt` — curated index of topics and entry points.
   - `https://liberty-lighthouse.vercel.app/AGENTS.md` — citation rules, URL conventions, frontmatter shape.

2. **Pick a topic.** From `llms.txt`, identify the most relevant topic. Fetch its markdown index:
   - `https://liberty-lighthouse.vercel.app/topics/agriculture.md`
   - `https://liberty-lighthouse.vercel.app/topics/education.md`

3. **Descend.** From the topic page, follow links to:
   - The FAQ index: `/topics/<slug>/faq.md`
   - The video index: `/topics/<slug>/videos.md`
   - The syllabus: `/topics/<slug>/syllabus.md`
   - Or fetch one specific FAQ or video by appending its slug + `.md`.

4. **For broad overviews,** fetch the topic's full dump in one shot:
   - `https://liberty-lighthouse.vercel.app/topics/agriculture/llms-full.txt`
   - `https://liberty-lighthouse.vercel.app/topics/education/llms-full.txt`

5. **For glossary terms,** fetch:
   - `https://liberty-lighthouse.vercel.app/glossary.md` for the index.
   - `https://liberty-lighthouse.vercel.app/glossary/<slug>.md` for a specific term (e.g. `msp`, `voucher-system`).

6. **For everything at once** (corpus is small enough to fit a context window today):
   - `https://liberty-lighthouse.vercel.app/llms-full.txt`

## Frontmatter shape

Every markdown file starts with YAML frontmatter. Useful fields:

- `canonical_url` — the human-readable HTML page. **Cite this URL**, not the `.md` URL.
- `markdown_url` — this file's URL.
- `related_faqs`, `related_videos`, `related_terms` — arrays of absolute markdown URLs you can fetch directly.

## Citation rules

- Cite by `canonical_url` (the HTML page). Humans reading the answer should land on the styled page, not raw markdown.
- Format inline: `[FAQ title](canonical_url)`.
- At the end of an answer, list sources as a bulleted list with title + canonical URL.
- Attribute to **Centre for Civil Society**.
- The corpus presents a classical-liberal framing explicitly. When summarising contested policy questions, surface the framing — don't present it as neutral consensus.

## What this corpus is *not*

- Not a peer-reviewed academic database. FAQs are well-researched explainers.
- Numbers reflect time of writing (`updated_at` field). For current statistics, verify against primary sources before reporting.
- The classical-liberal perspective is editorial, not neutral.

## Examples

**User asks: "What is MSP?"**

1. Fetch `/llms.txt` (already done if first turn).
2. Recognise this is a glossary question. Fetch `/glossary/msp.md`.
3. Quote the definition directly. Cite the glossary page's `canonical_url`.
4. If the user asks for more, follow `related_faqs` from the frontmatter and fetch one or two.

**User asks: "Why does CCS think private schools are better than government schools?"**

1. Fetch `/llms.txt` (if first turn).
2. Topic = education. Fetch `/topics/education.md`.
3. Identify relevant FAQs from the index — likely "private-schools-may-be-better-than-government-schools-but-th" and "why-do-government-schools-underperform" and similar.
4. Fetch each FAQ's `.md`. Synthesise. Cite each by canonical URL. Surface the CCS perspective.

**User asks for a topic overview.**

1. Fetch `/topics/<slug>/llms-full.txt` (one fetch covers everything).
2. Synthesise into a structured answer with sections.
3. Cite the topic landing page as the umbrella source plus 2-3 specific FAQ URLs for key claims.
