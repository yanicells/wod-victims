# Scripts

Data pipeline scripts will live here.

No live scraping scripts have been added yet.

Current starter commands:

```text
pnpm validate:workspace
pnpm ops:summary
pnpm check
pnpm discover:paalam -- --dry-run
```

- `validate:workspace` checks that the data folders and tracker files exist and have the expected headers.
- `ops:summary` prints a quick status count for sources, scrape targets, recheck queue items, and scrape runs.
- `check` runs the TypeScript compiler without generating files.
- `discover:paalam` finds Paalam profile URLs from sitemap and WordPress REST metadata. It does not fetch profile pages.
