# Scripts

## Active pipeline

- `discover-paalam.ts` — fetches `sitemap.xml` and the WordPress REST `victim` list, merges/canonicalizes profile URLs, writes new ones into `data/paalam/state.json`. Does not fetch profile pages.
- `ingest-paalam.ts` — takes queued URLs from `state.json`, fetches each profile page, parses it with `lib/parse-paalam-profile.ts`, builds a record with `lib/paalam-record.ts`, appends it to `data/paalam/victims.jsonl`, and deletes the fetched HTML (unless `--keep-cache`). Tracks failures and stops after too many consecutive failures (throttle protection).
- `summary-paalam.ts` — reads `state.json` + `victims.jsonl` and prints counts: total, with name/date/location/sources/age, needs-review breakdown by reason.

Commands (from repo root):

```text
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20
pnpm summary:paalam
pnpm test
pnpm check
```

## Library (`lib/`)

- `http.ts` — fetch with timeout, retry-with-backoff, delay helper.
- `parse-paalam-profile.ts` — the parser. Reads labeled `ul.plm-details` fields and the `plm-details.source` link list. Never invents facts from narrative text; flags `needsReview` with a reason instead.
- `paalam-record.ts` — shapes a parse result plus fetch metadata into the committed `PaalamVictimRecord`.
- `state.ts` — reads/writes `data/paalam/state.json`, resolves paths, loads existing victim IDs for resume.
- `ids.ts` — deterministic IDs from the canonical URL.
- `hash.ts` — SHA-256 of raw HTML for `contentHash`.
- `jsonl.ts` — read/append JSONL files.
- `paths.ts` — resolve paths from the repo root.

## Tests

```text
data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts
data-pipeline/scripts/__tests__/fixtures/*.html
```

Fixture HTML covers: a full profile, missing age, anonymous victim, a public-figure (mayor) subject, a location-text typo, and age + occupation as separate fields. Run with `pnpm test`.
