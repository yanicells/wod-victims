# Scraping Study Guide

How `ingest-paalam.ts` works, for anyone reading the code.

## Read in this order

```text
data-pipeline/scripts/discover-paalam.ts
data-pipeline/scripts/ingest-paalam.ts
data-pipeline/scripts/lib/http.ts
data-pipeline/scripts/lib/parse-paalam-profile.ts
data-pipeline/scripts/lib/paalam-record.ts
data-pipeline/scripts/lib/state.ts
```

## What happens on one `ingest-paalam.ts` run

1. Load `data/paalam/state.json` (`discoveredUrls`, `completedIds`, `failed`).
2. Load existing IDs already in `data/paalam/victims.jsonl` (covers a partial run that wrote records but hadn't saved state yet).
3. Build the pending queue: discovered URLs minus everything already completed. Take the first `--limit`.
4. For each URL, one at a time, with `--delay-ms` between requests:
   - Fetch HTML (`lib/http.ts`, with `--retries` transient-failure retries).
   - Parse it (`lib/parse-paalam-profile.ts`) — reads labeled `plm-details` fields only, never the narrative, for structured data.
   - Build a record (`lib/paalam-record.ts`) combining the parsed fields with fetch metadata (`id`, `profileUrl`, `scrapedAt`, `contentHash`).
   - Append the record to `victims.jsonl`, mark the ID completed in state, clear any prior failure for it.
   - Delete the fetched HTML (unless `--keep-cache`).
5. On failure: record the error and attempt count in `state.failed`. After `--max-consecutive-failures` (default 5) failures in a row — almost always Paalam throttling — the run stops early, leaving remaining URLs untouched for next time.
6. Print a summary: success/failed counts, total completed, and the first 20 review-flag notes from this run.

## Key concepts

**Target ID.** A deterministic hash of the canonical URL (`lib/ids.ts`). Rerunning discovery or ingest never creates duplicates.

**Content hash.** SHA-256 of the raw HTML (`lib/hash.ts`), stored on the record. Useful later if a page needs re-checking for changes — there's no re-check script yet.

**No raw snapshots.** Older versions of this project saved raw HTML/text permanently. This pipeline doesn't: the fetched HTML lives in `data/cache/paalam/` only for the duration of one run, then gets deleted. The parsed JSONL record is the durable artifact.

**Review flags, not blocking.** A record with a missing field or a suspicious detail (anonymous name, no source link, a mayor as the victim) is written anyway, with `needsReview: true` and specific `reviewReasons`. Nothing is invented to "complete" a record.

## Commands to try

```text
pnpm discover:paalam -- --dry-run
pnpm ingest:paalam -- --dry-run --limit=5
pnpm ingest:paalam -- --limit=15 --delay-ms=3000
pnpm summary:paalam
pnpm test
```

## What to inspect after a run

```text
data/paalam/state.json      discoveredUrls / completedIds / failed grew as expected
data/paalam/victims.jsonl   new lines appended, one per successfully ingested profile
```

Check: victim count in `summary:paalam` went up by roughly the batch size, and no big spike in one `needsReview` reason (which usually means the parser needs a fix, not that the batch is broken).

## Good habits

- Dry-run before a real batch.
- Keep batches small (10-20); Paalam throttles after rapid bursts.
- Never fetch image files or linked news articles during Paalam ingest — that's a later, separate source.
- Don't try to "fix" a review-flagged record by inventing a value. Fix the parser if the site's markup changed, or leave it flagged.
