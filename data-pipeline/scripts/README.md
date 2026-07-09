# Scripts

## Active pipeline

- `discover-paalam.ts` — fetches `sitemap.xml` and the WordPress REST `victim` list, merges/canonicalizes profile URLs, writes new ones into `data/paalam/state.json`. Does not fetch profile pages.
- `ingest-paalam.ts` — takes queued URLs from `state.json`, fetches each profile page, parses it with `lib/parse-paalam-profile.ts`, builds a record with `lib/paalam-record.ts`, appends it to `data/paalam/victims.jsonl`, and deletes the fetched HTML (unless `--keep-cache`). Tracks failures with backoff and stops after too many consecutive failures (throttle protection).
- `summary-paalam.ts` — reads `state.json` + `victims.jsonl` and prints counts: total, with name/date/location/sources/age, needs-review breakdown by reason.
- `compare-parser-vs-ai.ts` — offline check: re-parses any HTML still sitting in `data/raw/paalam/snapshots/` (from the old pipeline) and diffs against `data/intermediate/extractions/paalam_ai_extracts.jsonl` if that file exists. Only useful while both old artifacts remain on disk; safe to ignore once they're gone.

Commands (see `data-pipeline/README.md`):

```text
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20
pnpm summary:paalam
pnpm test
pnpm check
```

## Library (`lib/`)

- `http.ts` — fetch with timeout, retry-with-backoff, delay helper.
- `parse-paalam-profile.ts` — the actual parser. Reads labeled `ul.plm-details` fields (name, sex, age, marital status, occupation, date, time, location, incident type) and the separate `plm-details.source` link list. Never infers a fact from narrative text; flags `needsReview` with a reason instead.
- `paalam-record.ts` — shapes a `parsePaalamProfile()` result plus fetch metadata (`id`, `profileUrl`, `scrapedAt`, `contentHash`) into the committed `PaalamVictimRecord`.
- `state.ts` — reads/writes `data/paalam/state.json`, resolves `data/paalam/victims.jsonl` and `data/cache/paalam/` paths, loads existing victim IDs (for resuming ingest without duplicates).
- `ids.ts` — deterministic target/run/snapshot IDs (hash of the canonical URL, so reruns don't duplicate).
- `hash.ts` — SHA-256 of raw HTML, used for `contentHash` on each record.
- `jsonl.ts` — read/append one-JSON-object-per-line files.
- `paths.ts` — resolve paths from the repo root regardless of cwd.
- `csv.ts`, `counts.ts` — CSV read/write and count-by-field helpers, used by the legacy ops scripts below.

## Tests

```text
data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts
data-pipeline/scripts/__tests__/fixtures/*.html
```

Fixture HTML covers: a full profile, missing age, anonymous victim, a public-figure (mayor) subject, a location-text typo, and an age-in-a-separate-field layout. Run with `pnpm test`.

## Legacy, unwired scripts

These are holdovers from the old scrape-then-AI-extract pipeline. They are not in `package.json` and are not part of the current flow. Left in place; not deleted here.

- `validate-workspace.ts`, `ops-summary.ts` — checked/summarized the old `data/ops/*.csv` tracker files.
- `scrape-paalam.ts`, `review-paalam-scrape-quality.ts`, `prepare-paalam-extraction-batch.ts`, `validate-paalam-extractions.ts` — old raw-HTML scrape + AI-extraction-batch loop, replaced by `ingest-paalam.ts`.
