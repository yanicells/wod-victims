# Workflow Guide

Use this as the practical "what do I do next?" guide for the project.

The short version: set up the data operating system first, scrape Paalam slowly, inspect small batches, then build extraction, validation, normalization, dedupe, and export. Do not jump to the frontend until the first public-safe dataset exists.

## 1. First things to set up

Do these before any serious scraping.

### A. Create the project data workspace

Ask Codex:

```text
Create the initial data pipeline workspace for this repo based on the docs.

Set up:
- /data/ops
- /data/raw/paalam
- /data/raw/news
- /data/intermediate
- /data/processed
- /data/qa
- /data-pipeline
- /apps
- /docs

Create starter tracker files for source_registry.csv, scrape_targets.csv, scrape_runs.jsonl, recheck_queue.csv, source_backlog.md, and data_operations_log.md.

Do not scrape anything yet.
```

Double-check:

- the folders exist
- the tracker files have the right columns
- no raw data was invented
- nothing was scraped yet

### B. Choose the scripting stack

Recommended default: TypeScript/Node with Zod validation.

Ask Codex:

```text
Set up a TypeScript data-pipeline script environment for this repo.

Use simple scripts, Zod schemas, and package scripts.
Keep pipeline code inside /data-pipeline.
Keep root pnpm commands working.
Do not build a frontend yet.
Do not scrape any live source yet.
```

Double-check:

- root `package.json` exists
- `data-pipeline/package.json` exists
- scripts are clear and boring
- schemas are separate from scraper logic
- there is a dry-run or sample mode planned

### C. Confirm Paalam as the first active source

Ask Codex:

```text
Add Paalam.org as the first active source in source_registry.csv.
Keep linked news, Dahas, Drug Archive, and ACLED in backlog status.
Do not scrape yet.
```

Double-check:

- Paalam is active or approved
- other sources are backlog
- robots/terms notes are left as TODO until checked

## 2. First real work: inspect Paalam

Goal: understand page structure before writing a scraper.

Ask Codex:

```text
Inspect Paalam.org page structure for victim list pages and profile pages.

Report:
- likely list/index pages
- likely profile URL patterns
- what data appears on profile pages
- outgoing source links
- scraping risks
- proposed safe scraper approach

Do not scrape the full site.
```

Double-check:

- the site structure is described clearly
- the scraper plan includes slow rate limits
- the plan saves raw HTML and raw text
- the plan tracks target IDs, snapshot IDs, run IDs, and content hashes

Move on only when the target discovery strategy is clear.

## 3. Build scraper in small steps

### A. Discovery only

Ask Codex:

```text
Build the Paalam discovery script.

It should find candidate profile URLs, normalize/canonicalize URLs, and add them to scrape_targets.csv.
It should not fetch every profile page yet.
It should log a scrape_runs.jsonl entry with mode discover.
```

Double-check:

- new URLs land in `scrape_targets.csv`
- duplicate URLs are not added repeatedly
- discovered targets have `status=discovered` or `queued`
- source and run IDs are present

### B. First safe scrape, then batch scrape

Ask Codex:

```text
Run a safe first scrape for 20 Paalam profile targets.

Save append-only raw HTML and raw text snapshots.
Update scrape_targets.csv with status, latest snapshot, content hash, HTTP status, and failure count.
Generate a scrape status summary.
```

Double-check:

- raw HTML files exist
- raw text files are readable
- failed URLs are tracked, not dropped
- content hashes are present
- no old raw snapshots were overwritten

After the first scrape looks good, continue with `pnpm scrape:paalam:batch` in small batches.

### C. Review scrape quality

Ask Codex:

```text
Run the Paalam scrape-quality review.

Use the saved raw snapshots and manifests.
Report how many scraped records are ready for AI extraction and which records need review.
Do not scrape a large backlog before extracting and validating the ready records.
```

Double-check:

- the quality report exists
- raw HTML/text files exist
- records with missing or malformed source links are flagged
- only quality-ready records move to AI extraction

## 4. Extraction workflow

Only extract from raw text after scraped pages pass quality review.

Ask Codex:

```text
Create the strict AI extraction schema and extraction prompt for Paalam victim profiles.

Every non-null field must include source_quote and confidence.
Include source_key, target_id, snapshot_id, and source_url in each output.
Use guide/09_PAALAM_EXTRACTION_SCHEMA.md as the schema reference.
```

Then ask:

```text
Prepare the next Paalam AI extraction batch and run extraction on the scrape-quality-ready records.

Save outputs to data/intermediate/extractions/paalam_ai_extracts.jsonl.
Validate each output against the schema.
Generate an extraction quality report.
```

Double-check:

- names are supported by quotes
- dates are not invented
- barangays/cities are not guessed
- `needs_review` is true when uncertain
- low-confidence fields are not treated as public facts

## 5. Validation and review workflow

After extraction, run a second pass before trusting anything.

Ask Codex:

```text
Validate the extracted Paalam records against their raw source text.

Flag:
- unsupported extracted fields
- weak source quotes
- missing sources
- possible sensitive location details
- records needing review

Write a review queue CSV.
```

Double-check:

- unsupported fields are lowered or nulled
- public-risky rows are flagged
- the review queue is small and focused

## 6. Normalize, dedupe, then export

Do not normalize before extraction quality is acceptable.

Suggested order:

1. Normalize names.
2. Normalize dates.
3. Normalize locations.
4. Assign location precision.
5. Generate dedupe candidates.
6. Review dedupe candidates.
7. Export public-safe data.

Ask Codex:

```text
Build normalization scripts for the first validated Paalam extraction batch.

Normalize names and dates first.
For locations, preserve raw_location_text and only assign city/barangay/province when supported.
Do not generate exact private coordinates.
```

Then ask:

```text
Generate conservative duplicate candidates for the normalized Paalam records.

Use name, date, location, age, source URLs, and incident context.
Do not auto-merge unless the match is very strong.
```

Then ask:

```text
Export the first public-safe dataset.

Only include records that pass public record rules.
Also export internal review rows and a data quality report.
```

Double-check:

- public rows have source URLs
- low-confidence fields are hidden or clearly labeled
- province-only records are not shown as individual pins
- duplicate status is not unresolved

## 7. Continue in repeatable batches

After the first extraction batch validates:

1. Extract any already-scraped quality-ready records first.
2. Scrape the next Paalam batch.
3. Review scrape quality.
4. Prepare an AI extraction batch.
5. Extract and validate that batch.
6. Fix scraper/schema/prompt issues while the batch is still small.
7. Repeat.
8. Only then consider linked news articles.

Ask Codex:

```text
Continue the Paalam pipeline using guide/08_AI_WORKFLOW.md.

Use batch size 20 unless I say otherwise.
Extract ready scraped records before scraping more.
Generate scrape, extraction, review, and data quality reports.
Do not touch linked news yet.
```

## 8. Ongoing maintenance

Once the pipeline exists, future updates should be incremental.

Ask Codex periodically:

```text
Run the Paalam maintenance workflow.

Check active sources due for recheck.
Discover new targets.
Recheck due targets.
Retry failed targets.
Compare content hashes.
Queue extraction only for new or changed snapshots.
Generate an operations report.
```

Double-check:

- unchanged pages are skipped
- changed pages are queued for extraction
- failed pages remain visible
- new source ideas go into backlog, not straight into the scraper

## 9. When to add other sources

Add new sources only after Paalam has:

- working discovery
- working scrape snapshots
- extraction schema
- validation reports
- review queue
- dedupe candidates
- first public-safe export

For each new source, ask:

```text
Evaluate this source for the project before adding it to the active pipeline.

Classify it as names-first, event-level, methodology-only, or supporting evidence.
Recommend active, backlog, blocked, or out of scope.
List scraping/access/ethics risks and suggested source_registry values.
```

Default source order:

1. Paalam profiles
2. news links discovered from Paalam
3. Dahas methodology/context
4. Drug Archive if access is practical
5. ACLED for event-level comparison only

## 10. Things to avoid early

Avoid:

- building the frontend before the first dataset export
- scraping all sources at once
- scraping random news articles
- treating AI extraction as verified truth
- geocoding exact homes or private locations
- deleting failed URLs
- overwriting raw snapshots
- merging duplicates by name alone

## 11. Simple phase checklist

Use this as the rough project rhythm:

```text
Setup trackers and scripts
→ inspect Paalam
→ discover profile URLs
→ first safe scrape 20
→ inspect raw text
→ run scrape-quality review
→ prepare AI extraction batch
→ extract scrape-quality-ready records
→ validate extraction
→ continue Paalam in batches
→ normalize validated records
→ dedupe validated records
→ export public-safe dataset
→ scale to all Paalam
→ add linked sources
→ build frontend
```

If a phase feels messy, stop and improve the tracker/report before scaling up.

## 12. What to study first

Read these in this order if you want to learn the project and the scraping/data workflow.

### A. Project direction

1. `README.md`

   Read this first for the repo layout and the big idea.

2. `guide/00_WORKFLOW_GUIDE.md`

   This is the practical project roadmap. It tells you what to do first, what to ask Codex, and what to double-check.

3. `guide/01_PRD.md`

   This explains the product goals, ethics rules, and what the final map/timeline should and should not do.

### B. Data system

4. `guide/02_DATA_PIPELINE_PLAN.md`

   Study this to understand the whole pipeline: source registry, scrape targets, raw snapshots, AI extraction, validation, normalization, dedupe, review, and export.

5. `guide/03_DATA_SCHEMA.md`

   Study this to understand the tables and fields. This is the best file for learning how we track sources, victims, incidents, extraction runs, and review queues.

6. `data/ops/source_registry.csv`

   This will eventually list source families like Paalam, linked news, Dahas, Drug Archive, and ACLED.

7. `data/ops/scrape_targets.csv`

   This is the key scraping tracker. It answers: "Have we discovered, scraped, failed, changed, or queued this URL?"

### C. Code basics

8. `package.json`

   Read this to see the root commands you can run with pnpm.

9. `data-pipeline/package.json`

   Read this to see the actual data-pipeline package dependencies and script commands.

10. `data-pipeline/scripts/validate-workspace.ts`

   This is the best starter code file. It checks folders, CSV headers, JSONL files, and Zod row schemas.

11. `data-pipeline/scripts/ops-summary.ts`

   This is a small reporting script. It teaches how we read tracker files and summarize current project status.

12. `data-pipeline/scripts/schemas/ops.ts`

   This defines the allowed statuses and tracker row shapes using Zod.

13. `data-pipeline/scripts/schemas/workspace.ts`

   This defines the expected folder structure and CSV headers.

14. `guide/07_SCRAPING_STUDY_GUIDE.md`

   Read this before studying the scraper. It explains targets, runs, snapshots, hashes, manifests, and why scraping is separated from extraction.

15. `guide/08_AI_WORKFLOW.md`

   The full end-to-end loop for one AI session driving everything. Kept as the fallback flow.

16. `guide/10_EXTRACTION_HANDOFF.md`

   The default, token-efficient flow: the human runs all scripts (scrape, retry, review, prepare, validate) and the AI only does the extraction step. Read this to know the actual run cadence and the scrape/retry settings that avoid the site's throttle.

### D. Scraping and extraction scripts

Study files in this order:

1. `data-pipeline/scripts/discover-paalam.ts`
2. `data-pipeline/scripts/scrape-paalam.ts`
3. `data-pipeline/scripts/lib/http.ts`
4. `data-pipeline/scripts/lib/html.ts`
5. `data-pipeline/scripts/review-paalam-scrape-quality.ts`
6. `data-pipeline/scripts/prepare-paalam-extraction-batch.ts`
7. `data-pipeline/scripts/validate-paalam-extractions.ts`
8. latest scrape and extraction reports

The most important scraping lesson: a scraper is not just "download a page." A good scraper also tracks what it touched, what failed, what changed, and what should happen next.
