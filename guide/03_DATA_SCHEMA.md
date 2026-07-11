# Data Schema

Source of truth: `data-pipeline/scripts/lib/paalam-record.ts` (type `PaalamVictimRecord`), built from `data-pipeline/scripts/lib/parse-paalam-profile.ts` (type `ParsedPaalamProfile`). Read those files if this doc and the code ever disagree — the code wins.

## `PaalamVictimRecord` (one line in `data/paalam/victims.jsonl`)

```text
id                  deterministic hash of the canonical profile URL, e.g. "paalam_profile_<hash>"
source              "paalam"
profileUrl          canonical Paalam profile URL
scrapedAt           ISO timestamp of fetch
contentHash         SHA-256 of the raw HTML fetched

name                string | null — from <h1> or og:title, site suffix stripped
alias               string | null — labeled "Alias" field
gender              "male" | "female" | "unknown"
age                 number | null — labeled "Age" field only, never inferred from narrative
maritalStatus       string | null
occupation          string | null

incidentType        string | null — unlabeled line in the details list, e.g. "Killed in police operation"
dateKilled          string | null — ISO date ("YYYY-MM-DD"), ISO month ("YYYY-MM"), or year ("YYYY"), matching datePrecision
datePrecision       "exact_date" | "month" | "year" | "unknown"
dateRaw             string | null — the raw "Date of Incident" text, kept even if unparsed
timeOfIncident      string | null

locationRaw         string | null — normalized "Location of Incident" text
cityMunicipality     string | null
province            string | null
region               string | null — currently only ever "National Capital Region"
locationPrecision   "barangay" | "city_municipality" | "province" | "unknown"

sourceUrls          string[] — external links only; paalam.org self-links excluded
warnings            string[] — non-blocking notes, e.g. "age mentioned in narrative but missing from profile details"
needsReview         boolean
reviewReasons       string[]
```

### `reviewReasons` values

```text
missing_name
anonymous_or_unnamed
missing_or_unparsed_date
missing_location
missing_source_url
malformed_source_link
sensitive_public_figure
```

A record can have more than one reason. Reasons describe what's uncertain — they don't mean the record is wrong, and they don't get "fixed" by inventing a value.

## Design rules

- **No `locationPrecision: "barangay"` today.** The parser only splits on commas into city/province; barangay-level detection isn't implemented yet. Don't map anything as barangay-precise until that lands.
- **Never invent.** If a field isn't in a labeled `plm-details` entry, it's `null`. Narrative text may be inspected ephemerally to explain a warning like "age mentioned in narrative but not the profile box," but it is not saved or used as a structured-field source.
- **Coordinates are not generated yet.** Location fields are text only. Add centroid coordinates only after real location normalization exists (see `guide/02_DATA_PIPELINE_PLAN.md`).

## Public display rules

A record is safe to show publicly if:

```text
name exists (not anonymous/unnamed)
AND sourceUrls.length > 0
AND needsReview is false, OR the record has been manually reviewed and cleared
```

A record can appear on the map if it additionally has `locationPrecision` of `city_municipality` or `province` (province-level should be shown as aggregate, not an individual pin).

Public wording:

- Use: "reported", "documented", "source-reported", "identified", "location precision".
- Avoid: "confirmed killed by", "true count", "criminal", "drug suspect" unless directly quoted and attributed, "exact location" unless actually exact and public.

## Example record

```json
{
  "id": "paalam_profile_ab12cd34ef56",
  "source": "paalam",
  "profileUrl": "https://paalam.org/homepage/victims/johndy-maglinte/",
  "scrapedAt": "2026-07-09T08:12:00.000Z",
  "contentHash": "9f2c...",
  "name": "Johndy Maglinte",
  "alias": null,
  "gender": "male",
  "age": 16,
  "maritalStatus": "Single",
  "occupation": null,
  "incidentType": "Killed in police operation",
  "dateKilled": "2021-06-17",
  "datePrecision": "exact_date",
  "dateRaw": "June 17, 2021",
  "timeOfIncident": null,
  "locationRaw": "Binan, Laguna",
  "cityMunicipality": "Binan",
  "province": "Laguna",
  "region": null,
  "locationPrecision": "city_municipality",
  "sourceUrls": [
    "https://www.rappler.com/nation/cops-kill-16-year-old-boy-laguna-anti-drug-operation"
  ],
  "warnings": [],
  "needsReview": false,
  "reviewReasons": []
}
```
