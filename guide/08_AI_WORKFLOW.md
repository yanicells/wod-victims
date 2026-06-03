# AI Continue Workflow

This is the reusable handoff file for future AI agents.

Use it when Yani says something like:

```text
Read guide/08_AI_WORKFLOW.md and continue the Paalam data pipeline for the next batch.
Use batch size 20 unless I say otherwise.
Run the scripts, do the AI extraction, validate the output, update trackers/docs, and stop at a clean checkpoint.
```

## What This Workflow Does

The pipeline should move in small, repeatable batches:

```text
review existing scraped pages
-> prepare an AI extraction batch
-> extract structured JSONL
-> validate and evaluate the extraction output
-> update trackers
-> only then scrape the next batch
```

Default batch size:

```text
20 records
```

If the AI context window is tight, use 5 or 10 records. Do not try to process all 3,000+ records in one chat unless Yani explicitly asks for that and there is enough time/context.

## Current Checkpoint

As of 2026-06-03:

```text
Source focus: paalam
Discovered Paalam profile targets: 3,349
Scraped Paalam profile targets: 40
Queued Paalam profile targets not scraped yet: 3,309
Validated Paalam AI extraction records: 19
Latest prepared extraction batch: paalam_extraction_batch_20260603065545
Records in latest prepared extraction batch: 20
Review-queued targets: 8
Next real data step: extract the 20 records in the latest batch, validate them, then continue scraping the next batch
```

The known review issue is:

```text
Target ID: paalam_profile_4f073c39d6e5
Issue: source_section_without_valid_external_link
Meaning: the Paalam page has Source(s) text, but the saved HTML did not contain a valid external source URL
Tracker: data/qa/review_queue.csv
```

## Non-Negotiable Rules

- Do not delete raw snapshots.
- Do not overwrite raw snapshots.
- Do not fetch victim photos.
- Do not fetch linked news articles until `paalam_linked_news` is explicitly activated.
- Do not geocode exact private locations.
- Do not invent missing data.
- Do not treat AI extraction as verified truth.
- Keep source quotes for every extracted fact.
- Run validation after changing scripts, trackers, extraction outputs, or workflow docs.

## Always Start Here

Run these first:

```text
pnpm check
pnpm validate:workspace
pnpm ops:summary
```

Then inspect the current state:

```text
data/ops/source_registry.csv
data/ops/scrape_targets.csv
data/ops/scrape_runs.jsonl
data/qa/review_queue.csv
```

## Command Reference

Workspace checks:

```text
pnpm check
pnpm validate:workspace
pnpm ops:summary
```

Discover Paalam targets:

```text
pnpm discover:paalam -- --dry-run --max-rest-pages=1
pnpm discover:paalam -- --delay-ms=500
```

Use discovery when source structure may have changed or when looking for newly added profile URLs. Discovery does not fetch victim profile pages.

Scrape the next actual batch:

```text
pnpm scrape:paalam:batch -- --dry-run --limit=20
pnpm scrape:paalam:batch -- --limit=20 --delay-ms=2500
```

Use `scrape:paalam:batch` for real continuation. Use `scrape:paalam:sample` only when testing the scraper itself.

Review scraped-page quality:

```text
pnpm review:paalam:scrape-quality
```

Prepare the next AI extraction batch:

```text
pnpm prepare:paalam:extraction -- --limit=20
```

This writes:

```text
data/intermediate/extractions/batches/<batch_id>.jsonl
data/intermediate/extractions/batches/<batch_id>_prompt.md
```

It also marks those target rows as `extraction_status=queued` in:

```text
data/ops/scrape_targets.csv
```

Validate AI extraction output:

```text
pnpm validate:paalam:extraction
```

This validates:

- strict JSON shape
- duplicate `target_id`s
- missing raw text files
- extracted values without source quotes/confidence

It writes:

```text
data/qa/paalam_extraction_validation_report.json
```

If validation passes, it marks extracted target rows as `extraction_status=validated` and sets `review_status=queued` for rows where `needs_review=true`.

## The Continuation Loop

### Step 1: Rebuild the scrape-quality report

Run:

```text
pnpm review:paalam:scrape-quality
```

Open:

```text
data/qa/paalam_scrape_quality_report.json
```

If there are ready unextracted records, extract those before scraping more pages. This keeps the project moving as a clean batch pipeline instead of creating a huge raw backlog.

### Step 2: Prepare an extraction batch

Run:

```text
pnpm prepare:paalam:extraction -- --limit=20
```

Read the command output and identify the newest batch files in:

```text
data/intermediate/extractions/batches/
```

If the command says records are already queued for extraction, do not create another batch. Use the existing queued batch ID printed by the command.

If the command says there are 0 quality-ready unextracted rows and no existing queued batch ID, go to Step 6 and scrape the next batch.

### Step 3: Extract the batch with AI

Open the latest batch JSONL and its prompt:

```text
data/intermediate/extractions/batches/<batch_id>.jsonl
data/intermediate/extractions/batches/<batch_id>_prompt.md
```

For each input row, append one JSON object to:

```text
data/intermediate/extractions/paalam_ai_extracts.jsonl
```

The output must match:

```text
guide/09_PAALAM_EXTRACTION_SCHEMA.md
```

Extraction rules:

- Preserve `source_key`, `target_id`, `snapshot_id`, `source_url`, `raw_text_path`, and `profile_url`.
- Use `null` for missing values.
- Every non-null fact needs a `source_quote`.
- Use confidence from `0` to `1`.
- Put weak, ambiguous, malformed-source, or location-sensitive rows at `needs_review: true`.
- Do not add exact coordinates.
- Do not use victim photos.
- Do not fetch linked news articles during this step.

### Step 4: Validate and evaluate the AI output

Run:

```text
pnpm validate:paalam:extraction
```

Open:

```text
data/qa/paalam_extraction_validation_report.json
```

If validation fails:

1. Fix the JSONL output or mark uncertain fields as `null`.
2. Re-run `pnpm validate:paalam:extraction`.
3. Do not continue to new scraping until validation passes or the failure is clearly documented.

If validation passes, spot-check at least 3 records manually against their raw text. For very small batches, spot-check all of them.

### Step 5: Update trackers and notes

Update:

```text
data/ops/data_operations_log.md
guide/04_AI_TASK_TRACKER.md
```

Record:

- batch ID
- number of records extracted
- validation result
- number of records needing review
- any blockers
- exact next step

If a new issue was discovered, add or update:

```text
data/qa/review_queue.csv
```

### Step 6: Scrape the next batch only after extraction catches up

When there are no ready unextracted scraped pages, run:

```text
pnpm scrape:paalam:batch -- --dry-run --limit=20
pnpm scrape:paalam:batch -- --limit=20 --delay-ms=2500
pnpm review:paalam:scrape-quality
pnpm prepare:paalam:extraction -- --limit=20
```

Then return to Step 3.

## What Not To Clean Up

Do not delete these just because they look temporary:

```text
data/raw/paalam/snapshots/
data/raw/paalam/manifests/
data/intermediate/extractions/batches/
data/intermediate/extractions/paalam_ai_extracts.jsonl
data/qa/*.json
data/qa/*.csv
```

They are the audit trail. If a later run creates a newer batch file, leave the older batch file in place.

## Final Response Checklist

Before ending a future AI run, run:

```text
pnpm check
pnpm validate:workspace
pnpm ops:summary
git diff --check
```

Then report:

- what batch size was used
- whether the run extracted existing ready records or scraped new records
- latest batch file path
- extraction output path
- validation report path
- counts from `pnpm ops:summary`
- records or issues needing human review
- the next clean command Yani should ask for
