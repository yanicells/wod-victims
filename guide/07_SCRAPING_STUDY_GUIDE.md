# Scraping Study Guide

Use this guide while reading the Paalam scraping and extraction-prep scripts.

The goal is to learn scraping as a data workflow, not just "download a page."

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

## How to read the script

Read `scrape-paalam.ts` in this order:

1. `parseArgs`

   Learns command-line options like `--limit`, `--delay-ms`, and `--dry-run`.

2. `selectQueuedTargets`

   Learns how the script chooses which rows to scrape.

3. `scrapeOneTarget`

   This is the main scraper body. Study it slowly.

4. `updateTargetRows`

   Learns how successful and failed fetches update the tracker.

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

   Learns how successful validation updates long-term tracker state.

## Helper files to read

### `data-pipeline/scripts/lib/http.ts`

Teaches:

- fetch with timeout
- user-agent header
- simple delay helper

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

## Commands to try

Dry run first:

```text
pnpm scrape:paalam:sample -- --dry-run --limit=20
```

Real 20-page batch:

```text
pnpm scrape:paalam:batch -- --limit=20 --delay-ms=2500
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
- failed URLs, if any, are listed in `failed_urls.jsonl`
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
- Track failures instead of hiding them.
- Keep linked sources for a later phase.
- Keep raw snapshots permanently.
- Review a batch before scaling.
- Extract and validate ready scraped records before creating a huge raw backlog.

## Common beginner mistake

The beginner instinct is to extract fields immediately while scraping.

For this project, avoid that.

Scraping should preserve evidence. Extraction should happen later as a separate step.
