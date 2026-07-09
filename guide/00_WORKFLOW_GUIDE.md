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
- `ingest:paalam -- --limit=N` fetches the next N not-yet-completed URLs, parses each with Cheerio, appends clean records to `data/paalam/victims.jsonl`, and deletes the fetched HTML. Rerun with a higher limit or no limit flag (default 10) to keep going — it skips already-completed URLs automatically.
- `summary:paalam` prints counts: total victims, how many have a name/date/location/sources/age, and a breakdown of `needsReview` reasons.
- `test` runs the parser unit tests (`scripts/__tests__/parse-paalam-profile.test.ts` against fixture HTML). Run this after touching the parser.

Useful flags on `ingest:paalam`:

```text
--limit=20            how many profiles to fetch this run (default 10)
--delay-ms=2500        pause between requests (default 2500)
--dry-run              parse and print, write nothing
--keep-cache           keep the fetched HTML instead of deleting it (debugging)
--url=<full url>       ingest one specific URL, bypassing the discovered queue
```

## 2. Double-check after each ingest run

- `pnpm summary:paalam` — did the victim count go up by roughly the batch size?
- Skim the `needs_review` reason counts. If one reason spikes (e.g. `missing_location`), check whether the site changed and the parser needs a fix, not just review.
- If profiles start failing repeatedly, Paalam is throttling — the script backs off automatically and stops after too many consecutive failures. Rerun `ingest:paalam` later; it resumes from `state.json`, it doesn't restart.

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

These records still land in `victims.jsonl` — they are not dropped. Treat `needsReview` rows as "don't publish without a second look," not as broken data.

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

1. `README.md` — repo layout and the big idea.
2. `guide/01_PRD.md` — product goals, ethics rules, what the map/timeline should and shouldn't do.
3. `guide/02_DATA_PIPELINE_PLAN.md` — the full pipeline: discover, ingest/parse, review flags, and what comes after.
4. `guide/03_DATA_SCHEMA.md` — the `PaalamVictimRecord` fields and public display rules.
5. `data-pipeline/scripts/discover-paalam.ts`, then `ingest-paalam.ts`, then `lib/parse-paalam-profile.ts` — read in that order to see the whole flow end to end.
6. `guide/06_PAALAM_SITE_INSPECTION.md` — how the site is structured and why discovery uses sitemap + REST instead of page scraping.
7. `guide/07_SCRAPING_STUDY_GUIDE.md` — how the ingest script itself works (fetch, parse, retry, review flags).
