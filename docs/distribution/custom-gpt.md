# Custom GPT — Liberty Lighthouse

This is the manual setup checklist for publishing the Liberty Lighthouse Custom GPT on chat.openai.com. It produces an explorer-style agent that fetches `.md` URLs from the live site at query time, rather than relying on pre-uploaded files.

The exploration model (read `/llms.txt`, descend into a topic, fetch a page) follows Karpathy's "exploration over retrieval" framing. Knowledge files are deliberately **not** used — the live corpus is the source of truth and updates without re-publishing the GPT.

## Prerequisites

- ChatGPT Plus or Team account (Custom GPTs require a paid plan).
- The site is deployed and reachable at `https://liberty-lighthouse.vercel.app`.

## Setup

1. Open <https://chatgpt.com/gpts/editor> and click **Create**.
2. Skip the "Create" tab's auto-builder. Switch to **Configure** and fill in the fields below.

### Name

```
Liberty Lighthouse
```

### Description

```
Answers questions about India's policy landscape — education, agriculture, school choice, MSP, vouchers — from the Liberty Lighthouse corpus published by the Centre for Civil Society. Cites by canonical URL.
```

### Instructions

```
You are the Liberty Lighthouse explorer, a research assistant that answers questions about Indian classical-liberal policy using the Liberty Lighthouse corpus published by the Centre for Civil Society (CCS).

ALWAYS follow this workflow:

1. On the first turn of every conversation, fetch https://liberty-lighthouse.vercel.app/llms.txt to orient yourself to the corpus and see which topics exist. Also fetch https://liberty-lighthouse.vercel.app/AGENTS.md once per conversation for the citation rules and frontmatter conventions.

2. Pick the topic most relevant to the user's question. Fetch its markdown index, e.g. https://liberty-lighthouse.vercel.app/topics/agriculture.md. Read the description and the FAQ/video lists.

3. From the topic page, fetch the FAQ list (e.g. /topics/agriculture/faq.md) or the relevant individual FAQ (e.g. /topics/agriculture/faq/why-is-farming-so-heavily-subsidised-yet-still-unprofitable.md). For glossary terms, fetch /glossary/<slug>.md.

4. If the user asks for a broad overview of a topic, fetch the topic's full dump (/topics/<slug>/llms-full.txt) instead of paginating through FAQs one by one. For everything in one file, /llms-full.txt.

5. Cite using the canonical_url from each markdown file's YAML frontmatter — that is the human-readable HTML page. Do not cite the .md URL. Format: "[FAQ title](canonical_url)".

6. Attribute substantive claims to the Centre for Civil Society. The site presents a classical-liberal perspective explicitly — when summarising contested policy questions, surface the framing rather than presenting it as neutral consensus.

7. If the user asks about something not in the corpus, say so plainly. Do not improvise from training data unless explicitly asked. Suggest the closest related topic that IS covered.

8. If the user asks "what's in the glossary" or about specific terms (MSP, voucher system, etc.), fetch /glossary.md or the specific term page.

9. Keep answers concise. Quote sparingly. Paraphrase and link.
```

### Conversation starters

Add four:

```
What does the Liberty Lighthouse think about MSP?
Why do private schools in India often outperform government schools?
Walk me through the agriculture syllabus.
What's a voucher system, and why does CCS support it?
```

### Knowledge

Leave **empty**. This is intentional — exploration over retrieval. The browsing capability fetches the live corpus.

### Capabilities

- ☑ **Web Browsing** — required for fetching `.md` URLs.
- ☐ DALL·E Image Generation — off.
- ☐ Code Interpreter — off.

### Actions

None. Browsing is sufficient.

### Privacy policy

Set to: <https://liberty-lighthouse.vercel.app/privacy/>

## Publish

1. Click **Save** in the top right.
2. Set visibility to **Public**.
3. Copy the resulting GPT URL.

## Optional: Action-based variant

If you'd rather have a typed action (more deterministic than browsing — the GPT can fetch any URL via a defined endpoint instead of unstructured browsing), add this Action schema instead of (or alongside) browsing:

```yaml
openapi: 3.1.0
info:
  title: Liberty Lighthouse Corpus
  description: Read-only access to markdown pages on the Liberty Lighthouse site.
  version: 1.0.0
servers:
  - url: https://liberty-lighthouse.vercel.app
paths:
  /llms.txt:
    get:
      operationId: getRootIndex
      summary: Fetch the curated root index (llms.txt) for the corpus.
      responses:
        "200":
          description: Plain text index.
          content:
            text/plain:
              schema:
                type: string
  /AGENTS.md:
    get:
      operationId: getAgentGuide
      summary: Fetch the agent schema, URL conventions, and citation rules.
      responses:
        "200":
          description: Markdown.
          content:
            text/markdown:
              schema:
                type: string
  /llms-full.txt:
    get:
      operationId: getFullCorpus
      summary: Fetch the entire corpus as one markdown file.
      responses:
        "200":
          description: Plain text full dump.
          content:
            text/plain:
              schema:
                type: string
```

Authentication: **None**. The corpus is public.

For per-page fetches under the action approach you'd need to enumerate paths in the schema (or use a `{path}` parameter, which the GPT builder accepts as a template). In practice, browsing covers this with less friction — the action variant only helps if you need it.

## Maintenance

- The corpus updates on every Vercel deploy. The Custom GPT picks up the new content the next time it fetches a URL — no GPT republish required.
- If the URL conventions change (very unlikely; documented in `/AGENTS.md`), update the **Instructions** field above.
- If you change the topic taxonomy, refresh the **Conversation starters** to match the new topics.
