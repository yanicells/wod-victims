# Paalam dataset

Clean parsed victim records live here.

- `victims.jsonl` — one JSON object per victim (committed output; may start empty)
- `state.json` — discovery + progress tracker

HTML stays in memory during normal ingest. Passing `--keep-cache` writes it to the gitignored `data/cache/paalam/` folder for local debugging only.

## Empty on purpose

An empty `victims.jsonl` / blank discovery state is the intended starting point after the parser-first rewrite. Old AI extracts and committed HTML snapshots were removed. Rebuild with `pnpm discover:paalam` then repeated `pnpm ingest:paalam` runs.
