# Scraping Study Guide

Use this guide while reading the Paalam scraping and extraction-prep scripts.

The goal is to learn scraping as a data workflow, not just "download a page."

> For the day-to-day run cadence (who runs what, the AI handoff), see
> `guide/10_EXTRACTION_HANDOFF.md`. This guide explains how the scraper works
> inside.

## Files to study first

Start with:

```text
data-pipeline/scripts/scrape-paalam.ts
```

This script fetches queued Paalam profile pages and saves raw evidence files. It can run in sample mode for testing or batch mode for the real continuation workflow.

Then read:

```text
data-pipeline/scripts/review-paalam-scrape-quality.ts
data-pipeline/scripts/prepare-paalam-extraction-batch.ts
data-pipeline/scripts/validate-paalam-extractions.ts
```

## What the Paalam scraper does

The scraper:

1. Reads `data/ops/scrape_targets.csv`.
2. Selects queued Paalam profile targets.
3. Fetches one HTML page at a time.
4. Waits between requests.
5. Saves raw HTML.
6. Converts HTML into readable raw text.
7. Saves raw text.
8. Computes a content hash.
9. Extracts outgoing source links.
10. Writes a per-page snapshot manifest.
11. Updates `scrape_targets.csv`.
12. Appends one run record to `scrape_runs.jsonl`.
13. Runs a separate quality review before AI extraction.

It does not:

- fetch images
- fetch linked news articles
- run AI extraction
- normalize data
- geocode anything
- publish anything

## Important concepts

### Target

A target is a URL we plan to touch.

Tracker:

```text
data/ops/scrape_targets.csv
```

Each row answers:

- What URL is this?
- Which source does it belong to?
- Has it been scraped?
- Did it fail?
- What is the latest raw snapshot?
- Does it need extraction?

### Run

A run is one execution of a script.

Tracker:

```text
data/ops/scrape_runs.jsonl
```

Each run records:

- script mode
- start and finish time
- target count
- success count
- failed count
- notes

This makes the project auditable later.

### Snapshot

A snapshot is one saved capture of a page at one time.

Files:

```text
data/raw/paalam/snapshots/*.html
data/raw/paalam/snapshots/*.txt
data/raw/paalam/manifests/*.json
```

The HTML file is the raw evidence.

The text file is a readable version for extraction.

The manifest connects the URL, target ID, timestamp, content hash, saved file paths, and outgoing source links.

### Content hash

A content hash is a fingerprint of the raw HTML.

If the same URL is fetched later and the hash is unchanged, we can skip unnecessary extraction work.

This is how the project avoids wasting time later.

### Batch mode versus sample mode

Use batch mode for real project continuation:

```text
pnpm scrape:paalam:batch -- --limit=20 --delay-ms=2500
```

Use sample mode only when testing changes to the scraper:

```text
pnpm scrape:paalam:sample -- --limit=5 --delay-ms=2500
```

Both modes save raw snapshots the same way. The mode is mainly a run-log label so future agents can tell whether a run was a test or actual pipeline work.

### Outgoing source links

Paalam profile pages often include links to news articles.

The scraper records those links but does not fetch them yet.

Linked news is a later source family.

### Quality review

Scraping is not finished just because pages were fetched.

Run:

```text
pnpm review:paalam:scrape-quality
```

This checks saved snapshots and writes:

```text
data/qa/paalam_scrape_quality_report.csv
data/qa/paalam_scrape_quality_report.json
```

The report tells you which scraped records are ready for AI extraction and which need review first.

### Failed targets, retry, and the circuit breaker

A fetch can fail — usually a network drop, or the site throttling us after a
burst of requests. When that happens the scraper:

- marks the target `status=failed`, bumps `failure_count`, and sets
  `next_retry_at` with a growing backoff (~15m, 30m, 60m … capped at 24h);
- appends the failure to `data/raw/paalam/failed_urls.jsonl` (append-only —
  failures are never hidden or deleted).

Normal batch runs only pick `status=queued`, so failed targets are not retried
automatically. To recover them:

```text
pnpm scrape:paalam:retry -- --limit=15 --delay-ms=4000 --force
```

Retry-failed mode re-selects `failed` targets whose `next_retry_at` has passed
(oldest first, skipping ones past `--max-failures`). `--force` ignores the
retry-time gate.

Two safeguards live inside the scraper:

- `--retries` (default 1): extra fetch attempts with backoff for a lone
  transient drop.
- `--max-consecutive-failures` (default 5): a circuit breaker. After that many
  failures in a row — almost always a throttle — the run stops and leaves the
  untouched targets as they were, instead of burning through them. Use `0` to
  disable.

### Review status and disposition

Extraction does not decide truth. Records the AI is unsure about are flagged
`needs_review`, and the target's `review_status` moves through these states:

```text
not_required -> queued -> reviewed | needs_follow_up
```

- `queued`: flagged, awaiting a review pass.
- `reviewed`: a review decided the record is fine (sometimes with a correction).
- `needs_follow_up`: parked for a human editorial/scope call (sensitive cases,
  no clear drug-war link, anonymous victims, etc.).

Two QA files carry the review work:

- `data/qa/review_queue.csv` — one row per flagged record, with a note + status.
- `data/qa/manual_fixes.csv` — corrections (old value -> new value + source
  quote). Corrections are recorded here, NOT written back over the AI output in
  `paalam_ai_extracts.jsonl`, so the original extraction stays as an audit trail
  and the fix is applied later at the normalize/export step.

Important: `validate:paalam:extraction` only queues freshly-flagged rows; it
preserves `reviewed` and `needs_follow_up`, so running it every batch does not
wipe review work.

## How to read the script

Read `scrape-paalam.ts` in this order:

1. `parseArgs`

   Learns command-line options like `--limit`, `--delay-ms`, and `--dry-run`.

2. `selectTargets`

   Learns how the script chooses which rows to scrape — `queued` targets in a
   normal run, or due `failed` targets when `--retry-failed` is set.

3. `scrapeOneTarget`

   This is the main scraper body. Study it slowly. Note it passes `--retries`
   down to `fetchText` for transient-failure retries.

4. `updateTargetRows`

   Learns how successful and failed fetches update the tracker, including
   `failure_count` and the `next_retry_at` backoff on failure.

5. `main`

   Shows the whole workflow from start to finish.

Then read `prepare-paalam-extraction-batch.ts` in this order:

1. `getAlreadyExtractedTargetIds`

   Learns how the pipeline avoids extracting the same target twice.

2. The `candidates` filter in `main`

   Learns how only quality-ready, not-yet-extracted rows enter the next AI batch.

3. `markTargetsQueuedForExtraction`

   Learns how the tracker remembers which rows have entered extraction.

Then read `validate-paalam-extractions.ts` in this order:

1. `PaalamExtractionRecord.safeParse`

   Learns how Zod checks strict JSON shape.

2. `addUnsupportedFactIssue`

   Learns how extracted facts are checked for quotes and confidence.

3. `updateTargetExtractionStatuses`

   Learns how successful validation updates long-term tracker state — and how it
   preserves an existing review disposition instead of re-queueing it.

## Helper files to read

### `data-pipeline/scripts/lib/http.ts`

Teaches:

- fetch with timeout
- user-agent header
- simple delay helper
- retrying transient (thrown) failures with a growing backoff

### `data-pipeline/scripts/lib/html.ts`

Teaches:

- parsing HTML with Cheerio
- removing scripts/images/styles
- converting page text
- extracting source links

### `data-pipeline/scripts/lib/hash.ts`

Teaches:

- making a SHA-256 content hash

### `data-pipeline/scripts/lib/ids.ts`

Teaches:

- deterministic target IDs
- run IDs
- snapshot IDs

### `data-pipeline/scripts/lib/csv.ts`

Teaches:

- reading CSV tracker rows
- writing CSV tracker rows
- escaping CSV values

### `data-pipeline/scripts/review-paalam-scrape-quality.ts`

Teaches:

- reading scraped tracker rows
- checking raw snapshot files
- checking text length
- checking source-link counts
- writing quality reports

### `data-pipeline/scripts/prepare-paalam-extraction-batch.ts`

Teaches:

- selecting quality-ready scraped records
- skipping records already extracted
- creating AI input JSONL batches
- writing a companion batch prompt
- updating target rows to `extraction_status=queued`

### `data-pipeline/scripts/validate-paalam-extractions.ts`

Teaches:

- validating AI JSONL output with Zod
- detecting duplicate target IDs
- checking that extracted facts have quotes/confidence
- writing an extraction validation report
- marking targets as validated after successful extraction validation
- preserving existing review dispositions (`reviewed` / `needs_follow_up`) on re-validation

## Commands to try

Dry run first:

```text
pnpm scrape:paalam:sample -- --dry-run --limit=20
```

Real batch — keep chunks small, since the site throttles after ~7 rapid hits:

```text
pnpm scrape:paalam:batch -- --limit=15 --delay-ms=3000
```

Recover anything that failed (e.g. a throttle event):

```text
pnpm scrape:paalam:retry -- --limit=15 --delay-ms=4000 --force
```

Quality review:

```text
pnpm review:paalam:scrape-quality
```

Prepare the next AI extraction batch:

```text
pnpm prepare:paalam:extraction -- --limit=20
```

Validate AI extraction output:

```text
pnpm validate:paalam:extraction
```

Check the workspace:

```text
pnpm validate:workspace
pnpm ops:summary
```

## What to inspect after a scrape batch

Open:

```text
data/ops/scrape_targets.csv
data/ops/scrape_runs.jsonl
data/raw/paalam/manifests/
data/raw/paalam/snapshots/
data/qa/paalam_scrape_quality_report.json
data/intermediate/extractions/batches/
data/qa/paalam_extraction_validation_report.json
```

Check:

- 20 targets changed from `queued` to `scraped`
- each scraped target has `latest_snapshot_id`
- each scraped target has raw HTML and raw text paths
- each manifest has outgoing source links
- failed URLs, if any, are listed in `failed_urls.jsonl` and recoverable with `pnpm scrape:paalam:retry`
- quality report says which records are ready for AI extraction
- extraction batch files include raw text plus source-link context
- validation report says whether AI output is schema-valid and evidence-supported

## Good scraper habits

- Start with a dry run.
- Scrape a small sample before scaling.
- Fetch one page at a time.
- Wait between requests.
- Save raw HTML before cleaning anything.
- Never overwrite raw snapshots.
- Track failures instead of hiding them, and recover them with `scrape:paalam:retry` rather than leaving them stuck.
- Keep linked sources for a later phase.
- Keep raw snapshots permanently.
- Review a batch before scaling.
- Extract and validate ready scraped records before creating a huge raw backlog.

## Common beginner mistake

The beginner instinct is to extract fields immediately while scraping.

For this project, avoid that.

Scraping should preserve evidence. Extraction should happen later as a separate step.
