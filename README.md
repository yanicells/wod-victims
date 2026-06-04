# Drug War Victim Mapping Project

This folder contains a planning pack for a journalism-focused web project that maps and presents named victims of the Philippine drug war using public sources.

## Main project direction

Build a names-first, journalism-style map and timeline.

The data work is the hard part, so the project should prioritize:

1. Scraping public victim/name sources
2. Preserving raw data
3. AI-assisted extraction
4. Confidence scoring
5. Location normalization
6. Deduplication
7. Transparent uncertainty
8. Long-term source tracking and repeatable updates

## Files

- `guide/00_WORKFLOW_GUIDE.md`
  Start-here guide for project workflow, first prompts, setup checklist, and what to double-check before scaling.

- `guide/01_PRD.md`
  Product requirements document and project scope.

- `guide/02_DATA_PIPELINE_PLAN.md`
  Main plan for scraping, extraction, cleaning, deduplication, review, and long-term scrape tracking.

- `guide/03_DATA_SCHEMA.md`
  Proposed tables, fields, enums, and validation rules.

- `guide/04_AI_TASK_TRACKER.md`
  Task list and tracker format for working across ChatGPT, Claude, scripts, and future agents.

- `guide/05_AI_HANDOFF_PROMPTS.md`
  Reusable prompts for extraction, validation, deduplication, and QA.

- `guide/08_AI_WORKFLOW.md`
  Operational handoff for an AI driving the whole loop in one conversation. Kept as the fallback flow.

- `guide/09_PAALAM_EXTRACTION_SCHEMA.md`
  Strict JSONL schema for AI extraction from Paalam raw text snapshots.

- `guide/10_EXTRACTION_HANDOFF.md`
  Default token-efficient flow: human runs all scripts, AI only does the extraction step.

## Blunt project rule

Do not treat AI-cleaned data as truth. AI should extract, structure, flag, and explain. Public-facing rows should keep source links, confidence labels, and location precision.

## Long-term data operations

This project should work like a small data system, not a one-time scrape.

Keep durable trackers for:

- sources approved for scraping or later research
- URLs already discovered
- URLs already scraped
- URLs that changed since the last scrape
- URLs that failed and need retry
- pages needing extraction, validation, dedupe, or review

Raw page captures should be append-only. If a page is scraped again later, save a new snapshot and use content hashes to decide whether extraction needs to run again. This keeps future updates cheap and lets another person or AI agent pick up the work without guessing what already happened.

## Repo layout

```text
guide/             Planning docs, workflow guide, schema notes, handoff prompts
data-pipeline/     TypeScript scripts for scraping, validation, reporting, and exports
data/              Operational trackers, raw snapshots, intermediate files, processed exports
apps/              Future web app workspace
docs/              Future public methodology and implementation notes
```

Use `pnpm` from the repo root for data-pipeline commands. The web app can be added later under `apps/web` as a separate package.

## Current Continuation Commands

```text
pnpm check
pnpm validate:workspace
pnpm ops:summary
pnpm review:paalam:scrape-quality
pnpm prepare:paalam:extraction -- --limit=20
pnpm validate:paalam:extraction
```

For future AI sessions, the main instruction is:

```text
Read guide/10_EXTRACTION_HANDOFF.md. I have scraped and prepared a batch — extract batch <batch_id>.
```
