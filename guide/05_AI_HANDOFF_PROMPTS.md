# AI Handoff Prompts

These prompts are meant for working across multiple AI conversations or agents.

## 1. Extractor prompt

Use this when feeding raw page text to an AI.

```text
You are extracting structured victim data from a public source about Philippine drug war victims.

Rules:
- Do not invent missing data.
- Extract only what the source text supports.
- If a field is missing, use null.
- Every non-null field must include a source quote.
- Give confidence from 0 to 1.
- Flag anything uncertain.
- Do not include photos.
- Do not infer exact coordinates.
- Return strict JSON only.

Required JSON shape:

{
  "source_key": "",
  "target_id": "",
  "snapshot_id": "",
  "source_url": "",
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
  "needs_review": true
}

Raw source text:
[PASTE RAW TEXT HERE]
```

## 2. Validator prompt

Use this to check another AI's extraction.

```text
You are validating AI-extracted victim data against the original source text.

Your job:
- Check if each extracted field is actually supported by the source text.
- Lower confidence if the quote is weak.
- Set unsupported fields to null.
- Add warnings for hallucinations, weak evidence, or conflicting info.
- Do not add new facts unless directly supported by the source.
- Return corrected JSON only.

Original source text:
[PASTE RAW TEXT]

Extractor output:
[PASTE JSON]
```

## 3. Deduplication prompt

Use this for candidate duplicate review.

```text
You are checking if two victim records refer to the same person.

Rules:
- Be conservative.
- Do not merge based on name alone.
- Use name, date, location, age, source URLs, and incident context.
- Output one of:
  - confirmed_duplicate
  - possible_duplicate
  - likely_unique
- Explain briefly.
- Return JSON only.

Record A:
[PASTE RECORD A]

Record B:
[PASTE RECORD B]
```

Expected output:

```json
{
  "decision": "possible_duplicate",
  "confidence": 0.76,
  "reason": "Names are similar and city matches, but date is missing in one record.",
  "merge_recommendation": "do_not_auto_merge"
}
```

## 4. Location normalization prompt

Use this when a location is messy or ambiguous.

```text
Normalize this Philippine location for a public-interest map.

Rules:
- Do not invent barangay/city/province.
- If the text only supports city, return city precision.
- If it only supports province, return province precision.
- If unclear, mark unknown.
- Return JSON only.

Raw location:
[PASTE LOCATION]

Context:
[PASTE SOURCE QUOTE OR ARTICLE SNIPPET]
```

Expected output:

```json
{
  "raw_location": "",
  "barangay": null,
  "city_municipality": null,
  "province": null,
  "region": null,
  "location_precision": "unknown",
  "confidence": 0,
  "reason": ""
}
```

## 5. Data quality report prompt

Use this after generating a batch.

```text
Review this dataset batch and summarize quality issues.

Focus on:
- missing source URLs
- missing dates
- missing locations
- low-confidence fields
- possible duplicate patterns
- fields that look hallucinated
- rows that should not be public yet

Return:
1. Summary
2. Major issues
3. Suggested fixes
4. Go/no-go recommendation for public use

Dataset sample or report:
[PASTE DATA]
```

## 6. Methodology drafting prompt

Use this when writing the public methodology page.

```text
Write a clear methodology section for a journalism-style web project mapping named victims of the Philippine drug war.

Must include:
- data sources
- what the project includes
- what it does not include
- how AI extraction was used
- how confidence labels work
- how location precision works
- why exact private addresses are not shown
- limitations
- how users should interpret the data

Tone:
- clear
- careful
- human-centered
- not corporate
- not overly long
```

## 7. Source onboarding prompt

Use this before adding a new source family to the active scraper backlog.

```text
Evaluate this source for a journalism-oriented Philippine drug war victim data pipeline.

Rules:
- Be practical and conservative.
- Do not assume data access if it is not obvious.
- Identify whether this source is names-first, event-level, methodology-only, or supporting evidence.
- Identify scraping risks, ethics risks, and update cadence.
- Recommend whether the source should be active, backlog, blocked, or out of scope.

Return markdown with:
1. Source summary
2. Best use in this project
3. Data likely available
4. Scraping or access risks
5. Ethical risks
6. Suggested source registry values
7. Recommended next task

Source:
[PASTE SOURCE URL OR DESCRIPTION]
```

## 8. Scrape/update operations prompt

Use this after a scrape, recheck, retry, or backfill run.

```text
Review this scrape/update report for a long-term public-interest data pipeline.

Focus on:
- targets newly discovered
- targets successfully scraped
- targets unchanged and safely skipped
- targets changed and needing extraction rerun
- targets failed and needing retry or manual review
- source families that should be paused or rechecked differently
- signs that the scraper broke because the site structure changed

Return:
1. Operational summary
2. What needs extraction
3. What needs retry
4. What needs manual review
5. Recommended tracker updates
6. Risks before public export

Scrape/update report:
[PASTE REPORT]
```
