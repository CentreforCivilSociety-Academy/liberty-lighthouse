/**
 * MCP tool registry.
 *
 * Five tools matching the public agents API. Each tool's callback awaits
 * the matching handler from src/lib/agents-api/handlers/ and wraps the
 * result in an MCP-shaped { content: [{type:'text', text: <json>}] }
 * envelope. AgentError throws are converted via mcpToolError.
 *
 * The MCP SDK's registerTool() expects a Zod raw shape (a Record of
 * validators). We use the same `z` import that mcp/server.ts uses.
 */
import { z } from 'zod';
import type { ContentKind } from '../../agent-search/types.js';
import { handleReadIndex } from '../handlers/read-index.js';
import { handleSearch } from '../handlers/search.js';
import { handleFetch } from '../handlers/fetch.js';
import { handleListGlossary } from '../handlers/list-glossary.js';
import { handleListTopics } from '../handlers/list-topics.js';
import { mcpToolError } from './errors.js';

interface McpResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

interface McpToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  callback: (args: Record<string, unknown>) => Promise<McpResult>;
}

function ok(payload: unknown): McpResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

const VALID_KINDS = [
  'topic',
  'faq',
  'video',
  'glossary',
  'wiki',
  'external',
  'syllabus',
] as const satisfies readonly ContentKind[];

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'read_index',
    title: 'Read corpus index and schema',
    description:
      'Fetch the curated /llms.txt index, /AGENTS.md schema, and a corpus summary. Always call this first when starting a conversation about Liberty Lighthouse — it orients you to the topics, citation rules, and how to navigate the corpus.',
    inputSchema: {},
    callback: async () => {
      try {
        return ok(await handleReadIndex());
      } catch (err) {
        return mcpToolError(err);
      }
    },
  },
  {
    name: 'search',
    title: 'Search the corpus',
    description:
      'BM25 search over the entire corpus (topics, FAQs, videos, glossary, wiki, external posts). Returns ranked hits with snippets and citation blocks. Use distinctive multi-word queries for best results.',
    inputSchema: {
      query: z.string().describe('Search query, ideally 2+ words.'),
      k: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .describe('Max hits (default 10, max 25).'),
      kinds: z
        .array(z.enum(VALID_KINDS))
        .optional()
        .describe(
          `Restrict to specific content kinds (one or more of: ${VALID_KINDS.join(', ')}).`,
        ),
    },
    callback: async (args) => {
      try {
        return ok(
          await handleSearch({
            query: (args.query as string) ?? '',
            k: args.k as number | undefined,
            kinds: args.kinds as ContentKind[] | undefined,
          }),
        );
      } catch (err) {
        return mcpToolError(err);
      }
    },
  },
  {
    name: 'fetch',
    title: 'Fetch a markdown page by URL',
    description:
      "Fetch the markdown content of any URL on the Liberty Lighthouse domain. Returns markdown body plus a citation block built from frontmatter. Use this after `search` returns hits — fetch the .md URL of any hit to read its full content. Refuses off-site URLs.",
    inputSchema: {
      url: z
        .string()
        .describe(
          'Absolute URL on liberty-lighthouse.vercel.app (or localhost in dev). Append .md to any HTML URL for the markdown sibling.',
        ),
    },
    callback: async (args) => {
      try {
        return ok(await handleFetch({ url: (args.url as string) ?? '' }));
      } catch (err) {
        return mcpToolError(err);
      }
    },
  },
  {
    name: 'list_glossary',
    title: 'List glossary terms',
    description:
      'Enumerate glossary terms with their short definitions. Optional case-insensitive substring filter on term + definition. Useful for definition-style questions ("what does CCS mean by MSP?") where a tight definition is the primary answer.',
    inputSchema: {
      filter: z
        .string()
        .optional()
        .describe('Optional substring filter (case-insensitive).'),
    },
    callback: async (args) => {
      try {
        return ok(
          await handleListGlossary({
            filter: args.filter as string | undefined,
          }),
        );
      } catch (err) {
        return mcpToolError(err);
      }
    },
  },
  {
    name: 'list_topics',
    title: 'List topics',
    description:
      'Enumerate the top-level policy topics covered by the corpus. Each topic comes with a description, FAQ + video counts, and a citation. Useful as a high-level navigation step after `read_index`.',
    inputSchema: {},
    callback: async () => {
      try {
        return ok(await handleListTopics());
      } catch (err) {
        return mcpToolError(err);
      }
    },
  },
];
