# Drug War Victim Mapping Project

A journalism-focused, names-first map and timeline of named victims of the Philippine drug war, built from public sources. Primary source: [Paalam.org](https://paalam.org).

## How the data pipeline works

Parser-first. No AI extraction for core fields.

```text
pnpm discover:paalam                  # find profile URLs -> data/paalam/state.json
pnpm ingest:paalam -- --limit=20      # fetch + parse + append -> data/paalam/victims.jsonl
pnpm summary:paalam                   # dataset stats
pnpm test                             # parser unit tests
```

1. **Discover** — `discover-paalam.ts` reads Paalam's sitemap and WordPress REST API for victim profile URLs. Fetches no profile pages.
2. **Ingest** — `ingest-paalam.ts` fetches each queued profile page, parses the labeled `plm-details` fields with Cheerio (`lib/parse-paalam-profile.ts`), appends one clean JSON record per victim to `data/paalam/victims.jsonl`, then deletes the fetched HTML. Nothing raw is kept.
3. **Review flags** — records with missing name/date/location/source, malformed source links, or a sensitive-occupation subject are flagged `needsReview` with reasons, not silently dropped or invented.
4. **Later** — normalization, dedupe, confidence scoring, map/timeline, and public export (not built yet).

See `data-pipeline/README.md` for commands and `guide/02_DATA_PIPELINE_PLAN.md` for the full pipeline design.

## Blunt project rules

- No photos, no exact home addresses, no invented facts.
- Every public record needs a source link.
- Anonymous victims, missing sources, and public figures are flagged for review, not hidden.
- The parser only reads Paalam's labeled detail fields. It never infers facts from narrative text.

## Repo layout

```text
guide/             Planning docs: PRD, pipeline plan, schema, workflow guide
data-pipeline/     TypeScript scripts: discover, ingest/parse, summary, tests
data/paalam/       Committed output: victims.jsonl + state.json
data/cache/        Temporary HTML fetch cache (gitignored, deleted after each ingest)
apps/web/          Next.js app scaffold (map/timeline later)
docs/              Future public methodology page
```

Use `pnpm` from the repo root.

```text
pnpm test                 # pipeline tests
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20
pnpm summary:paalam
pnpm dev                  # Next.js web app
```

## Start here

1. `guide/07_SCRAPING_STUDY_GUIDE.md` — learn how the project and parser work (concepts first)
2. `guide/00_WORKFLOW_GUIDE.md` — what to run day to day
