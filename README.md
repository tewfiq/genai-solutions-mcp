# genai-solutions-mcp

An MCP server that exposes a curated database of generative AI tools —
1,197 records I have maintained in Notion since 2023 — as four tools an
AI assistant can query directly.

Instead of asking a model what AI tools exist and getting a plausible but
stale answer, you ask it to search a dataset that has a person behind it.

```
> Which open-source tools in here run locally and have a CLI?
> Compare Firecrawl and the other scraping options.
```

## Install

```bash
npm install
npm run build
npm start
```

No API key, no network, no database. The dataset ships with the repo.

Register it with an MCP client (Claude Desktop shown here):

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

## Tools


| Tool                | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `search_solutions`  | Free-text + filters (type, ecosystem, capabilities, origin, picks) |
| `get_solution`      | Full record for one id                                             |
| `list_categories`   | Every category with its record count                               |
| `compare_solutions` | 2–4 records aligned on the same fields                             |


## Design decisions

**A committed snapshot, not a live Notion proxy.** The obvious design is to
call the Notion API on every tool call. It is also the one that makes the
repo useless to everyone but me: you would need my token and my database.
Instead, `scripts/sync-notion.ts` exports Notion to `data/solutions.json`,
which is versioned here, and the server only reads that file. The trade-off
is freshness — the data is as current as the last sync — against a server
that anyone can clone and run in fifteen seconds, with no credentials, no
network dependency at call time, and no rate limit. The underlying data
changes weekly at most, so freshness is the cheaper thing to give up.

**Substring search, not embeddings.** ~1,100 records is a sub-millisecond
linear scan. A vector index would add an embedding step to the sync, a
model dependency, non-deterministic results, and an index to keep
consistent with the snapshot — in exchange for semantic recall on a corpus
where the useful queries are mostly names and categories. If the dataset
grows an order of magnitude or the summaries get longer, this is the first
thing to revisit.

**Search returns a projection, not full records.** `search_solutions` returns
only id, name, type and url. Returning complete records for a 20-result
query would spend a large amount of the agent's context on fields it usually
does not need; `get_solution` is there for when it does.

**A property whitelist in the sync, not a blacklist.** The Notion database
contains internal workflow state and attachments that have no business
being public. `scripts/sync-notion.ts` names the properties it exports, so
adding a private column in Notion later cannot silently leak it here.

## Known limitations

- Notion's `Type` is a single select, so each tool has exactly one category
even when two would fit.
- Category values were entered by hand over three years and are uneven; the
sync folds casing duplicates but does not merge near-synonyms.
- No relevance ranking beyond field-weighted substring matching.
- Attribute tagging is uneven. `Local` and `Open Source` were applied at different periods with different habits, and they overlap on only one

    record even though many tools qualify for both. Filters are honest about what is tagged, not about what is true — a property this dataset shares

    with most real internal databases.
- Node resolution depends on the host environment. The server was observed starting under two different Node installations on the same machine depending on the launching context. Pin the runtime path in your client config if that matters to you.

## Syncing (maintainer only)

```bash
NOTION_TOKEN=… NOTION_DATABASE_ID=… npm run sync
git diff data/solutions.json   # read it before committing
```

## License

MIT