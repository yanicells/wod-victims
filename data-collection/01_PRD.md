# PRD: Philippine Drug War Victim Map and Timeline

## 1. Product summary

A journalism-focused, human-centered web project that maps and presents named victims of the Philippine drug war.

The core experience is a Philippine map and timeline where users can explore documented victims by name, date, and location, while clearly showing uncertainty and source provenance.

## 2. Main goal

Open people’s eyes through a clear visual and human presentation of the scale of reported killings.

The project should feel like a mix of:

- memorial archive
- data journalism project
- lightweight research dataset

It should not feel like a crime dashboard or a gamified statistics tool.

## 3. Target audience

Primary:

- students
- journalists
- researchers
- civic groups
- general public

Secondary:

- human rights advocates
- educators
- developers/data people interested in public-interest data work

## 4. Scope

### In scope for v1

- Named victim records from public sources
- Map by barangay, city, or province depending on available evidence
- Timeline by date or month
- Victim popup/card with:
  - name
  - age, if available
  - date killed, if available
  - location, if available
  - source link
  - confidence/verification label
- Public dataset export, if ethically acceptable
- Clear methodology page

### Out of scope for v1

- Photos
- Exact home addresses
- Family-sensitive details
- Automatically claiming cause/motive beyond source wording
- Full nationwide comparison with schools, hospitals, and government buildings
- Perfect deduplication across every source

## 5. Data source strategy

### Primary source for v1

Paalam.org should be the first target because it is names-first and memorial-oriented.

Why:

- It directly supports the desired named-victim experience.
- It has a public list of known victims.
- It aligns with the human-centered framing.

Limitation:

- It may not consistently provide structured date, age, barangay, or coordinates.

### Secondary sources

Use these only after the Paalam pipeline works:

1. Dahas Project  
   Useful for methodology, definitions, and potentially data access or comparison.

2. Ateneo / Drug Archive dataset  
   Potentially valuable victim-level dataset, but raw data access may require searching or contacting authors.

3. ACLED  
   Useful for event-level comparison and severity mapping, but not ideal as the main source because it is not names-first.

4. Linked news articles  
   Use only when they are linked from a victim profile or needed to fill missing date/location fields.

## 6. Product principles

### Principle 1: Names first, but not false precision

The project can show names, but it should not invent or overstate location precision.

Allowed location levels:

- exact public incident location
- barangay centroid
- city/municipality centroid
- province aggregate
- unknown/location unavailable

### Principle 2: Every public record needs provenance

Each public record should have at least one source URL or source note.

If no source exists, the record can remain internal but should not be shown publicly as verified.

### Principle 3: AI can help, but must leave receipts

AI-extracted fields should include:

- extracted value
- confidence score
- source quote
- reasoning note
- needs_review flag

### Principle 4: Small clean layers beat one messy giant dataset

The project should support layers:

- named victims
- mapped victims
- timeline victims
- aggregate counts
- future comparison layers

Do not force every record into every layer.

### Principle 5: The data pipeline is a long-term system

The project should not depend on memory, one-off scripts, or a single AI chat knowing what happened before.

The pipeline should track:

- source families approved for scraping or future research
- discovered URLs
- scraped URLs
- raw snapshots
- content hashes
- failed URLs
- changed pages
- extraction status
- review status
- recheck cadence

This makes the project scalable across Paalam, linked sources, and future datasets without wasting time redoing work or losing provenance.

## 7. User experience

### Homepage

The homepage should quickly communicate:

- what the project is
- what it shows
- what the data limitations are
- how to explore the map/timeline

### Map view

Users should be able to:

- zoom and pan around the Philippines
- filter by year/month
- filter by location precision
- click a marker or area
- view victim names and basic details
- open the original source

### Timeline view

Users should be able to:

- see killings over time
- filter by location
- click a time period and see matching victims
- understand whether the timeline is based on exact dates or approximate dates

### Victim popup/card

Minimum card fields:

- name
- age, if known
- date killed, if known
- location
- source
- confidence label
- notes, if needed

Example:

```text
Juan Dela Cruz
Age: 27
Date: August 2016
Location: Barangay X, City Y, Province Z
Location precision: Barangay centroid
Source: [link]
Confidence: Medium
```

## 8. Future comparison feature

The future comparison idea is good, but it should be aggregate-based.

Possible comparison layers:

- public schools/classrooms
- hospitals/health centers
- police stations
- government buildings

Recommended level:

- barangay if available and reliable
- city/municipality as default
- province if barangay/city data is too sparse

Do not compare individual victim pins to buildings directly. Compare counts by area.

Example:

```text
City A
Named victims mapped: 42
Public schools: 18
Health facilities: 9
Police stations: 3
```

## 9. Success criteria

### Data success

- Raw scraped data is preserved.
- Source registry and scrape target trackers exist.
- Already-scraped, changed, unchanged, and failed URLs are visible.
- Raw snapshots are append-only and traceable to scraper runs.
- Every cleaned field has source evidence.
- Every record has a confidence status.
- Duplicate handling is documented.
- The dataset can be regenerated from scripts.

### Product success

- A user can understand the scale and human reality quickly.
- A user can trace claims back to sources.
- Uncertainty is visible instead of hidden.
- The project can be expanded without redoing the data model.

## 10. Non-negotiables

- Do not show photos in v1.
- Do not expose exact private addresses.
- Do not publish source-less records as verified.
- Do not let AI silently invent missing values.
- Do not treat the dataset as complete or official.
- Do not label people beyond what sources say.

## 11. Recommended MVP

The first serious MVP should include:

- Paalam scraper
- raw page archive
- AI extraction pipeline
- confidence scoring
- cleaned victim table
- location normalization
- map + timeline
- methodology page

The MVP does not need perfect nationwide coverage. It needs a working, honest, reproducible pipeline.
