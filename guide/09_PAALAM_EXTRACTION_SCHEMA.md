# Paalam Extraction Schema

Use this schema when extracting structured victim data from Paalam raw text.

Output must be JSONL: one JSON object per input record.

Input batches are created by:

```text
pnpm prepare:paalam:extraction -- --limit=20
```

Append extraction output to:

```text
data/intermediate/extractions/paalam_ai_extracts.jsonl
```

Validate output with:

```text
pnpm validate:paalam:extraction
```

Every output object must match this shape:

```json
{
  "source_key": "paalam",
  "target_id": "paalam_profile_example",
  "snapshot_id": "snapshot_id_here",
  "source_url": "https://paalam.org/homepage/victims/example/",
  "raw_text_path": "data/raw/paalam/snapshots/example.txt",
  "profile_url": "https://paalam.org/homepage/victims/example/",
  "name": {
    "value": null,
    "source_quote": "",
    "confidence": 0
  },
  "age": {
    "value": null,
    "source_quote": "",
    "confidence": 0
  },
  "gender": {
    "value": "unknown",
    "source_quote": "",
    "confidence": 0
  },
  "date_killed": {
    "value": null,
    "date_precision": "unknown",
    "source_quote": "",
    "confidence": 0
  },
  "location": {
    "raw_location": null,
    "barangay": null,
    "city_municipality": null,
    "province": null,
    "region": null,
    "location_precision": "unknown",
    "source_quote": "",
    "confidence": 0
  },
  "incident_context": {
    "short_summary": "",
    "source_quote": "",
    "confidence": 0
  },
  "source_urls": [],
  "warnings": [],
  "needs_review": true,
  "review_reason": ""
}
```

Rules:

- Do not invent data.
- Use `null` for missing values.
- Every non-null field must have a supporting `source_quote`.
- A quote should be copied from the raw text and should directly support the value.
- Use confidence from `0` to `1`.
- Use `needs_review: true` when source support is weak, source links are missing, or location needs checking.
- Do not infer barangay if only city is supported.
- Do not add exact coordinates.
- Do not use photos.
- Do not fetch or summarize linked news articles during Paalam profile extraction.
- Preserve all IDs and paths from the extraction batch input.

Allowed date precision:

```text
exact_date
month
year
unknown
```

Allowed location precision:

```text
exact_public_location
barangay
city_municipality
province
unknown
```
