# Data Pipeline Plan

## 1. Goal

Create a reproducible pipeline that turns public victim/name sources into a usable dataset for a map, timeline, and victim popup UI.

The pipeline should prioritize speed, reproducibility, and transparent uncertainty.

## 2. High-level flow

```text
Source discovery
→ scrape raw pages
→ save raw HTML/text
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
  /raw
    /paalam
      pages/
      index_pages/
      scrape_log.jsonl
    /news
      pages/
      scrape_log.jsonl

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

## 4. Source order

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
  "page_url": "",
  "scraped_at": "",
  "raw_html_path": "",
  "raw_text": "",
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

## 5. Scraping rules

### Must do

- Respect robots.txt and site terms.
- Use slow request rate.
- Save raw HTML before extraction.
- Save scrape logs.
- Save failed URLs.
- Make scripts restartable.
- Include `scraped_at`.
- Include source URL in every record.

### Avoid

- aggressive scraping
- scraping unrelated news sites
- scraping photos
- scraping comments/social media
- assuming profile page structure is stable

## 6. AI extraction design

AI should read raw text and output strict JSON.

### AI extraction output

```json
{
  "record_type": "victim_profile",
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

## 7. AI confidence rules

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

## 8. Field extraction rules

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

## 9. Location normalization

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

## 10. Coordinates

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

## 11. Deduplication

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

## 12. Review strategy

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

## 13. Dataset layers

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

## 14. Output files

Recommended exports:

```text
victims_public.csv
victims_public.json
victims_internal_review.csv
incidents_public.csv
sources_public.csv
methodology.json
```

## 15. Public methodology notes

The project should clearly say:

```text
This project uses public memorial and media sources to document named victims of the Philippine drug war. Data fields may be source-reported, machine-extracted, or manually reviewed. The map uses the best available public location precision and avoids exact private addresses. Counts should be interpreted as documented records, not the complete death toll.
```

## 16. First build checklist

1. Build Paalam scraper.
2. Save raw HTML and raw text.
3. Extract name/profile/source links.
4. Run AI extraction on 20 sample pages.
5. Inspect results.
6. Update extraction schema.
7. Run on 100 records.
8. Build normalization script.
9. Build review queue.
10. Export first public CSV.
11. Only then connect to the web app.
