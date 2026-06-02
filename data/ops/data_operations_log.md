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
