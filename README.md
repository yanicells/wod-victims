# WOD Victims

> A names-first memorial map and timeline for documented victims of the Philippine drug war.

WOD Victims is a public-interest data project focused on the people behind the numbers. It aims to make documented killings easier to explore by name, date, and location while keeping sources, uncertainty, and human dignity visible.

The project begins with public records from [Paalam](https://paalam.org), a memorial for victims of the Philippine drug war.

## Project status

WOD Victims is in early development.

The data discovery and parsing pipeline is working. The public map, timeline, methodology page, and reviewed dataset export are planned but not yet available.

## Why this project exists

Large totals can hide the individual lives they represent. WOD Victims is intended to bring names and documented stories back into view without presenting incomplete data as definitive.

The finished experience will combine three ideas:

- a memorial archive centered on named victims;
- a data-journalism map and timeline; and
- a transparent, traceable research dataset.

It is not meant to be a crime dashboard, an official count, or a complete record of every killing.

## How it works

```text
Public sources
      ↓
Discover victim profiles
      ↓
Parse explicitly labeled facts
      ↓
Flag incomplete or uncertain records for review
      ↓
Normalize and prepare a public-safe dataset
      ↓
Map, timeline, and methodology
```

The current pipeline uses deterministic parsing rather than AI extraction. A field is recorded only when it appears in a labeled source field; missing details remain missing instead of being inferred.

## Responsible data principles

- **Names first, without false precision.** Locations should reflect only the level of detail supported by a source.
- **Traceable claims.** Public records should link back to their source.
- **Visible uncertainty.** Missing or questionable details are flagged for review rather than hidden or invented.
- **Privacy by design.** The project does not collect photos, exact home addresses, or unnecessary narrative text.
- **Honest scope.** The dataset will be presented as documented public-source data, not as a complete or official count.

Read the full [product requirements](guide/01_PRD.md) and [data schema](guide/03_DATA_SCHEMA.md) for the project's research and publishing rules.

## Tech stack

- [Next.js](https://nextjs.org) and React for the web experience
- TypeScript for the application and data pipeline
- Cheerio for deterministic HTML parsing
- JSONL for source-level structured records
- pnpm workspaces for the monorepo

## Getting started

### Requirements

- Node.js 20 or later
- pnpm 10.26.2

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the current web scaffold.

### Useful commands

```bash
pnpm test                          # Run data-pipeline tests
pnpm check                         # Type-check all packages
pnpm build                         # Build the web application
pnpm discover:paalam               # Discover Paalam victim profiles
pnpm ingest:paalam -- --limit=20   # Parse a limited batch of profiles
pnpm summary:paalam                # Show dataset and queue statistics
```

See the [data-pipeline guide](data-pipeline/README.md) for pipeline details and debugging options.

## Repository structure

```text
apps/web/        Next.js web application
data-pipeline/   Discovery, parsing, review, and summary tools
data/paalam/     Paalam pipeline state and structured records
guide/           Product, workflow, pipeline, and schema documentation
docs/            Public methodology and implementation notes
```

## Roadmap

- [x] Discover victim profiles from Paalam
- [x] Parse labeled profile fields into structured records
- [x] Track completed, failed, and review-needed records
- [ ] Normalize locations and identify duplicates
- [ ] Produce a reviewed, public-safe dataset
- [ ] Build the interactive map and timeline
- [ ] Publish the methodology and known limitations

## Data source and attribution

The first dataset is derived from public victim profiles on [Paalam](https://paalam.org). Source links are preserved for traceability and attribution. WOD Victims is an independent project and is not affiliated with Paalam.

All records should be treated with care and checked against their linked sources before reuse.
