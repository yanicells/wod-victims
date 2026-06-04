# Extraction Handoff (Token-Efficient Flow)

This is the **default** way to run the Paalam pipeline. It splits the work so the
human runs all scripts (cheap, just waiting) and the AI only does the one step
that needs a model: turning raw page text into extraction JSONL.

Use the older `08_AI_WORKFLOW.md` end-to-end loop only if you want the AI to
drive everything in one conversation (more tokens, lots of idle waiting).

## Why this split

The only irreducible "needs a model" work is `raw_text` -> extraction JSONL
(mapping fields, picking the supporting quote, catching location discrepancies,
flagging sensitive cases, reading Tagalog). Everything else — scraping,
quality review, batch prep, validation, ops summary, git — is mechanical and
should not burn AI tokens or make the AI sit idle waiting on a 50-second scrape.

## Division of labor

**You run (no AI tokens):**

```text
pnpm scrape:paalam:batch -- --limit=50 --delay-ms=2500
pnpm review:paalam:scrape-quality
pnpm prepare:paalam:extraction -- --limit=50
pnpm validate:paalam:extraction
pnpm ops:summary
git add/commit
```

**AI does (the only model step):**

- Read the prepared batch file, write an extraction file. Nothing else.
- Does NOT run pnpm/scrape/git. Does NOT wait on anything.

## Standard settings

- **Batch size: 50.** Fewer handoffs, one long reply per batch. The real ceiling
  is how many clean scrapes you get (see scraping note below).
- **Logging: milestone-only.** The scripts already update `scrape_targets.csv`
  and `data/qa/paalam_extraction_validation_report.json` — that is the real
  state. The AI writes prose into `data/ops/data_operations_log.md`,
  `guide/04_AI_TASK_TRACKER.md`, and the `08` checkpoint only at session end or
  every few batches, not every batch.

## The cycle

### 1. You: scrape + prep (run these, then hand off)

```text
pnpm scrape:paalam:batch -- --limit=50 --delay-ms=2500
pnpm review:paalam:scrape-quality
pnpm prepare:paalam:extraction -- --limit=50
```

Note the printed batch id, e.g. `paalam_extraction_batch_20260603083113`.

### 2. You -> AI: hand off with one line

```text
extract batch paalam_extraction_batch_<id>
```

(If you switched the model to a cheaper one for extraction, do it before this.)

### 3. AI: extract only

The AI will:

1. `Read data/intermediate/extractions/batches/<id>.jsonl`
2. `Write data/intermediate/extractions/batches/<id>_extracted.jsonl`
   — one JSON object per input row, matching `guide/09_PAALAM_EXTRACTION_SCHEMA.md`.
3. Stop and report counts (records, how many flagged `needs_review`, any notable
   issues). It does **not** append to the master file, run validation, or run git.

AI extraction rules (same as schema, restated for a cold start):

- Preserve `source_key`, `target_id`, `snapshot_id`, `source_url`,
  `raw_text_path`, `profile_url` exactly from the input row.
- `null` for missing values; every non-null fact needs a copied `source_quote`.
- Confidence 0–1. Do not invent data. Do not infer barangay from city.
- `needs_review: true` for: alias-only / no real name, location mismatch between
  the profile's "Location of Incident" and the source text, sensitive cases
  (e.g. public officials on a drug list killed by unknown assailants), missing
  gender in the profile, or anything weak.
- **Do not resolve reviews.** Flag and move on — a dedicated review pass happens
  later. Write the extraction file once; no dry-run double pass.

### 4. You: append + validate

```text
cat data/intermediate/extractions/batches/<id>_extracted.jsonl >> data/intermediate/extractions/paalam_ai_extracts.jsonl
pnpm validate:paalam:extraction
pnpm ops:summary
```

`validate:paalam:extraction` catches malformed JSON and duplicate `target_id`s,
so if you accidentally append twice or the AI emitted a bad line, it will tell
you — fix and re-run. Keep the per-batch `<id>_extracted.jsonl` as an audit
trail; do not delete it.

## Scraping note (why 50 may not yield 50)

The Paalam site dropped 13 of 20 connections after ~7 fetches even at
`--delay-ms=2500`. Until the scraper gets a gentler rate or a retry-failed mode
(`P1O-005`, still TODO), expect partial batches. Failed URLs are tracked in
`data/raw/paalam/failed_urls.jsonl` and the targets are marked `failed` — they
are NOT auto-retried (batch selection only picks `queued`). Options:

- Scrape in smaller chunks (e.g. `--limit=15`) to stay under the drop threshold.
- Raise `--delay-ms` (e.g. `4000`).
- Build the retry-failed workflow before doing large pulls.

## Deferred (not part of this loop — later passes)

- Resolving the review queue (`data/qa/review_queue.csv`).
- Normalization, dedupe, public-safe export.
- Linked news, Dahas, Drug Archive, ACLED.

## Current state pointer

For the latest counts and known review issues, see the **Current Checkpoint** in
`guide/08_AI_WORKFLOW.md` (updated at milestones).
