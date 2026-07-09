# Paalam dataset

Clean parsed victim records live here.

- `victims.jsonl` — one JSON object per victim (committed output; may start empty)
- `state.json` — discovery + progress tracker

HTML is fetched into `data/cache/paalam/` temporarily during ingest and deleted afterward. That cache is gitignored.

## Empty on purpose

An empty `victims.jsonl` / blank discovery state is the intended starting point after the parser-first rewrite. Old AI extracts and committed HTML snapshots were removed. Rebuild with `pnpm discover:paalam` then repeated `pnpm ingest:paalam` runs.
