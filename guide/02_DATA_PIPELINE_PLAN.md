# Data Pipeline Plan

## 1. Goal

Turn Paalam's public victim profiles into a clean, reviewable JSONL dataset, using a deterministic parser instead of AI extraction for core fields.

## 2. High-level flow

```text
discover-paalam.ts
  -> sitemap.xml + WP REST /wp/v2/victim
  -> data/paalam/state.json (discoveredUrls)

ingest-paalam.ts, per URL
  -> fetch HTML
  -> parse-paalam-profile.ts (Cheerio, labeled fields only)
  -> data/paalam/victims.jsonl (append)
  -> delete fetched HTML

summary-paalam.ts -> stats + needsReview breakdown

(later) normalize -> dedupe -> confidence/export -> map + timeline app
```

No raw HTML or raw text is committed. `data/cache/paalam/` holds HTML only for the duration of one `ingest-paalam.ts` run and is gitignored.

## 3. Folder structure

```text
/data
  /paalam
    state.json       discovered/completed/failed URLs
    victims.jsonl     one PaalamVictimRecord per line (committed)
  /cache
    /paalam           temporary HTML during ingest (gitignored, deleted after run)

/data-pipeline
  package.json
  scripts/
    discover-paalam.ts
    ingest-paalam.ts
    summary-paalam.ts
    compare-parser-vs-ai.ts
    lib/
    __tests__/

/apps
  web/       (future)

/docs        (future methodology page)
```

`data/ops`, `data/raw`, `data/intermediate`, `data/processed`, `data/qa` are leftovers from the old scrape-then-AI-extract pipeline. They are not part of the current flow and are not touched by `discover-paalam.ts` / `ingest-paalam.ts` / `summary-paalam.ts`.

## 4. State tracking (`data/paalam/state.json`)

One file, not a set of CSV trackers. Shape:

```text
source: "paalam"
updatedAt: ISO timestamp
discoveredUrls: string[]      all known profile URLs
completedIds: string[]        target IDs already ingested
failed: [{ id, url, error, failedAt, attempts }]
```

- `discover-paalam.ts` only appends to `discoveredUrls`. It never fetches a profile page.
- `ingest-paalam.ts` computes the pending queue as `discoveredUrls` minus (`completedIds` union IDs already present in `victims.jsonl`), takes the next `--limit`, and processes them one at a time with a delay between requests.
- A target ID is a deterministic hash of the canonical URL (`lib/ids.ts`), so rerunning discovery or ingest never creates duplicates.
- On success: append the record to `victims.jsonl`, add the ID to `completedIds`, clear it from `failed`.
- On failure: bump `attempts`, record the error in `failed`. Failed URLs stay in the queue for a future `ingest-paalam.ts` run (they are not automatically retried within the same run beyond `--retries`).
- After `--max-consecutive-failures` (default 5) failures in a row, the run stops — this is almost always Paalam throttling, not real per-page errors.

## 5. Parsing rules (`lib/parse-paalam-profile.ts`)

The parser reads two things on each profile page, both structural, never narrative:

1. `ul.plm-details` (non-source) list items — `label: value` pairs (Sex, Age, Marital Status, Occupation, Date of Incident, Time of Incident, Location of Incident) plus an unlabeled incident-type line.
2. `ul.plm-details.source` — the outgoing source link(s).

Rules:

- A field with no labeled value stays `null`. The parser does not read the narrative paragraphs to fill in a missing age, date, or location.
- Dates are parsed into `exact_date` / `month` / `year` / `unknown` precision — never invented from a vaguer mention.
- Location text is split on commas into `cityMunicipality` / `province`, with a couple of known-typo and Metro-Manila-alias fixes. No geocoding.
- Source links pointing back to `paalam.org` itself are dropped as non-external; malformed `href`s are recorded as a warning and a review reason, not silently ignored.

See `guide/03_DATA_SCHEMA.md` for the full record shape and `data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts` for the fixture-backed test cases (full profile, missing age, anonymous victim, public figure, location typo, age-in-separate-field).

## 6. Review flags

Every record gets `needsReview: boolean` + `reviewReasons: string[]`. Possible reasons:

```text
missing_name
anonymous_or_unnamed
missing_or_unparsed_date
missing_location
missing_source_url
malformed_source_link
sensitive_public_figure
```

Flagged records are still written to `victims.jsonl` — they are not dropped, and nothing is invented to unblock them. Treat them as "don't show publicly without a second look."

## 7. Source order

**Phase 1 (current): Paalam only.** Discover, ingest, parse, review.

**Phase 2 (later): linked news.** Only news articles already present in a Paalam record's `sourceUrls` — not open-ended news scraping.

**Phase 3 (later): external datasets.** Dahas, Ateneo/Drug Archive, ACLED — for validation, context, and aggregate comparison, added only after Paalam ingest is stable.

## 8. Not built yet

In rough order:

1. **Location normalization** — match `cityMunicipality`/`province` text against a PSGC reference for consistent naming and centroid coordinates. Do not invent barangay-level precision.
2. **Deduplication** — conservative matching (name + date + location + shared source), flag possible duplicates rather than auto-merging.
3. **Confidence/export** — decide which fields are public-ready (has source, not `needsReview`, or manually reviewed) and produce a public JSON/CSV export separate from the full `victims.jsonl`.
4. **Map + timeline app** (`apps/web`).
5. **Methodology page** (`docs/`).

## 9. Public methodology notes (for later)

```text
This project uses public memorial and media sources to document named victims of the Philippine drug war. Structured fields are parsed directly from the source page's own labeled details — never AI-inferred or invented. The map uses the best available public location precision and avoids exact private addresses. Counts should be interpreted as documented records, not the complete death toll.
```
