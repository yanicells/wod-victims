# Data Schema and Quality Rules

## 1. Core tables

Use separate tables for victims, incidents, sources, and extraction runs.

Do not put everything into one table.

## 2. `victims`

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

## 3. `locations`

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

## 4. `incidents`

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

## 5. `sources`

One row per source URL or source document.

```text
source_id
source_url
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

## 6. `victim_sources`

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

## 7. `ai_extractions`

One row per AI extraction attempt.

```text
extraction_id
source_id
model_name
prompt_version
input_hash
output_json
extracted_at
parser_status
warnings
```

This makes the pipeline reproducible and debuggable.

## 8. `review_queue`

Rows needing human or second-AI review.

```text
review_id
record_type
record_id
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
```

## 9. Verification statuses

```text
raw
machine_extracted
second_ai_checked
needs_human_review
human_reviewed
public_ready
do_not_publish
```

## 10. Confidence levels

Use both numeric and readable labels.

```text
high = 0.90 to 1.00
medium = 0.70 to 0.89
low = 0.50 to 0.69
very_low = 0.00 to 0.49
```

## 11. Public record rules

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

## 12. Public wording rules

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

## 13. Example victim JSON

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
