import { Solution, Ecosystem } from "./data.js";

export interface SearchParams {
  query?: string;
  type?: string;
  ecosystem?: Ecosystem;
  capabilities?: string[];
  origin?: string[];
  picksOnly?: boolean;
  limit?: number;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Substring matching over name. Deliberately not embeddings:
 * the corpus is ~1,100 records, so a linear scan is sub-millisecond and
 * gives deterministic, explainable results with no index to keep in sync.
 */
export function search(all: Solution[], p: SearchParams): Solution[] {
  const limit = Math.min(Math.max(p.limit ?? 20, 1), 100);
  const terms = p.query ? norm(p.query).split(/\s+/).filter(Boolean) : [];
  const wantedType = p.type ? norm(p.type) : null;
  const caps = (p.capabilities ?? []).map(norm);
  const origins = (p.origin ?? []).map(norm);

  const scored: Array<{ s: Solution; score: number }> = [];

  for (const s of all) {
    if (p.picksOnly && !s.pick) continue;
    if (wantedType && norm(s.type ?? "") !== wantedType) continue;
    if (p.ecosystem && !s.ecosystems.includes(p.ecosystem)) continue;
    if (caps.length && !caps.every((c) => s.capabilities.some((x) => norm(x) === c))) continue;
    if (origins.length && !origins.every((o) => s.origin.some((x) => norm(x) === o))) continue;

    let score = 0;
    if (terms.length) {
      const name = norm(s.name);
      for (const t of terms) {
        if (name === t) score += 10;
        else if (name.includes(t)) score += 5;
        else { score = -1; break; }
      }
      if (score < 0) continue;
    }
    if (s.pick) score += 0.5;
    scored.push({ s, score });
  }

  scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((x) => x.s);
}

export function categories(all: Solution[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of all) {
    if (!s.type) continue;
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}
