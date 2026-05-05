# Liberty Lighthouse MCP server

A Model Context Protocol server that exposes the Liberty Lighthouse corpus as tools any MCP client (Claude Desktop, the MCP inspector, custom agents) can invoke. It wraps the agent-readable surface — `/llms.txt`, `/AGENTS.md`, `.md` siblings, `/llms-full.txt` — so clients don't have to fetch URLs manually.

## Tools

| Tool | Purpose |
|---|---|
| `read_index` | Fetch `/llms.txt` + `/AGENTS.md`. Always call this first. |
| `get_page` | Fetch any URL on the site (validated against the lighthouse domain). |
| `search_corpus` | Naive substring search across `/llms-full.txt`. |
| `list_topics` | Topic landing pages with descriptions. |
| `list_glossary` | All glossary terms (with optional substring filter). |
| `list_topic_content` | FAQ list, video list, or syllabus for one topic. |

## Run locally

```bash
# Against the deployed site (default)
npm run mcp:start

# Against a local dev server (for testing recent changes)
LIGHTHOUSE_BASE_URL=http://localhost:3219 npm run mcp:start

# Smoke test: spawn the server, list tools, invoke each, print results
npm run mcp:test
LIGHTHOUSE_BASE_URL=http://localhost:3219 npm run mcp:test
```

The server speaks stdio. It writes a single status line to stderr on startup; everything else is the MCP protocol on stdout.

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "liberty-lighthouse": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/this/repo/mcp/server.ts"],
      "env": {
        "LIGHTHOUSE_BASE_URL": "https://liberty-lighthouse.vercel.app"
      }
    }
  }
}
```

Restart Claude Desktop. The corpus tools will appear in the connector list. Ask things like "What does the Liberty Lighthouse glossary say about MSP?" — Claude will call `list_glossary` or `read_index` first and follow the URLs.

## Test with the MCP inspector

```bash
npx @modelcontextprotocol/inspector tsx mcp/server.ts
```

The inspector opens a web UI that lets you list tools, invoke them with arguments, and inspect responses.

## Hosted deployment (Phase 3)

The current server uses stdio and runs locally beside the user's MCP client. To submit to [claude.com/connectors](https://claude.com/connectors), the same tool definitions need to ship behind a Streamable HTTP transport hosted on Vercel — `/api/mcp/*`. That's tracked as Phase 3 work in the plan; the stdio version is the canonical one for now.
