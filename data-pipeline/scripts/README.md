# Scripts

Data pipeline scripts live here.

Current starter commands:

```text
pnpm validate:workspace
pnpm ops:summary
pnpm check
pnpm discover:paalam -- --dry-run
pnpm scrape:paalam:batch -- --limit=20 --delay-ms=2500
pnpm scrape:paalam:sample -- --limit=5 --delay-ms=2500
pnpm review:paalam:scrape-quality
pnpm prepare:paalam:extraction -- --limit=20
pnpm validate:paalam:extraction
```

- `validate:workspace` checks that the data folders and tracker files exist and have the expected headers.
- `ops:summary` prints a quick status count for sources, scrape targets, recheck queue items, and scrape runs.
- `check` runs the TypeScript compiler without generating files.
- `discover:paalam` finds Paalam profile URLs from sitemap and WordPress REST metadata. It does not fetch profile pages.
- `scrape:paalam:batch` fetches the next queued Paalam profile pages and saves raw HTML/text snapshots for real pipeline continuation.
- `scrape:paalam:sample` runs the same scraper in a test/sample mode label.
- `review:paalam:scrape-quality` checks saved Paalam snapshots and writes scrape-quality reports.
- `prepare:paalam:extraction` creates a JSONL batch for AI extraction and marks matching targets as queued for extraction.
- `validate:paalam:extraction` validates AI output and updates target extraction/review statuses after successful validation.
