# AI Task Tracker

Use this file as the shared tracker across ChatGPT, Claude, scripts, and future agents.

Before starting tasks, read `00_WORKFLOW_GUIDE.md` for the recommended order of operations, setup prompts, and checkpoints.

## Project status

```text
Current phase: Paalam extraction prep
Current source: Paalam.org
Current goal: Continue the Paalam data pipeline in small scrape/extract/validate batches
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
- source registry updates
- scrape target status updates
- retry and recheck queues

### Operations Agent

Responsibilities:

- keep the source backlog current
- decide which source families are active, paused, blocked, or retired
- review failed scrape targets
- check whether changed pages need extraction reruns
- produce scrape status and data quality reports

## Task board

### Phase 0: Setup

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P0-001 | Finalize PRD | ChatGPT | Done | Initial version created |
| P0-002 | Confirm target source order | Yani | Done | Paalam active first; linked news, Dahas, Drug Archive, and ACLED stay in backlog |
| P0-003 | Create repo folder structure | Script Agent | Done | Created `/data/ops`, `/data/raw`, `/data/intermediate`, `/data/processed`, `/data/qa`, `/data-pipeline`, `/apps`, `/docs` |
| P0-004 | Create schema files | Script Agent | Done | Added pnpm TypeScript/Zod data-pipeline package with workspace validation |
| P0-005 | Create methodology draft | ChatGPT | Todo | Needed before public launch |
| P0-006 | Create source registry | Script Agent | Done | Seeded Paalam active plus backlog source families |
| P0-007 | Create scrape target tracker | Script Agent | Done | Header-only starter created; no targets yet |
| P0-008 | Create scrape run log format | Script Agent | Done | Empty JSONL starter created |
| P0-009 | Create source backlog | Operations Agent | Done | Starter backlog table created |

### Phase 1: Scraping

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P1-001 | Inspect Paalam page structure | Script Agent | Done | See `guide/06_PAALAM_SITE_INSPECTION.md`; no broad scrape run |
| P1-002 | Seed Paalam targets | Script Agent | Done | Discovery run `paalam_discover_20260602172527` added 3,349 queued profile targets |
| P1-003 | Build safe scraper | Script Agent | Done | Added commented Paalam scraper with dry-run, sample mode, batch mode, slow rate, logs, and tracker updates |
| P1-004 | Save raw HTML snapshots | Script Agent | Done | Sample run saved append-only HTML snapshots |
| P1-005 | Save raw text snapshots | Script Agent | Done | Sample run saved readable text snapshots |
| P1-006 | Save outgoing source links | Script Agent | Done | Sample manifests include outgoing source links; one malformed source link found |
| P1-007 | Compute content hashes | Script Agent | Done | Sample run stores raw HTML SHA-256 hashes |
| P1-008 | Update target status after each run | Script Agent | Done | 20 targets changed from queued to scraped |
| P1-009 | Track failed URLs and retries | Script Agent | Done | Failure path exists; sample run had 0 failures |
| P1-010 | Run scraper on 20 records | Script Agent | Done | Run `paalam_sample_20260602173855` fetched 20 profile pages |
| P1-011 | Review scrape quality | Yani + AI | Done | Quality report says 19 ready for AI extraction and 1 needs review |
| P1-012 | Generate first scrape status report | Operations Agent | Done | See `data/raw/paalam/manifests/paalam_sample_20260602173855.json` |
| P1-013 | Generate scrape quality report | Operations Agent | Done | See `data/qa/paalam_scrape_quality_report.json` |
| P1-014 | Add real batch continuation command | Script Agent | Done | `pnpm scrape:paalam:batch -- --limit=20 --delay-ms=2500` continues queued Paalam profile targets |

### Phase 1.5: Incremental operations

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P1O-001 | Define recheck cadence | Operations Agent | Todo | Per source, e.g. Paalam monthly or quarterly |
| P1O-002 | Build recheck queue | Script Agent | Todo | Queue due targets without re-scraping everything |
| P1O-003 | Build changed-page detector | Script Agent | Todo | Compare latest content hash to previous successful snapshot |
| P1O-004 | Queue extraction reruns for changed pages | Script Agent | Todo | New/changed pages only unless schema/prompt changed |
| P1O-005 | Build retry-failed workflow | Script Agent | Todo | Retry failed pages without touching successful pages |
| P1O-006 | Produce monthly operations report | Operations Agent | Todo | Sources, targets, failures, changes, extraction backlog |

### Phase 2: AI extraction

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P2-001 | Create extraction schema v1 | ChatGPT | Done | See `guide/09_PAALAM_EXTRACTION_SCHEMA.md` |
| P2-002 | Create reusable AI continue workflow | ChatGPT | Done | See `guide/08_AI_WORKFLOW.md` |
| P2-003 | Build extraction batch prep script | Script Agent | Done | `pnpm prepare:paalam:extraction -- --limit=20` creates batch JSONL/prompt and queues target extraction status |
| P2-004 | Build extraction validation script | Script Agent | Done | `pnpm validate:paalam:extraction` checks JSONL, evidence support, duplicates, raw text paths, and updates target status after success |
| P2-005 | Run extraction on scrape-quality-ready Paalam records | Extractor | Done | Extracted 19 records from `paalam_extraction_batch_20260602181037` |
| P2-006 | Validate first AI extraction output | Validator | Done | 19 valid records, 7 needing review, 0 invalid records |
| P2-007 | Revise prompt/schema | ChatGPT | Todo | Based on extraction failures or unsupported fields |
| P2-008 | Continue next Paalam scrape/extract batch | Script Agent + Extractor | Done | Extracted and validated batches through `paalam_extraction_batch_20260603083113`; 45 total records, 18 needing review; 13 URLs failed with network errors and are queued for retry |
| P2-009 | Generate extraction report | Script Agent | Done | See `data/qa/paalam_extraction_validation_report.json` |

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
| P5-006 | Generate scrape status report | Operations Agent | Todo | Counts by source/target status and last scrape |
| P5-007 | Generate extraction backlog report | Operations Agent | Todo | New, changed, failed, and skipped pages |

### Phase 6: App integration

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| P6-001 | Import public dataset to app | Yani | Todo | Stack not specified here |
| P6-002 | Build map layer | Yani | Todo | Use location precision labels |
| P6-003 | Build timeline layer | Yani | Todo | Exact/approx dates |
| P6-004 | Build victim popup | Yani | Todo | Name, age, date, location, source |
| P6-005 | Build methodology page | Yani + ChatGPT | Todo | Very important |

## Source backlog

Use this backlog to avoid losing future-source ideas before they are ready.

| Source key | Source | Priority | Status | Use | Notes |
|---|---|---|---|---|---|
| paalam | Paalam.org | High | Active candidate | Primary names-first source | Start here |
| paalam_linked_news | News articles linked from Paalam | High | Backlog | Source support and enrichment | Only links discovered from Paalam pages |
| dahas | Dahas Project | Medium | Backlog | Methodology/context/comparison | Do not merge until Paalam pipeline works |
| drug_archive | Ateneo/Drug Archive | Medium | Backlog | Possible victim/event data | Data access may require research/contact |
| acled | ACLED | Low | Backlog | Event-level comparison | Not names-first; use carefully |

## Ongoing operations checklist

Run this periodically after the first pipeline exists:

1. Check `source_registry.csv` for active sources due for recheck.
2. Run discovery for active sources.
3. Add new URLs to `scrape_targets.csv`.
4. Recheck due targets.
5. Retry failed targets.
6. Compare content hashes.
7. Queue extraction only for new or changed snapshots.
8. Generate scrape and extraction backlog reports.
9. Export public data only after validation/review rules pass.

## Daily working format

Use this at the top of each AI conversation:

```text
Project: Philippine Drug War Victim Map
Current phase:
Current task ID:
Input files:
Expected output:
Source key:
Run ID:
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
operations
source_backlog
recheck
```
