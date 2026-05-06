import { describe, it, expect, beforeAll } from 'vitest';
import { MCP_TOOLS } from '../../src/lib/agents-api/mcp/tools';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('MCP_TOOLS registry', () => {
  beforeAll(() => {
    const idx = buildIndex({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    _setIndexForTesting(idx);
  });

  it('exposes exactly five tools', () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual([
      'read_index',
      'search',
      'fetch',
      'list_glossary',
      'list_topics',
    ]);
  });

  it('every tool has a non-empty description and an input schema', () => {
    for (const t of MCP_TOOLS) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toBeDefined();
    }
  });

  describe('tool callbacks', () => {
    function findTool(name: string) {
      const t = MCP_TOOLS.find((x) => x.name === name);
      if (!t) throw new Error(`missing tool ${name}`);
      return t;
    }

    it('read_index returns text content with corpus_summary', async () => {
      const tool = findTool('read_index');
      const result = await tool.callback({});
      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');
      const body = JSON.parse(result.content[0].text);
      expect(typeof body.llms_txt).toBe('string');
      expect(typeof body.agents_md).toBe('string');
      expect(body.corpus_summary).toBeDefined();
    });

    it('search returns a hits array', async () => {
      const tool = findTool('search');
      const result = await tool.callback({ query: 'MSP' });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(body.query).toBe('MSP');
      expect(Array.isArray(body.hits)).toBe(true);
      expect(body.hits.length).toBeGreaterThan(0);
    });

    it('search returns isError on empty query', async () => {
      const tool = findTool('search');
      const result = await tool.callback({ query: '' });
      expect(result.isError).toBe(true);
      const body = JSON.parse(result.content[0].text);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('search returns isError on invalid kind', async () => {
      const tool = findTool('search');
      const result = await tool.callback({
        query: 'msp',
        kinds: ['evil-kind'],
      });
      expect(result.isError).toBe(true);
      const body = JSON.parse(result.content[0].text);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('list_topics returns topics array', async () => {
      const tool = findTool('list_topics');
      const result = await tool.callback({});
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(Array.isArray(body.topics)).toBe(true);
    });

    it('list_glossary returns terms array', async () => {
      const tool = findTool('list_glossary');
      const result = await tool.callback({});
      expect(result.isError).toBeFalsy();
      const body = JSON.parse(result.content[0].text);
      expect(Array.isArray(body.terms)).toBe(true);
    });

    it('fetch returns isError on off-site URL', async () => {
      const tool = findTool('fetch');
      const result = await tool.callback({
        url: 'https://attacker.example.com/evil.md',
      });
      expect(result.isError).toBe(true);
      const body = JSON.parse(result.content[0].text);
      expect(body.error.code).toBe('BAD_REQUEST');
    });
  });
});
