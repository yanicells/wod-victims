# Data Pipeline

TypeScript scripts for discovering and parsing Paalam victim profiles into a clean dataset. Parser-first: Cheerio reads labeled HTML fields, no AI extraction for core fields.

Run commands from the repo root:

```text
pnpm discover:paalam                  # find profile URLs
pnpm ingest:paalam -- --limit=20      # fetch in memory, parse, append JSONL
pnpm summary:paalam                   # dataset stats
pnpm test                             # parser unit tests
pnpm check                            # tsc --noEmit
```

## Architecture

```text
discover-paalam.ts   sitemap.xml + WP REST API -> data/paalam/state.json (discoveredUrls)
ingest-paalam.ts     fetch HTML in memory -> parse-paalam-profile.ts -> victims.jsonl
summary-paalam.ts    reads state.json + victims.jsonl -> stats
```

Supporting libs live in `scripts/lib/`. See `scripts/README.md` for the full file list.

## Common flags

```text
ingest:paalam    --limit --delay-ms --timeout-ms --retries
                 --max-consecutive-failures --dry-run --keep-cache --url
discover:paalam  --delay-ms --timeout-ms --rest-page-size --max-rest-pages --dry-run
```

Defaults and semantics are listed in `guide/00_WORKFLOW_GUIDE.md`. Both scripts reject a
malformed numeric flag rather than falling back to the default.

## Data files

```text
data/paalam/state.json      discovered URLs, completed IDs, failed fetches
data/paalam/victims.jsonl   one parsed victim record per line (committed)
data/cache/paalam/          optional `--keep-cache` debugging output — gitignored
```

No raw HTML, raw text snapshots, or free-form narrative are committed. The parser reads each page once and keeps only the structured result. HTML reaches disk only when a developer explicitly uses `--keep-cache` for local debugging.

## Adding a new source later

Each source needs its own discover/ingest pair plus a parser in `lib/` and a record type. Keep the same shape: discover finds URLs, ingest fetches in memory and persists only parsed records, and everything lands in one JSONL per source.
