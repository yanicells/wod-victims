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

## Files

- `01_PRD.md`  
  Product requirements document and project scope.

- `02_DATA_PIPELINE_PLAN.md`  
  Main plan for scraping, extraction, cleaning, deduplication, and review.

- `03_DATA_SCHEMA.md`  
  Proposed tables, fields, enums, and validation rules.

- `04_AI_TASK_TRACKER.md`  
  Task list and tracker format for working across ChatGPT, Claude, scripts, and future agents.

- `05_AI_HANDOFF_PROMPTS.md`  
  Reusable prompts for extraction, validation, deduplication, and QA.

## Blunt project rule

Do not treat AI-cleaned data as truth. AI should extract, structure, flag, and explain. Public-facing rows should keep source links, confidence labels, and location precision.
