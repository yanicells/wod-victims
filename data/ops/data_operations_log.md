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
- Extracted 20 records from `paalam_extraction_batch_20260603065545` into `data/intermediate/extractions/paalam_ai_extracts.jsonl`; total is now 39 records.
- Ran Paalam extraction validation; 39 valid records, 14 records needing review, 0 invalid records. Review queue accumulating; no reviews resolved yet.
- Continued batches: scraped more targets (a throttle event failed 13, all recovered via the new `scrape:paalam:retry`), extracted batch `paalam_extraction_batch_20260604054601` (27 records) into the master, bringing it to 72 validated records.
- Ran the first dedicated review pass over all 43 review-queued targets (2026-06-04) to reach a clean start before the next scrape:
  - Resolved 16 (review_status=reviewed): 6 source-backed corrections recorded in `data/qa/manual_fixes.csv` (fuller canonical names for Dominic Estillore Yabut and Jesus Valino Pelmoka; incident-location fixes for Antonio Rodriguez -> Balayan, Batangas, Jordan Abrigo and Jayvee De Guzman -> Muntinlupa City, and "Yaba" -> Pili, Camarines Sur) plus 10 accept-with-note records (alias-only, gender-missing, minimal-profile, source-derived locations). Source extraction JSONL left unchanged as the audit trail; corrections live in manual_fixes for the later normalize/export step.
  - Parked 27 as review_status=needs_follow_up (editorial/scope and data-quality calls for Yani): watchlist mayors, an apparent activist/"state forces" killing, a 16-year-old allegedly handcuffed and shot (also a date discrepancy), public officials, victims with no drug-war link in the source, anonymous victims, and 3 targets with no usable source link / not extracted. Each has a one-line note in `data/qa/review_queue.csv`.
  - Result: 0 failed targets and 0 review_status=queued. Counts: scraped 75, queued 3274; extraction validated 72; review needs_follow_up 27, reviewed 16.
- Fixed a workflow bug in `validate-paalam-extractions.ts`: it had unconditionally reset review_status to "queued" for every needs_review record, which wiped review dispositions on each run. It now preserves already-dispositioned statuses (reviewed/needs_follow_up/in_review) and only queues freshly-flagged rows.
- Ran Paalam batch scrape `paalam_batch_20260603081835`; fetched 20 queued profile pages, 7 succeeded, 13 failed with network errors (rate-limit or connection drop mid-batch). All failures tracked in `data/raw/paalam/failed_urls.jsonl`.
- Ran scrape-quality review; 47 scraped targets reviewed, 45 ready for AI extraction, 2 needing review.
- Prepared extraction batch `paalam_extraction_batch_20260603083113` with 6 newly scraped ready records.
- Extracted 6 records from `paalam_extraction_batch_20260603083113`; total is now 45 records.
- Ran Paalam extraction validation; 45 valid records, 18 needing review, 0 invalid records. Review queue accumulating; no reviews resolved yet.
- Notable issues flagged this session: location discrepancy on Antonio Rodriguez (profile says Lucena/Laguna, source says Balayan/Batangas); 2 politically sensitive mayoral killings (Christopher Cuan, Caesar Perez) flagged for human review.
