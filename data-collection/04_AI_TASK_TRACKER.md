# AI Task Tracker

Use this file as the shared tracker across ChatGPT, Claude, scripts, and future agents.

## Project status

```text
Current phase: Planning
Current source: Paalam.org
Current goal: Build names-first data pipeline and first clean public dataset
```

## Roles

### Human lead

Owner: Yani

Responsibilities:

- final product decisions
- source approval
- public-facing wording
- final review of risky records
- deployment and app integration

### AI Agent 1: Extractor

Recommended tool: ChatGPT or Claude

Responsibilities:

- read raw page text
- extract structured JSON
- include source quotes
- assign confidence
- flag missing/uncertain fields

### AI Agent 2: Validator

Recommended tool: Claude or ChatGPT in a separate conversation

Responsibilities:

- check Extractor output
- detect hallucinated fields
- check if source quotes support values
- lower confidence if needed
- mark `needs_review`

### AI Agent 3: Deduper

Responsibilities:

- compare candidate records
- identify likely duplicates
- suggest merge decisions
- never delete raw records

### Script Agent

Responsibilities:

- scraping
- file saving
- parsing
- validation
- CSV/JSON export
- logs

## Task board

### Phase 0: Setup

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P0-001 | Finalize PRD | ChatGPT | Done | Initial version created |
| P0-002 | Confirm target source order | Yani | Todo | Default: Paalam first |
| P0-003 | Create repo folder structure | Script Agent | Todo | Use `/data/raw`, `/intermediate`, `/processed` |
| P0-004 | Create schema files | Script Agent | Todo | JSON schema or Zod preferred |
| P0-005 | Create methodology draft | ChatGPT | Todo | Needed before public launch |

### Phase 1: Scraping

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P1-001 | Inspect Paalam page structure | Script Agent | Todo | Identify list and profile links |
| P1-002 | Build safe scraper | Script Agent | Todo | Slow rate, logs, restartable |
| P1-003 | Save raw HTML | Script Agent | Todo | Do not skip this |
| P1-004 | Save raw text | Script Agent | Todo | Cleaner AI input |
| P1-005 | Save outgoing source links | Script Agent | Todo | Useful for evidence |
| P1-006 | Run scraper on 20 records | Script Agent | Todo | Test batch only |
| P1-007 | Review scrape quality | Yani + AI | Todo | Check if text is usable |

### Phase 2: AI extraction

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P2-001 | Create extraction prompt v1 | ChatGPT | Todo | Use strict JSON |
| P2-002 | Run extraction on 20 records | Extractor | Todo | Small test |
| P2-003 | Validate 20 outputs | Validator | Todo | Look for hallucinations |
| P2-004 | Revise prompt/schema | ChatGPT | Todo | Based on failures |
| P2-005 | Run extraction on 100 records | Extractor | Todo | First useful batch |
| P2-006 | Generate extraction report | Script Agent | Todo | Missing fields, confidence counts |

### Phase 3: Location normalization

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P3-001 | Get PSGC/location reference data | Script Agent | Todo | Province/city/barangay |
| P3-002 | Normalize city/province names | Script Agent | Todo | Exact + fuzzy matching |
| P3-003 | Normalize barangay names | Script Agent | Todo | Review ambiguous ones |
| P3-004 | Assign location precision | Script Agent | Todo | Barangay/city/province/unknown |
| P3-005 | Generate coordinates | Script Agent | Todo | Centroids only by default |
| P3-006 | Flag too-precise locations | Validator | Todo | Avoid private addresses |

### Phase 4: Deduplication

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P4-001 | Normalize names | Script Agent | Todo | Lowercase, remove punctuation |
| P4-002 | Generate candidate duplicates | Script Agent | Todo | Name/date/location similarity |
| P4-003 | AI review duplicate candidates | Deduper | Todo | Suggested decisions only |
| P4-004 | Apply safe auto-merges | Script Agent | Todo | Only strict matches |
| P4-005 | Create manual review list | Script Agent | Todo | Uncertain matches |

### Phase 5: Public dataset export

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P5-001 | Generate `victims_public.csv` | Script Agent | Todo | Public-safe fields only |
| P5-002 | Generate `victims_internal_review.csv` | Script Agent | Todo | Needs review |
| P5-003 | Generate `sources_public.csv` | Script Agent | Todo | Source provenance |
| P5-004 | Generate data quality report | Script Agent | Todo | Counts by confidence/location |
| P5-005 | Review public CSV | Yani | Todo | Spot check before app use |

### Phase 6: App integration

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P6-001 | Import public dataset to app | Yani | Todo | Stack not specified here |
| P6-002 | Build map layer | Yani | Todo | Use location precision labels |
| P6-003 | Build timeline layer | Yani | Todo | Exact/approx dates |
| P6-004 | Build victim popup | Yani | Todo | Name, age, date, location, source |
| P6-005 | Build methodology page | Yani + ChatGPT | Todo | Very important |

## Daily working format

Use this at the top of each AI conversation:

```text
Project: Philippine Drug War Victim Map
Current phase:
Current task ID:
Input files:
Expected output:
Do not invent missing data.
Keep source quotes.
Return strict JSON or markdown only.
```

## Status labels

```text
Todo
Doing
Blocked
Needs Review
Done
Dropped
```

## Issue labels

```text
data_quality
scraper
ai_extraction
location
dedupe
ethics
app_integration
methodology
```
