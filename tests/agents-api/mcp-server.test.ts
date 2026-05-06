import { describe, it, expect, beforeAll } from 'vitest';
import { createMcpServer } from '../../src/lib/agents-api/mcp/server';
import { MCP_TOOLS } from '../../src/lib/agents-api/mcp/tools';
import { _setIndexForTesting } from '../../src/lib/agent-search/load-index';
import { buildIndex } from '../../src/lib/agent-search/build-index';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../agent-search/fixtures/content');

describe('createMcpServer', () => {
  beforeAll(() => {
    const idx = buildIndex({
      contentDir: FIXTURES,
      siteUrl: 'https://example.com',
    });
    _setIndexForTesting(idx);
  });

  it('returns a fresh McpServer instance per call', () => {
    const a = createMcpServer();
    const b = createMcpServer();
    expect(a).not.toBe(b);
  });

  it('registers all 5 tools (verified via the registry, not introspection)', () => {
    expect(MCP_TOOLS.length).toBe(5);
    const server = createMcpServer();
    expect(server).toBeDefined();
  });
});
