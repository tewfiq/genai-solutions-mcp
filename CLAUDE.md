# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that exposes a curated database of 1,100+ generative AI solutions. Built with TypeScript, the `@modelcontextprotocol/sdk`, and Zod for input validation. Data comes from a private Notion database synced to a committed JSON snapshot (`data/solutions.json`).

## Commands

```bash
npm run build        # Compile TypeScript (tsc → dist/)
npm start            # Start MCP server (stdio transport)
npm run sync         # Sync Notion → data/solutions.json (requires NOTION_TOKEN + NOTION_DATA_SOURCE_ID)
```

No test suite or linter is configured.

## Architecture

Three source files (~330 lines total):

- **`src/index.ts`** — Server entry point. Registers four MCP tools: `search_solutions`, `get_solution`, `list_categories`, `compare_solutions`. Uses stdio transport.
- **`src/data.ts`** — Defines the `Solution` and `Snapshot` types. Loads `data/solutions.json` once at startup (cached in-memory).
- **`src/search.ts`** — Substring search on name only (exact: +10, partial: +5, curator picks: +0.5 bonus). Filters by type, ecosystem, capabilities, origin, picks-only. Default limit 20, max 100.

Sync script:

- **`scripts/sync-notion.ts`** — Fetches from Notion API with a property whitelist (`KEEP`), generates slug IDs, writes the snapshot. Maintainer-only.

## Key Design Decisions

- **Committed snapshot, not live proxy** — `data/solutions.json` is versioned in git. No credentials needed to run.
- **Linear substring scan, not vector embeddings** — Deterministic, sub-millisecond over ~1,100 records. Avoids embedding costs and non-determinism.
- **Projected search results** — `search_solutions` returns light objects (id, name, type, url). Use `get_solution` for full records. Reduces context consumption for AI agents.
- **Property whitelist in sync** — Only explicitly named Notion properties are exported to prevent leaking private workflow state.

## Data Model

```typescript
interface Solution {
  id: string;             // Slug from name (kebab-case)
  name: string;
  url: string | null;
  type: string | null;    // Single category (e.g., "Design", "Code", "Writing")
  ecosystems: Ecosystem[];     // "Anthropic" | "OpenAI" | "Google" | "Ollama"
  capabilities: string[];     // "API" | "Open Source" | "Local" | "Terminal" | "Installation" | "HF"
  origin: string[];           // "France" | "EMEA" | "China" | "YC"
  hasOutput: boolean;
  pick: boolean;              // Curator's top picks
  added: string | null;       // YYYY-MM-DD
}
```

## MCP Client Registration

```json
{
  "mcpServers": {
    "genai-solutions": {
      "command": "node",
      "args": ["/absolute/path/to/genai-solutions-mcp/dist/src/index.js"]
    }
  }
}
```
