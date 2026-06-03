# Data Operations Log

Use this log for human-readable notes about setup, scraper runs, rechecks, schema changes, and public export decisions.

## 2026-06-03

- Created starter data workspace and operational tracker files.
- No source data has been scraped.
- No source records have been added to the registry yet.
- Added pnpm TypeScript script environment with Zod schemas, workspace validation, and operations summary commands.
- Moved data-pipeline scripts into `/data-pipeline` so future web app code can live separately under `/apps`.
- Added Paalam as the first active source and left linked news, Dahas, Drug Archive, and ACLED in backlog status.
- Inspected Paalam site structure lightly and documented robots, sitemap, REST endpoint, sample profile structure, and discovery strategy in `guide/06_PAALAM_SITE_INSPECTION.md`.
- Ran Paalam discovery `paalam_discover_20260602172527`; added 3,349 queued profile targets from sitemap and WordPress REST metadata. No profile pages were fetched.
- Ran Paalam sample scrape `paalam_sample_20260602173855`; fetched 20 queued profile pages, saved raw HTML/text snapshots, recorded manifests and content hashes, and had 0 failed fetches. One sampled profile had a malformed/non-external source link and should be reviewed before scaling.
- Ran Paalam scrape-quality review; 19 scraped records are ready for AI extraction and 1 record needs review for a malformed/non-external source link.
- Converted the Paalam scraper into a reusable batch continuation command while keeping sample mode for tests.
- Added Paalam AI extraction schema, extraction-batch prep, extraction validation, and the reusable future-agent workflow in `guide/08_AI_WORKFLOW.md`.
- Prepared real Paalam AI extraction batch `paalam_extraction_batch_20260602181037` with 19 scrape-quality-ready records. Matching targets are now queued for extraction.
- Ran extraction validation against the current empty output file; 0 lines, 0 invalid records. The next step is to fill `data/intermediate/extractions/paalam_ai_extracts.jsonl` from the prepared batch and re-run validation.
- Updated the scrape-quality review script so target review status is reflected in `data/ops/scrape_targets.csv`; current summary shows 19 targets queued for extraction and 1 target queued for review.
- Added a duplicate-batch guard to `prepare:paalam:extraction`; re-running it now points to existing queued batch `paalam_extraction_batch_20260602181037` instead of creating another batch for the same records.
- Extracted the 19 records from `paalam_extraction_batch_20260602181037` into `data/intermediate/extractions/paalam_ai_extracts.jsonl`.
- Ran Paalam extraction validation; 19 valid records, 7 records needing review, 0 invalid records. Added the 7 extraction review issues to `data/qa/review_queue.csv`.
- Ran Paalam batch scrape `paalam_batch_20260603065359`; fetched the next 20 queued profile pages, saved raw HTML/text snapshots, recorded manifests and content hashes, and had 0 failed fetches.
- Ran scrape-quality review after the second batch; 40 scraped records reviewed, 39 ready for AI extraction, and 1 scrape-quality issue still queued for review.
- Prepared next Paalam AI extraction batch `paalam_extraction_batch_20260603065545` with 20 newly scraped ready records. This is the next continuation point.
