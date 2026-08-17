#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadSnapshot, project, Solution } from "./data.js";
import { search, categories } from "./search.js";

const snapshot = loadSnapshot();
const all: Solution[] = snapshot.solutions;

const server = new McpServer({ name: "genai-solutions", version: "0.1.0" });

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
});

server.registerTool(
  "search_solutions",
  {
    title: "Search GenAI solutions",
    description:
      "Search a curated database of generative AI tools by free text and filters. " +
      "Returns a short projection (id, name, type, url); call get_solution " +
      "with an id for the full record.",
    inputSchema: {
      query: z.string().optional().describe("Free text, matched against name"),
      type: z.string().optional().describe("Category — call list_categories for valid values"),
      ecosystem: z.enum(["Anthropic", "OpenAI", "Google", "Ollama"]).optional(),
      capabilities: z
        .array(z.string())
        .optional()
        .describe("All must match. E.g. API, Open Source, Local, Terminal, Installation, HF"),
      origin: z.array(z.string()).optional().describe("All must match. E.g. France, EMEA, China, YC"),
      picksOnly: z.boolean().optional().describe("Restrict to curator's picks"),
      limit: z.number().int().optional().describe("Default 20, max 100")
    }
  },
  async (args) => {
    const results = search(all, args);
    return json({ count: results.length, results: results.map(project) });
  }
);

server.registerTool(
  "get_solution",
  {
    title: "Get one solution",
    description: "Return the full record for a single solution by id.",
    inputSchema: { id: z.string() }
  },
  async ({ id }) => {
    const found = all.find((s) => s.id === id);
    if (!found) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `No solution with id "${id}".` }]
      };
    }
    return json(found);
  }
);

server.registerTool(
  "list_categories",
  {
    title: "List categories",
    description:
      "Return every category present in the database with its record count, " +
      "so filters can be built against real values rather than guesses.",
    inputSchema: {}
  },
  async () => json({ total: all.length, categories: categories(all) })
);

server.registerTool(
  "compare_solutions",
  {
    title: "Compare solutions",
    description: "Return 2 to 4 solutions side by side on the same fields.",
    inputSchema: { ids: z.array(z.string()).min(2).max(4) }
  },
  async ({ ids }) => {
    const missing = ids.filter((id) => !all.some((s) => s.id === id));
    if (missing.length) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Unknown id(s): ${missing.join(", ")}` }]
      };
    }
    return json(ids.map((id) => all.find((s) => s.id === id)!));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `genai-solutions MCP server ready — ${snapshot.count} solutions, synced ${snapshot.syncedAt}`
);
