# Data Pipeline Plan

## 1. Goal

Create a reproducible pipeline that turns public victim/name sources into a usable dataset for a map, timeline, and victim popup UI.

The pipeline should also work as a long-term operating system for data collection: track what has already been discovered, scraped, changed, extracted, validated, reviewed, and exported.

## 2. High-level flow

```text
Source registry and backlog
→ target discovery queue
→ scrape or recheck run
→ save raw HTML/text snapshot
→ compare content hash with previous snapshot
→ extraction queue for new or changed pages
→ AI extraction
→ structured JSON output
→ validation
→ location normalization
→ deduplication
→ confidence scoring
→ review queue
→ cleaned CSV/JSON export
→ app ingestion
```

## 3. Folder structure

```text
/data
  /ops
    source_registry.csv
    scrape_targets.csv
    scrape_runs.jsonl
    recheck_queue.csv
    source_backlog.md
    data_operations_log.md

  /raw
    /paalam
      pages/
      index_pages/
      snapshots/
      manifests/
      failed_urls.jsonl
    /news
      pages/
      snapshots/
      manifests/
      failed_urls.jsonl

  /intermediate
    /extractions
      paalam_ai_extracts.jsonl
      news_ai_extracts.jsonl
    /normalized
      victims_normalized.jsonl
      locations_normalized.jsonl
    /dedupe
      candidate_duplicates.jsonl

  /processed
    victims.csv
    incidents.csv
    sources.csv
    methodology_notes.md

  /qa
    review_queue.csv
    rejected_records.csv
    manual_fixes.csv
```

## 4. Long-term tracking model

The project should keep operational state outside the cleaned dataset. The cleaned dataset answers "what do we know about victims?" The trackers answer "what have we already done, what changed, and what is next?"

### `source_registry.csv`

One row per source family, not one row per victim.

Example source families:

- `paalam`
- `paalam_linked_news`
- `dahas`
- `drug_archive`
- `acled`

Minimum fields:

```text
source_key
source_name
source_type
base_url
status
priority
owner
robots_checked_at
terms_notes
scrape_strategy
recheck_frequency_days
last_discovery_run_id
last_scrape_run_id
notes
```

Suggested `status` values:

```text
backlog
approved
active
paused
blocked
retired
```

### `scrape_targets.csv`

One row per URL or durable target. This is the main "have we already scraped this?" tracker.

Minimum fields:

```text
target_id
source_key
url
canonical_url
target_type
discovered_at
discovered_from_url
status
priority
last_scraped_at
last_success_at
last_checked_at
last_http_status
last_content_hash
latest_raw_html_path
latest_raw_text_path
latest_snapshot_id
extraction_status
review_status
failure_count
next_retry_at
notes
```

Suggested `target_type` values:

```text
index_page
profile_page
news_article
dataset_page
pdf
api_endpoint
unknown
```

Suggested `status` values:

```text
discovered
queued
scraped
unchanged
changed
failed
blocked
out_of_scope
retired
```

### `scrape_runs.jsonl`

One row per scraper run. This makes the work auditable and restartable.

Minimum fields:

```text
run_id
source_key
started_at
finished_at
mode
target_count
success_count
changed_count
unchanged_count
failed_count
script_version
git_commit
operator
notes
```

Suggested `mode` values:

```text
discover
initial_scrape
recheck
retry_failed
backfill
sample
```

### Raw snapshots and manifests

Raw data should be append-only. Do not overwrite a previous raw capture.

For every successful fetch:

- save raw HTML
- save plain text
- compute a content hash
- write a manifest record with `snapshot_id`, `run_id`, `target_id`, paths, HTTP status, timestamps, and content hash
- update `scrape_targets.csv` to point at the latest snapshot

If the content hash has not changed, the page can be marked `unchanged` and skipped by extraction unless the extraction schema or prompt changed.

## 5. Incremental update workflow

Use this workflow after the first scrape is complete:

1. Run discovery for active sources and add new URLs to `scrape_targets.csv`.
2. Recheck due targets based on `recheck_frequency_days`.
3. Save new raw snapshots for fetched pages.
4. Compare content hashes against the previous successful snapshot.
5. Queue extraction only for new pages, changed pages, or pages affected by a schema/prompt update.
6. Queue validation only for changed extraction output or low-confidence records.
7. Queue dedupe only for new/changed victim records.
8. Export public datasets from the latest validated state.

This avoids wasting time on unchanged pages while still preserving the ability to audit updates.

## 6. Source order

### Phase 1: Paalam only

Scrape:

- victim list pages
- individual victim/profile pages, if available
- source links from each profile
- raw visible text
- metadata such as page URL and scrape time

Minimum raw record:

```json
{
  "source_dataset": "paalam",
  "target_id": "",
  "snapshot_id": "",
  "run_id": "",
  "page_url": "",
  "scraped_at": "",
  "content_hash": "",
  "raw_html_path": "",
  "raw_text_path": "",
  "outgoing_source_links": []
}
```

### Phase 2: linked sources only

Only scrape news articles linked from Paalam pages.

Do not scrape random news sites yet.

Reason: random news scraping will explode the scope and create duplicate chaos.

### Phase 3: external datasets

Add Dahas, Ateneo/Drug Archive, or ACLED only after Phase 1 works.

Use them for:

- validation
- context
- aggregate comparison
- possible enrichment

Do not immediately merge everything.

## 7. Scraping rules

### Must do

- Respect robots.txt and site terms.
- Use slow request rate.
- Save raw HTML before extraction.
- Save scrape logs and run summaries.
- Save failed URLs.
- Make scripts restartable.
- Include `scraped_at`.
- Include source URL in every record.
- Assign a stable `target_id` to every URL.
- Assign a unique `snapshot_id` to every successful page capture.
- Compute content hashes so unchanged pages can be skipped later.
- Update scrape target status after each run.
- Keep failed URLs in retry queues with `failure_count` and `next_retry_at`.

### Avoid

- aggressive scraping
- scraping unrelated news sites
- scraping photos
- scraping comments/social media
- assuming profile page structure is stable
- overwriting old raw snapshots
- silently dropping URLs from the queue
- deleting failed targets just because they are inconvenient

## 8. AI extraction design

AI should read raw text and output strict JSON.

### AI extraction output

```json
{
  "record_type": "victim_profile",
  "source_key": "paalam",
  "target_id": "",
  "snapshot_id": "",
  "source_url": "",
  "name": {
    "value": "",
    "source_quote": "",
    "confidence": 0.0
  },
  "age": {
    "value": null,
    "source_quote": "",
    "confidence": 0.0
  },
  "gender": {
    "value": "unknown",
    "source_quote": "",
    "confidence": 0.0
  },
  "date_killed": {
    "value": null,
    "date_precision": "unknown",
    "source_quote": "",
    "confidence": 0.0
  },
  "location": {
    "barangay": null,
    "city_municipality": null,
    "province": null,
    "region": null,
    "source_quote": "",
    "confidence": 0.0
  },
  "incident_context": {
    "short_summary": "",
    "source_quote": "",
    "confidence": 0.0
  },
  "source_urls": [],
  "warnings": [],
  "needs_review": true
}
```

## 9. AI confidence rules

Use this scale:

```text
0.90 to 1.00 = explicit and clear in source
0.70 to 0.89 = strongly implied by source
0.50 to 0.69 = possible but needs review
0.00 to 0.49 = weak, do not publish as fact
```

### Public display rule

Only show fields publicly if:

- confidence is at least 0.70, or
- field has been manually reviewed

Fields below 0.70 can remain internal.

## 10. Field extraction rules

### Name

Allowed:

- full name from page title
- full name from list entry
- aliases/nicknames if explicitly shown

Not allowed:

- AI guessing spelling
- merging two names unless dedupe confirms it

### Age

Allowed:

- exact age from source
- age range only if source says so

Not allowed:

- estimating age from photo
- estimating age from school/job/life context

### Date killed

Allowed precisions:

```text
exact_date
month
year
unknown
```

Examples:

- "August 12, 2016" → exact_date
- "August 2016" → month
- "2016" → year
- no date → unknown

### Location

Allowed precision:

```text
exact_public_location
barangay
city_municipality
province
unknown
```

Blunt rule: if only city is known, plot city centroid. Do not invent barangay.

## 11. Location normalization

Use a Philippine geographic reference dataset.

Recommended matching order:

1. exact match to PSGC names
2. fuzzy match with manual review
3. province/city context match
4. unresolved queue

Store both:

- raw location text
- normalized location fields

Example:

```json
{
  "raw_location": "Payatas, Quezon City",
  "barangay": "Payatas",
  "city_municipality": "Quezon City",
  "province": null,
  "region": "National Capital Region",
  "location_precision": "barangay",
  "normalization_confidence": 0.92
}
```

## 12. Coordinates

Coordinates should be generated from the normalized location precision.

Rules:

```text
exact_public_location → use exact coordinates only if source clearly gives a public incident location
barangay → barangay centroid
city_municipality → city/municipality centroid
province → do not show as victim pin by default
unknown → no map point
```

Do not geocode private homes.

## 13. Deduplication

Deduping should be conservative.

### Matching signals

Use:

- normalized name similarity
- date similarity
- location similarity
- shared source URLs
- similar incident summary

### Suggested duplicate logic

```text
Auto-merge only if:
- name is very similar
- date matches or is very close
- city/province matches
- source overlaps or context strongly matches

Otherwise:
- flag as possible duplicate
- keep separate until reviewed
```

### Duplicate statuses

```text
unique
possible_duplicate
confirmed_duplicate
merged_record
rejected_duplicate
```

## 14. Review strategy

The user prefers minimal manual review, so use review queues instead of reviewing everything.

### Auto-publish candidate

Record can enter public dataset if:

- name confidence >= 0.90
- at least one source URL exists
- location confidence >= 0.70 or location is marked unknown
- date confidence >= 0.70 or date is marked unknown
- duplicate status is unique or reviewed

### Needs review

Flag if:

- possible duplicate
- no source URL
- conflicting ages
- conflicting dates
- conflicting locations
- AI confidence below threshold
- sensitive details detected
- location seems too precise

## 15. Dataset layers

Do not force one record to do everything.

### Layer 1: memorial list

Requirements:

- name
- source URL or profile URL

Can include records with unknown date/location.

### Layer 2: timeline

Requirements:

- name
- date or approximate date
- source URL

### Layer 3: map

Requirements:

- name
- location
- location precision
- source URL

### Layer 4: high-confidence map

Requirements:

- reviewed or high-confidence fields
- city/barangay/province normalized
- no unresolved duplicate issue

## 16. Output files

Recommended exports:

```text
victims_public.csv
victims_public.json
victims_internal_review.csv
incidents_public.csv
sources_public.csv
methodology.json
scrape_status_report.json
data_quality_report.json
```

## 17. Public methodology notes

The project should clearly say:

```text
This project uses public memorial and media sources to document named victims of the Philippine drug war. Data fields may be source-reported, machine-extracted, or manually reviewed. The map uses the best available public location precision and avoids exact private addresses. Counts should be interpreted as documented records, not the complete death toll.
```

## 18. First build checklist

1. Create `source_registry.csv`.
2. Create `scrape_targets.csv`.
3. Inspect Paalam page structure.
4. Add Paalam list/profile URLs to the target queue.
5. Build Paalam scraper with run IDs, target IDs, snapshot IDs, content hashes, logs, and retry handling.
6. Save raw HTML and raw text snapshots.
7. Extract name/profile/source links.
8. Run AI extraction on 20 new or changed records.
9. Inspect results.
10. Update extraction schema.
11. Run on 100 records.
12. Build normalization script.
13. Build review queue.
14. Export first public CSV.
15. Only then connect to the web app.
