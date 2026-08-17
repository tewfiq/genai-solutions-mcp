/**
 * Notion → data/solutions.json
 *
 * Maintainer-only. The server never talks to Notion: it reads the committed
 * snapshot, so anyone can clone the repo and run it with no credentials.
 *
 *   NOTION_TOKEN=ntn_… NOTION_DATA_SOURCE_ID=… npm run sync
 *
 * Only the properties in KEEP below are exported. Everything else — internal
 * workflow state, attached files, the database title itself — is dropped.
 */
import { Client } from "@notionhq/client";
import { writeFileSync } from "node:fs";
import { Solution, Ecosystem, Snapshot } from "../src/data.js";

const token = process.env.NOTION_TOKEN;
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
if (!token || !dataSourceId) {
  console.error("Set NOTION_TOKEN and NOTION_DATA_SOURCE_ID.");
  process.exit(1);
}
const dsId: string = dataSourceId;

const KEEP = {
  title: "Solution Gen AI",
  url: "URL",
  summary: "AI summary",
  type: "Type",
  date: "Date",
  ecosystems: ["Anthropic", "OpenAI", "Google", "Ollama"] as const,
  output: "Output",
  capabilities: ["API", "Open Source", "Local", "Terminal", "Installation", "HF"],
  origin: ["France", "EMEA", "China", "YC"],
  pick: "Top darling"
};

const notion = new Client({ auth: token });

const plain = (p: any): string =>
  (p?.title ?? p?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();

const isYes = (p: any): boolean =>
  p?.type === "checkbox" ? !!p.checkbox : p?.select?.name === "Yes";

/** Notion's Type list has casing duplicates (Gov/gov, Sound/sound). Fold them. */
const canonType = (raw: string | null): string | null => {
  if (!raw) return null;
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const slug = (name: string, taken: Set<string>): string => {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "solution";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
};

async function fetchAll(): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await notion.dataSources.query({
      data_source_id: dsId,
      start_cursor: cursor,
      page_size: 100
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function toSolution(page: any, taken: Set<string>): Solution | null {
  const p = page.properties ?? {};
  const name = plain(p[KEEP.title]);
  if (!name) return null;

  const summary = plain(p[KEEP.summary]);

  return {
    id: slug(name, taken),
    name,
    url: p[KEEP.url]?.url || null,
    summary: summary || null,
    type: canonType(p[KEEP.type]?.select?.name ?? null),
    ecosystems: KEEP.ecosystems.filter((e) => isYes(p[e])) as Ecosystem[],
    capabilities: KEEP.capabilities.filter((c) => isYes(p[c])),
    origin: KEEP.origin.filter((o) => isYes(p[o])),
    hasOutput: isYes(p[KEEP.output]),
    pick: isYes(p[KEEP.pick]),
    added: p[KEEP.date]?.date?.start?.slice(0, 10) ?? null
  };
}

const pages = await fetchAll();
const taken = new Set<string>();
const solutions = pages
  .map((pg) => toSolution(pg, taken))
  .filter((s): s is Solution => s !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

const snapshot: Snapshot = {
  // Fixed label — never carry the Notion database title through.
  source: "Private Notion database, curated since 2023",
  syncedAt: new Date().toISOString().slice(0, 10),
  count: solutions.length,
  solutions
};

writeFileSync("data/solutions.json", JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Wrote ${solutions.length} solutions to data/solutions.json`);
console.log("Review the diff before committing — check for client names or private notes.");