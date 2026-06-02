# Scraping Study Guide

Use this guide while reading the first Paalam scraper.

The goal is to learn scraping as a data workflow, not just "download a page."

## File to study first

Start with:

```text
data-pipeline/scripts/scrape-paalam-sample.ts
```

This script fetches a small sample of queued Paalam profile pages and saves raw evidence files.

## What the sample scraper does

The sample scraper:

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

### Outgoing source links

Paalam profile pages often include links to news articles.

The sample scraper records those links but does not fetch them yet.

Linked news is a later source family.

## How to read the script

Read `scrape-paalam-sample.ts` in this order:

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

## Commands to try

Dry run first:

```text
pnpm scrape:paalam:sample -- --dry-run --limit=20
```

Real 20-page sample:

```text
pnpm scrape:paalam:sample -- --limit=20 --delay-ms=2500
```

Check the workspace:

```text
pnpm validate:workspace
pnpm ops:summary
```

## What to inspect after a sample scrape

Open:

```text
data/ops/scrape_targets.csv
data/ops/scrape_runs.jsonl
data/raw/paalam/manifests/
data/raw/paalam/snapshots/
```

Check:

- 20 targets changed from `queued` to `scraped`
- each scraped target has `latest_snapshot_id`
- each scraped target has raw HTML and raw text paths
- each manifest has outgoing source links
- failed URLs, if any, are listed in `failed_urls.jsonl`

## Good scraper habits

- Start with a dry run.
- Scrape a small sample before scaling.
- Fetch one page at a time.
- Wait between requests.
- Save raw HTML before cleaning anything.
- Never overwrite raw snapshots.
- Track failures instead of hiding them.
- Keep linked sources for a later phase.

## Common beginner mistake

The beginner instinct is to extract fields immediately while scraping.

For this project, avoid that.

Scraping should preserve evidence. Extraction should happen later as a separate step.
