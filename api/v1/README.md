# /api/v1 — Public Agents API

Vercel-native serverless functions exposing the Liberty Lighthouse corpus to AI agents.

## Endpoints

| Method | Path | Tool |
|---|---|---|
| GET | `/api/v1/index` | read_index |
| GET | `/api/v1/search?q=&k=10&kinds=faq,glossary` | search |
| GET | `/api/v1/fetch?url=...` | fetch |
| GET | `/api/v1/glossary?filter=...` | list_glossary |
| GET | `/api/v1/topics` | list_topics |

Public. Anonymous. Returns JSON. CORS open. Citation contract per [/AGENTS.md](https://liberty-lighthouse.vercel.app/AGENTS.md).

## First-deploy verification

The BM25 index is built at `npm run build` time into `src/lib/agent-search/_generated/index.json`. The runtime loader (`src/lib/agent-search/load-index.ts`) dynamic-imports it via `import('./_generated/index.json')`. **Vercel's bundler must trace and include the JSON file in the function output**, or the first call to `/api/v1/search` will throw "module not found."

Additionally, handlers read first-party content (`src/content/{topics,glossary,faqs,videos}/**`) via `import.meta.url`-anchored paths. `vercel.json` declares an `includeFiles` glob to bundle these into every `api/v1/*.ts` function.

After the first Vercel preview deploy:

1. Open the deployment in the Vercel dashboard.
2. Navigate to the function for `/api/v1/search`.
3. Inspect the bundled output — `_generated/index.json` and `src/content/{topics,glossary,faqs,videos}/...` should both be present.
4. Smoke-test: `curl '<deploy-url>/api/v1/search?q=msp'` should return JSON with `hits`.
5. Smoke-test: `curl '<deploy-url>/api/v1/topics'` should return non-empty topics array.

If the JSON isn't bundled (rare but possible for some adapter configurations), the fallback is to publish the index as a static asset under `public/` and have `load-index.ts` fetch it via HTTP.

## Local development

The wrappers run against `src/content/` directly via `import.meta.url`-anchored paths. Run a smoke test locally:

```bash
npm run build:agent-index   # build the BM25 index
npm test -- tests/agents-api/   # full handler+wrapper coverage
```

There is no local equivalent of the Vercel function runtime in this phase. Phase 3's MCP transport will share the same handlers and is testable via `npx @modelcontextprotocol/inspector`.

## OPTIONS preflight

The wrappers handle `OPTIONS` preflight requests (returning 204 + CORS headers) so browser callers from cross-origin pages work without preflight failures.

## Future: POST endpoints

Currently all endpoints are GET. When POST endpoints are added (e.g. for Phase 3's MCP transport at `/api/v1/mcp`), the OPTIONS preflight handling already in place will continue to work — the `Access-Control-Allow-Methods` header lists `GET, OPTIONS` today and would need `POST` added at that point.

## MCP transport

`POST /api/v1/mcp` is a Streamable HTTP MCP transport exposing the same five tools (`read_index`, `search`, `fetch`, `list_glossary`, `list_topics`). Stateless mode — each request gets its own `McpServer` instance.

### Verifying the deployed endpoint

```bash
npx @modelcontextprotocol/inspector https://liberty-lighthouse.vercel.app/api/v1/mcp
```

The inspector will list 5 tools and let you invoke each. Smoke-test each one and confirm the JSON payloads match the `read_index` / `search` / etc. shapes documented in `docs/agents-api.md` §5.

### Connecting a client

**Claude Desktop / Claude Code (HTTP transport, when supported):** add to the MCP config:

```json
{
  "mcpServers": {
    "liberty-lighthouse": {
      "transport": "http",
      "url": "https://liberty-lighthouse.vercel.app/api/v1/mcp"
    }
  }
}
```

**Cursor / Cline / Continue:** consult the tool's docs for HTTP MCP transport configuration. Most accept the URL directly.

**claude.com/connectors:** submit `https://liberty-lighthouse.vercel.app/api/v1/mcp` for one-click installation. Anonymous access (no auth header required).

### Stdio variant

A separate stdio-based MCP server lives at [mcp/server.ts](../mcp/server.ts) and continues to work as-is. It uses an older substring search and a slightly different tool surface (six tools including `list_topic_content`). Until that file is refactored to share this phase's tool registry, prefer the HTTP transport for new integrations.
