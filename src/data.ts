import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export type Ecosystem = "Anthropic" | "OpenAI" | "Google" | "Ollama";

export interface Solution {
  id: string;
  name: string;
  url: string | null;
  summary: string | null;
  type: string | null;
  ecosystems: Ecosystem[];
  capabilities: string[];
  origin: string[];
  hasOutput: boolean;
  pick: boolean;
  added: string | null;
}

export interface Snapshot {
  source: string;
  syncedAt: string;
  count: number;
  solutions: Solution[];
}

/** Short projection returned by search — keeps agent context small. */
export type SolutionSummary = Pick<Solution, "id" | "name" | "type" | "summary" | "url">;

export function project(s: Solution): SolutionSummary {
  return { id: s.id, name: s.name, type: s.type, summary: s.summary, url: s.url };
}

let cache: Snapshot | null = null;

export function loadSnapshot(): Snapshot {
  if (cache) return cache;
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "data", "solutions.json");
  const raw = readFileSync(path, "utf8");
  cache = JSON.parse(raw) as Snapshot;
  return cache;
}
