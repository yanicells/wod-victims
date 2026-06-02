# Data Schema and Quality Rules

## 1. Core tables

Use separate tables for operational tracking, raw sources, victims, incidents, source evidence, extraction runs, and review queues.

Do not put everything into one table.

## 2. Operational tracking tables

These tables track long-term scraping and updates. They are not public-facing data tables, but they prevent repeated work and make future rechecks possible.

### `source_registry`

One row per source family.

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
created_at
updated_at
```

### `scrape_targets`

One row per URL or durable scrape target.

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
created_at
updated_at
```

### `scrape_runs`

One row per scraper run.

```text
run_id
source_key
mode
started_at
finished_at
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

### `raw_snapshots`

One row per successful raw capture. Raw snapshot files should be append-only.

```text
snapshot_id
target_id
run_id
source_key
url
fetched_at
http_status
content_hash
raw_html_path
raw_text_path
outgoing_links_json
metadata_json
notes
```

## 3. `victims`

One row per person.

```text
victim_id
canonical_name
display_name
alternate_names
age
age_confidence
gender
date_killed
date_precision
location_id
incident_id
profile_url
source_dataset
verification_status
confidence_level
needs_review
public_notes
internal_notes
created_at
updated_at
```

### Notes

- `canonical_name` is normalized for matching.
- `display_name` is what users see.
- `alternate_names` stores aliases, nicknames, spelling variants.
- `age` can be null.
- `date_killed` can be null.
- `incident_id` can be null if the person cannot be linked to a structured incident.

## 4. `locations`

One row per normalized place.

```text
location_id
raw_location_text
region
province
city_municipality
barangay
latitude
longitude
location_precision
normalization_confidence
psgc_code
notes
```

### `location_precision` enum

```text
exact_public_location
barangay
city_municipality
province
unknown
```

## 5. `incidents`

One row per incident/event, if identifiable.

```text
incident_id
date
date_precision
location_id
fatalities_count
incident_type
actor_type
source_summary
confidence_level
needs_review
created_at
updated_at
```

### `incident_type` enum

```text
police_operation
vigilante_style
riding_in_tandem
unknown
other
```

Use only when supported by the source.

## 6. `sources`

One row per source URL or source document.

```text
source_id
source_key
target_id
snapshot_id
source_url
canonical_url
source_title
source_type
publisher
published_date
scraped_at
raw_html_path
raw_text_path
access_status
notes
```

### `source_type` enum

```text
memorial_profile
news_article
database_page
academic_paper
organization_report
unknown
```

## 7. `victim_sources`

Many-to-many table linking victims to sources.

```text
victim_id
source_id
relationship_type
field_supported
source_quote
confidence
created_at
```

### `relationship_type` enum

```text
primary_profile
supporting_source
conflicting_source
duplicate_candidate_source
```

## 8. `ai_extractions`

One row per AI extraction attempt.

```text
extraction_id
source_id
source_key
target_id
snapshot_id
model_name
prompt_version
input_hash
output_json
extracted_at
parser_status
warnings
```

This makes the pipeline reproducible and debuggable.

## 9. `review_queue`

Rows needing human or second-AI review.

```text
review_id
record_type
record_id
source_key
target_id
issue_type
issue_description
priority
assigned_to
status
review_notes
created_at
resolved_at
```

### `issue_type` enum

```text
missing_source
low_confidence
possible_duplicate
conflicting_name
conflicting_age
conflicting_date
conflicting_location
too_precise_location
sensitive_detail
parser_error
scrape_failed
page_changed
needs_recheck
```

## 10. Operational status enums

### `source_registry.status`

```text
backlog
approved
active
paused
blocked
retired
```

### `scrape_targets.target_type`

```text
index_page
profile_page
news_article
dataset_page
pdf
api_endpoint
unknown
```

### `scrape_targets.status`

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

### `scrape_runs.mode`

```text
discover
initial_scrape
recheck
retry_failed
backfill
sample
```

### `extraction_status`

```text
not_started
queued
extracted
validated
failed
skipped_unchanged
needs_rerun
```

### `review_status`

```text
not_required
queued
in_review
reviewed
needs_follow_up
```

## 11. Verification statuses

```text
raw
machine_extracted
second_ai_checked
needs_human_review
human_reviewed
public_ready
do_not_publish
```

## 12. Confidence levels

Use both numeric and readable labels.

```text
high = 0.90 to 1.00
medium = 0.70 to 0.89
low = 0.50 to 0.69
very_low = 0.00 to 0.49
```

## 13. Public record rules

A record can appear publicly if:

```text
display_name exists
AND source URL exists
AND duplicate status is not unresolved
AND verification_status is not raw
AND sensitive fields are removed
```

A record can appear on the map if:

```text
public record rules pass
AND location_precision is barangay, city_municipality, province, or exact_public_location
AND coordinates exist
```

A record can appear as a pin if:

```text
location_precision is exact_public_location, barangay, or city_municipality
```

Province-only records should usually appear in aggregate views, not individual pins.

## 14. Public wording rules

Use:

- "reported"
- "documented"
- "source-reported"
- "identified"
- "location precision"

Avoid:

- "confirmed killed by"
- "true count"
- "criminal"
- "drug suspect" unless directly quoted and attributed
- "exact location" unless actually exact and public

## 15. Example victim JSON

```json
{
  "victim_id": "vic_000001",
  "display_name": "Juan Dela Cruz",
  "canonical_name": "juan dela cruz",
  "alternate_names": [],
  "age": 27,
  "age_confidence": 0.95,
  "date_killed": "2016-08-12",
  "date_precision": "exact_date",
  "location": {
    "region": "National Capital Region",
    "province": null,
    "city_municipality": "Quezon City",
    "barangay": "Payatas",
    "location_precision": "barangay",
    "latitude": null,
    "longitude": null
  },
  "profile_url": "https://example.com",
  "source_dataset": "paalam",
  "verification_status": "machine_extracted",
  "confidence_level": "medium",
  "needs_review": true
}
```
