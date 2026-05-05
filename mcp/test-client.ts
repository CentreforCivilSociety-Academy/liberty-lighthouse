#!/usr/bin/env -S tsx
/**
 * Smoke test for the Liberty Lighthouse MCP server.
 *
 * Spawns the server via stdio, lists its tools, invokes each with sensible
 * arguments, and prints the results. Exits non-zero on any error so the
 * daily workflow or pre-commit hooks can wire it up later.
 *
 * Usage:
 *   LIGHTHOUSE_BASE_URL=http://localhost:3219 npm run mcp:test
 *
 * The base URL is passed through to the spawned server. Default points at
 * the deployed site, but you'll usually want localhost while iterating.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';

const TRUNCATE = 600;

function truncate(s: string): string {
  if (s.length <= TRUNCATE) return s;
  return s.slice(0, TRUNCATE) + `\n... [truncated, ${s.length} chars total]`;
}

function header(title: string): string {
  return `\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`;
}

async function main() {
  const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? 'https://liberty-lighthouse.vercel.app';
  // eslint-disable-next-line no-console
  console.log(`testing MCP server against base=${baseUrl}`);

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'tsx', resolve(process.cwd(), 'mcp/server.ts')],
    env: { ...process.env, LIGHTHOUSE_BASE_URL: baseUrl },
  });

  const client = new Client({ name: 'liberty-lighthouse-test', version: '0.1.0' });
  await client.connect(transport);

  let failures = 0;

  // List tools.
  console.log(header('list_tools'));
  const tools = await client.listTools();
  console.log(`registered tools: ${tools.tools.map((t) => t.name).join(', ')}`);
  if (tools.tools.length === 0) {
    console.error('FAIL: no tools registered');
    failures++;
  }

  type Step = { tool: string; args: Record<string, unknown>; expectContains?: string };
  const steps: Step[] = [
    { tool: 'read_index', args: {}, expectContains: 'Liberty Lighthouse' },
    { tool: 'list_topics', args: {}, expectContains: 'Agriculture' },
    { tool: 'list_glossary', args: {}, expectContains: 'MSP' },
    { tool: 'list_glossary', args: { query: 'voucher' }, expectContains: 'voucher' },
    { tool: 'list_topic_content', args: { topic_slug: 'agriculture', kind: 'faq' }, expectContains: 'FAQ' },
    { tool: 'search_corpus', args: { query: 'subsidy', limit: 3 }, expectContains: 'subsidy' },
    {
      tool: 'get_page',
      args: { url: '/topics/agriculture.md' },
      expectContains: 'Agriculture',
    },
    {
      tool: 'get_page',
      args: { url: 'https://example.com/evil' },
      expectContains: 'refusing to fetch off-site',
    },
  ];

  for (const step of steps) {
    console.log(header(`call: ${step.tool}(${JSON.stringify(step.args)})`));
    try {
      const result = await client.callTool({ name: step.tool, arguments: step.args });
      const text = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n');
      console.log(truncate(text));
      if (step.expectContains && !text.toLowerCase().includes(step.expectContains.toLowerCase())) {
        console.error(`FAIL: expected output to contain "${step.expectContains}"`);
        failures++;
      } else {
        console.log(`OK${step.expectContains ? ` (matched "${step.expectContains}")` : ''}`);
      }
    } catch (err) {
      console.error(`FAIL: ${(err as Error).message}`);
      failures++;
    }
  }

  await client.close();

  console.log(header('summary'));
  console.log(`steps=${steps.length} failures=${failures}`);
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
