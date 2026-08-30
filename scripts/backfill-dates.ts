/**
 * backfill-dates.ts
 *
 * Remplit la propriété "Date" avec la date de création de la page,
 * pour les fiches où elle est vide.
 *
 * Usage :
 *   NOTION_TOKEN=… npx tsx scripts/backfill-dates.ts          # dry run, n'écrit rien
 *   NOTION_TOKEN=… npx tsx scripts/backfill-dates.ts --apply  # écrit
 *
 * Lire la sortie du dry run avant de lancer --apply.
 */

import { Client } from "@notionhq/client";

const DATA_SOURCE_ID = "aa33d193-efd9-4085-83fd-573937bfd863";
const DATE_PROP = "Date";
const TITLE_PROP = "Solution Gen AI";

const APPLY = process.argv.includes("--apply");

const notion = new Client({ auth: process.env.NOTION_TOKEN });

if (!process.env.NOTION_TOKEN) {
  console.error("NOTION_TOKEN manquant.");
  process.exit(1);
}

type Target = { id: string; title: string; createdTime: string; date: string };

async function collectTargets(): Promise<Target[]> {
  const targets: Target[] = [];
  let cursor: string | undefined;

  do {
    // SDK v5.x : dataSources.query, pas databases.query
    const res = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: { property: DATE_PROP, date: { is_empty: true } },
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of res.results as any[]) {
      const createdTime: string = page.created_time;
      targets.push({
        id: page.id,
        title:
          page.properties?.[TITLE_PROP]?.title?.[0]?.plain_text ?? "(sans titre)",
        createdTime,
        date: createdTime.slice(0, 10), // YYYY-MM-DD, cohérent avec une saisie manuelle
      });
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return targets;
}

async function main() {
  const targets = await collectTargets();

  console.log(`${targets.length} fiche(s) sans Date.\n`);

  // Récapitulatif par mois, pour repérer une anomalie avant d'écrire
  const byMonth = new Map<string, number>();
  for (const t of targets) {
    const m = t.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  console.log("Répartition des dates qui seraient écrites :");
  for (const [month, n] of [...byMonth].sort()) {
    console.log(`  ${month}  ${String(n).padStart(3)}`);
  }
  console.log();

  for (const t of targets) {
    console.log(`  ${t.date}  ${t.title}`);
  }
  console.log();

  if (!APPLY) {
    console.log("Dry run. Rien n'a été écrit. Relancer avec --apply pour appliquer.");
    return;
  }

  let ok = 0;
  const failures: { title: string; error: string }[] = [];

  for (const t of targets) {
    try {
      await notion.pages.update({
        page_id: t.id,
        properties: { [DATE_PROP]: { date: { start: t.date } } },
      });
      ok++;
      process.stdout.write(`\r${ok}/${targets.length}`);
      await new Promise((r) => setTimeout(r, 350)); // ~3 req/s, limite Notion
    } catch (e: any) {
      failures.push({ title: t.title, error: e?.message ?? String(e) });
    }
  }

  console.log(`\n\n${ok} fiche(s) mise(s) à jour.`);

  if (failures.length) {
    console.log(`${failures.length} échec(s) :`);
    for (const f of failures) console.log(`  ${f.title} — ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
