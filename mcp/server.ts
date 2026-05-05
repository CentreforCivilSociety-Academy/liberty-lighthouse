#!/usr/bin/env -S tsx
/**
 * Liberty Lighthouse MCP server.
 *
 * Exposes the agent-readable corpus surface (/llms.txt, /.md siblings,
 * /llms-full.txt) as MCP tools so any MCP client (Claude Desktop, the
 * MCP inspector, etc.) can navigate the corpus without manually fetching
 * URLs.
 *
 * Transport: stdio. To connect from Claude Desktop, add to
 * ~/Library/Application Support/Claude/claude_desktop_config.json:
 *
 *   "liberty-lighthouse": {
 *     "command": "npx",
 *     "args": ["-y", "tsx", "/absolute/path/to/mcp/server.ts"],
 *     "env": {
 *       "LIGHTHOUSE_BASE_URL": "https://liberty-lighthouse.vercel.app"
 *     }
 *   }
 *
 * For local testing against the dev server, set LIGHTHOUSE_BASE_URL to
 * http://localhost:3219.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.LIGHTHOUSE_BASE_URL || 'https://liberty-lighthouse.vercel.app').replace(/\/$/, '');
const USER_AGENT = 'liberty-lighthouse-mcp/0.1.0';

async function fetchText(path: string): Promise<string> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) {
    throw new Error(`GET ${url} → ${r.status} ${r.statusText}`);
  }
  return r.text();
}

function isOnSite(url: string): boolean {
  try {
    const u = new URL(url, BASE_URL);
    const base = new URL(BASE_URL);
    return u.hostname === base.hostname || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function asTextResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

const server = new McpServer({
  name: 'liberty-lighthouse',
  version: '0.1.0',
});

server.registerTool(
  'read_index',
  {
    title: 'Read corpus index and schema',
    description:
      "Fetch /llms.txt (curated index of topics and entry points) and /AGENTS.md (citation rules, URL conventions, frontmatter shape). Always call this first when starting a conversation about Liberty Lighthouse — orients you to what's in the corpus and how to navigate it.",
    inputSchema: {},
  },
  async () => {
    const [llms, agents] = await Promise.all([fetchText('/llms.txt'), fetchText('/AGENTS.md')]);
    return asTextResult(
      `# /llms.txt\n\n${llms}\n\n---\n\n# /AGENTS.md\n\n${agents}`,
    );
  },
);

server.registerTool(
  'get_page',
  {
    title: 'Fetch a page by URL',
    description:
      "Fetch the markdown for any URL on the Liberty Lighthouse site. Append .md to any HTML URL to get its markdown sibling. Use this to read individual FAQs, videos, glossary terms, or external posts after picking them from search/list results.",
    inputSchema: {
      url: z
        .string()
        .describe('Absolute or path-relative URL on liberty-lighthouse.vercel.app. Append .md for markdown siblings.'),
    },
  },
  async ({ url }) => {
    if (!isOnSite(url)) {
      return asTextResult(`error: refusing to fetch off-site URL: ${url}`);
    }
    try {
      const text = await fetchText(url);
      return asTextResult(text);
    } catch (err) {
      return asTextResult(`error: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  'search_corpus',
  {
    title: 'Search the corpus',
    description:
      'Naive substring search across the entire corpus (FAQs, videos, glossary, syllabi, federated external sources). Returns matching headings with their URLs and a snippet. Case-insensitive. For best results, use a distinctive multi-word query.',
    inputSchema: {
      query: z.string().describe('Search query, 2+ words ideal.'),
      limit: z.number().int().positive().max(50).optional().describe('Max results (default 10).'),
    },
  },
  async ({ query, limit }) => {
    const max = limit ?? 10;
    const q = query.trim().toLowerCase();
    if (q.length < 2) return asTextResult('query too short');
    const text = await fetchText('/llms-full.txt');
    const lines = text.split('\n');

    interface Hit {
      heading: string;
      sourceUrl: string;
      snippet: string;
    }
    const hits: Hit[] = [];
    let currentHeading = '';
    let currentSource = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = /^#{2,4}\s+(.+)/.exec(line);
      if (headingMatch) {
        currentHeading = headingMatch[1].trim();
        // Look ahead a few lines for a "Source: <url>" line.
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const m = /^Source:\s*(\S+)/i.exec(lines[j]);
          if (m) {
            currentSource = m[1];
            break;
          }
        }
        continue;
      }
      if (!line.toLowerCase().includes(q)) continue;
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 2);
      const snippet = lines.slice(start, end).join(' ').replace(/\s+/g, ' ').trim().slice(0, 280);
      hits.push({ heading: currentHeading, sourceUrl: currentSource, snippet });
      if (hits.length >= max) break;
    }

    if (hits.length === 0) return asTextResult(`No results for "${query}".`);
    const formatted = hits
      .map((h, idx) => `${idx + 1}. ${h.heading}\n   ${h.sourceUrl}\n   "${h.snippet}"`)
      .join('\n\n');
    return asTextResult(`Found ${hits.length} match(es) for "${query}":\n\n${formatted}`);
  },
);

server.registerTool(
  'list_topics',
  {
    title: 'List all topics',
    description:
      'List every topic in the corpus with its description. Each topic links to a markdown landing page that lists its FAQs, videos, and syllabus.',
    inputSchema: {},
  },
  async () => {
    const text = await fetchText('/topics.md');
    return asTextResult(text);
  },
);

server.registerTool(
  'list_glossary',
  {
    title: 'List glossary terms',
    description:
      'List every glossary term with its short definition. If `query` is provided, filters to terms whose name or aliases match (case-insensitive substring).',
    inputSchema: {
      query: z.string().optional().describe('Optional substring to filter terms.'),
    },
  },
  async ({ query }) => {
    const text = await fetchText('/glossary.md');
    if (!query) return asTextResult(text);
    const q = query.toLowerCase();
    const lines = text.split('\n');
    const filtered = lines.filter((l) => !l.startsWith('- ') || l.toLowerCase().includes(q));
    return asTextResult(filtered.join('\n'));
  },
);

server.registerTool(
  'list_topic_content',
  {
    title: 'List a topic\'s FAQs, videos, or syllabus',
    description:
      'Fetch the FAQ list, video list, or syllabus for a single topic. Use the slug from list_topics (e.g. "agriculture", "education").',
    inputSchema: {
      topic_slug: z.string().describe('Topic slug, e.g. "agriculture".'),
      kind: z.enum(['faq', 'videos', 'syllabus']).describe('Which content list to fetch.'),
    },
  },
  async ({ topic_slug, kind }) => {
    const text = await fetchText(`/topics/${topic_slug}/${kind}.md`);
    return asTextResult(text);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
// eslint-disable-next-line no-console
console.error(`[mcp] liberty-lighthouse server connected. base=${BASE_URL}`);
