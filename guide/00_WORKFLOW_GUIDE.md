# Workflow Guide

Practical "what do I do next?" guide. Parser-first pipeline: discover URLs, fetch + parse each page, append to one JSONL file. No AI extraction for core fields.

## 1. Run the pipeline

```text
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20
pnpm summary:paalam
pnpm test
```

- `discover:paalam` finds new profile URLs from Paalam's sitemap + WordPress REST API and adds them to `data/paalam/state.json`. Safe to rerun; it dedupes.
- `ingest:paalam -- --limit=N` fetches the next N not-yet-completed URLs into memory, parses each with Cheerio, and appends clean records to `data/paalam/victims.jsonl`. Rerun with a higher limit or no limit flag (default 10) to keep going — it skips already-completed URLs automatically, including when you pass `--url=...`.
- `summary:paalam` prints counts: unique victim IDs, row count, how many have a name/date/location/sources/age, and a breakdown of `needsReview` reasons. Exits non-zero if duplicate IDs appear in the JSONL.
- `test` runs parser, URL identity, ingest-selection, and HTTP retry tests. Run this after touching the pipeline.

Useful flags on `ingest:paalam`:

```text
--limit=20            how many profiles to fetch this run (default 10)
--delay-ms=2500        pause between requests (default 2500)
--dry-run              parse and print, write nothing
--keep-cache           write fetched HTML to the gitignored cache (debugging only)
--url=<full url>       ingest one specific URL (still skips if already completed)
```

## 1b. Clean-slate rebuild (intentional)

This branch starts with an empty `data/paalam/victims.jsonl`. That is deliberate: the old AI-extraction corpus and committed HTML snapshots were removed so the repo stays small and the parser-first path is the only source of truth.

Rebuild coverage with:

```text
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20 --delay-ms=3000
# repeat until summary shows the coverage you want
pnpm summary:paalam
```

Do not expect the old 72 AI-extracted rows to still exist on disk. Re-ingest regenerates clean records from live Paalam pages.
## 2. Double-check after each ingest run

- `pnpm summary:paalam` — did the victim count go up by roughly the batch size?
- Skim the `needs_review` reason counts. If one reason spikes (e.g. `missing_location`), check whether the site changed and the parser needs a fix, not just review.
- If profiles start failing repeatedly, Paalam may be throttling — transient network/HTTP failures retry with increasing backoff, and the batch stops after too many consecutive profile failures. Rerun `ingest:paalam` later; it resumes from `state.json`, it doesn't restart.

## 3. Review flags

The parser never invents a fact it can't see in a labeled field. Instead it sets `needsReview: true` with one or more `reviewReasons`:

```text
missing_name
anonymous_or_unnamed
missing_or_unparsed_date
missing_location
missing_source_url
malformed_source_link
sensitive_public_figure
```

“Anonymous,” “Unidentified,” “Unnamed,” and “Unknown” titles all use `anonymous_or_unnamed`. These records still land in `victims.jsonl` — they are not dropped. Treat `needsReview` rows as "don't publish without a second look," not as broken data.

## 4. What's not built yet

In order, roughly:

1. Normalize location text into `city_municipality` / `province` / `region` more precisely (basic split already happens in the parser; PSGC-level matching is future work).
2. Deduplication across records (same victim discovered twice, or shared across sources).
3. Public-safe export (a filtered/shaped subset of `victims.jsonl` for the app).
4. Map + timeline app under `apps/web`.
5. Methodology page under `docs/`.

Don't start the frontend before a public-safe export exists. Don't add a second source before Paalam ingest is stable and reviewed.

## 5. When to add other sources

Paalam is the only active source. Add a new source only after Paalam has: working discovery, working ingest, a stable parser, and a first look at the review-flag rates. Default next-source order: news links found in Paalam's `sourceUrls`, then Dahas, then Drug Archive, then ACLED (event-level comparison only, not names-first).

## 6. What to read to learn the project

1. `guide/07_SCRAPING_STUDY_GUIDE.md` — **start here to study.** Concepts first (~70%), light code (~30%), with file tags to open as needed.
2. `README.md` — repo layout and commands.
3. `guide/01_PRD.md` — product goals, ethics rules, what the map/timeline should and shouldn't do.
4. `guide/02_DATA_PIPELINE_PLAN.md` — longer pipeline plan (normalize/dedupe/export later).
5. `guide/03_DATA_SCHEMA.md` — the `PaalamVictimRecord` fields and public display rules.
6. `guide/06_PAALAM_SITE_INSPECTION.md` — Paalam site structure (why sitemap + REST for discovery).
