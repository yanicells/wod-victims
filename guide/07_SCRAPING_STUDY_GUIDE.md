# Study Guide: How This Project Works

A learning guide for the Paalam **parser-first** pipeline.

**How to use this:** read for concepts first. When a file is tagged like `` `path/to/file.ts` ``, open it only when you want to see the real code. Aim ~70% understanding *what* and *why*, ~30% *how the TypeScript looks*.

---

## 1. What this project is trying to do

We want a **names-first memorial map + timeline** of people documented as victims of the Philippine drug war.

For v1, almost all data comes from **[Paalam.org](https://paalam.org)** — a public memorial site with one page per victim.

The hard part is not the website UI. The hard part is turning thousands of memorial pages into **clean, honest records** without inventing facts.

**Product vision (optional deeper read):** `` `guide/01_PRD.md` ``

---

## 2. The big idea: parser-first (not AI-first)

### Old approach (removed)

1. Download full HTML and keep it forever  
2. Ask an AI to “read” messy page text  
3. Hope the AI extracts name/date/location correctly  

That was slow, expensive, and overkill — Paalam pages already have **labeled fields**.

### Current approach

1. Find victim profile URLs  
2. Fetch each page  
3. **Parse the labeled fields with code**  
4. Save one clean JSON line per victim  
5. Discard the in-memory HTML

No AI for core fields. The durable output is JSON, not HTML.

**Mental model:**

```text
URL list  →  fetch HTML  →  parse labels  →  victims.jsonl  →  (later) map/timeline
```

HTML normally stays in memory. A developer can explicitly write a gitignored cache with `--keep-cache` while debugging.

---

## 3. What a Paalam page looks like (concept)

Each profile page has structured blocks in the HTML, roughly:

| On the page | Example | Becomes |
|-------------|---------|---------|
| Title / name | Johndy Maglinte | `name` |
| Sex / Age | Male, 16 | `gender`, `age` |
| Incident type | Killed in police operation | `incidentType` |
| Date of Incident | June 17, 2021 | `dateKilled` + `datePrecision` |
| Location of Incident | Binan, Laguna | city / province fields |
| Source(s) | news article links | `sourceUrls` |
| Story paragraphs | narrative text | optional warning only; prose is **not saved** and never fills a fact |

In the HTML, those labels live in lists with class names like `plm-details`.

**Site inspection notes:** `` `guide/06_PAALAM_SITE_INSPECTION.md` ``

**Important rule:** if age is only mentioned in the story (“the 46-year-old mayor…”) but missing from the Age field, we leave `age: null` and maybe add a warning. We do **not** invent it.

---

## 4. End-to-end pipeline (concepts)

### Step A — Discover

Find every victim profile URL.

Sources:

- Paalam `sitemap.xml` (lots of `/homepage/victims/...` links)  
- WordPress REST API list (`/wp-json/wp/v2/victim`) — good for discovery metadata, **not** for the labeled Sex/Age/Date fields  

Result: a list of URLs in `` `data/paalam/state.json` `` under `discoveredUrls`.

**Code:** `` `data-pipeline/scripts/discover-paalam.ts` ``

### Step B — Ingest

For each not-yet-done URL:

1. Fetch HTML (slowly — Paalam throttles)  
2. Parse labeled fields  
3. Append one JSON object to `` `data/paalam/victims.jsonl` ``  
4. Mark the ID completed in state  
5. Discard the in-memory HTML

**Code:** `` `data-pipeline/scripts/ingest-paalam.ts` ``

### Step C — Summary

Print counts: how many victims, how many have dates/locations/sources, review flags, duplicate check.

**Code:** `` `data-pipeline/scripts/summary-paalam.ts` ``

### Commands you’ll actually run

```text
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20 --delay-ms=3000
pnpm summary:paalam
pnpm test
```

Practical day-to-day workflow: `` `guide/00_WORKFLOW_GUIDE.md` ``

---

## 5. Key concepts (learn these)

### 5.1 Canonical URL

The same page can be written many ways:

- with/without trailing `/`  
- with `?utm=...` or `#section`  
- with HTTP/HTTPS or `www`/apex host variants

We accept only Paalam victim-profile URLs and **normalize** valid variants so they always hash to the same ID.

**Code:** `` `data-pipeline/scripts/lib/canonicalize.ts` ``

Concept: *one person page → one stable identity*, even if the URL string varies.

### 5.2 Target ID

A deterministic ID from the canonical URL (hash), e.g. `paalam_profile_a9bd327daf7a`.

**Code:** `` `data-pipeline/scripts/lib/ids.ts` ``

Concept: reruns must not create duplicate people just because you ran the script twice.

### 5.3 Idempotent ingest

“Idempotent” here means: **running again is safe**.

- Already-ingested IDs are skipped  
- Even `--url=...` skips if that profile is already done  
- Summary warns if `victims.jsonl` somehow has duplicate IDs  

Concept: retries and crashes should not poison the dataset.

### 5.4 State vs dataset

| File | Role |
|------|------|
| `` `data/paalam/state.json` `` | Progress: discovered URLs, completed IDs, failures |
| `` `data/paalam/victims.jsonl` `` | The actual victim records (one JSON object per line) |

Concept: *ops tracking* and *data product* are separate.

**Code:** `` `data-pipeline/scripts/lib/state.ts` ``

### 5.5 JSONL

JSONL = **JSON Lines**: each line is one complete JSON object.

Why: easy to append, easy to stream, easy to count with `wc -l`.

**Code:** `` `data-pipeline/scripts/lib/jsonl.ts` ``

### 5.6 Content hash

SHA-256 of the fetched HTML, stored on the record.

Concept: later you can detect “did this page change?” without keeping the HTML forever.

**Code:** `` `data-pipeline/scripts/lib/hash.ts` ``

### 5.7 Optional cache, not an archive

By default, HTML stays in memory and is discarded. With explicit `--keep-cache`, it is written under `` `data/cache/paalam/` `` for local debugging; that folder is gitignored.

Concept: the repo stays small; the **parsed record** is the source of truth we keep.

### 5.8 Review flags (honesty over completeness)

If something is weak or sensitive, we still save the row, but set:

- `needsReview: true`  
- `reviewReasons: [...]`  

Examples:

- anonymous, unidentified, unnamed, or unknown name
- missing source link  
- public figure / mayor  
- slash name like `Person A / Person B` (two people in one title)  

Concept: **flag uncertainty; don’t invent certainty.**

### 5.9 Throttling / politeness

Paalam will drop connections if you hammer it.

So ingest:

- goes one URL at a time  
- waits `--delay-ms` between requests  
- retries transient network errors and HTTP throttling/server errors with backoff
- stops after several consecutive failures  

Concept: scrapers are guests. Slow is correct.

### 5.10 DNS fallback (environment quirk)

In some environments, Node’s normal DNS lookup fails for `paalam.org`, but `dns.resolve4` still works.

Our HTTP helper tries normal `fetch`, then falls back to “resolve IP → HTTPS with SNI”.

**Code:** `` `data-pipeline/scripts/lib/http.ts` ``

Concept: networking failures aren’t always “the site is down.”

---

## 6. What the parser actually does (concepts → light code)

**Main file:** `` `data-pipeline/scripts/lib/parse-paalam-profile.ts` ``

### Concept flow

```text
HTML string
  → load with Cheerio (jQuery-like DOM in Node)
  → read h1 name
  → read ul.plm-details label:value pairs
  → read source links
  → optionally inspect short narrative for warnings, then discard it
  → normalize date + location
  → attach warnings / reviewReasons
```

### Cheerio in one sentence

Cheerio lets you write `$("h1").text()` against an HTML string without a browser.

You don’t need to memorize Cheerio. Just know: **selectors find nodes; we only trust labeled detail lists for facts.**

### Date parsing (concept)

Input like `June 17, 2021` → `2021-06-17` with precision `exact_date`.

Also supports month-only / year-only when that’s all the page gives.

Function: `parseIncidentDate`

### Location parsing (concept)

Input like `Binan, Laguna` → city + province.

Also cleans messy Paalam text:

| Raw on site | Cleaned |
|-------------|---------|
| `, Quezon City` | `Quezon City` |
| `Pikit town, Cotabato` | `Pikit, Cotabato` |
| `..., Cotabato (North Cotabato)` | province → `North Cotabato` |
| `Manila, Metro Manila` | city Manila, region NCR |

Function: `parseLocation`

### Turning parse output into a saved record

**Code:** `` `data-pipeline/scripts/lib/paalam-record.ts` ``

Adds fetch metadata (`id`, `profileUrl`, `scrapedAt`, `contentHash`) onto the parsed fields → one `PaalamVictimRecord`.

**Field reference:** `` `guide/03_DATA_SCHEMA.md` ``

---

## 7. Walk one ingest run (story mode)

Imagine you run:

```text
pnpm ingest:paalam -- --limit=3 --delay-ms=2500
```

1. Load state + existing victim IDs  
2. Pick 3 URLs not in `completedIds`  
3. For URL #1: fetch in memory → parse → append line to `victims.jsonl` → mark completed
4. Wait 2.5 seconds  
5. Repeat for URL #2 and #3  
6. Print JSON summary (success/failed/skipped)  

If URL #2 fails twice in a row and then more failures hit the circuit breaker, the run stops early. Remaining URLs stay pending for next time. That’s intentional.

**Orchestrator code:** `` `data-pipeline/scripts/ingest-paalam.ts` ``

---

## 8. Tests as a study tool

Don’t treat tests as “CI noise.” They’re **worked examples**.

**Folder:** `` `data-pipeline/scripts/__tests__/` ``

| Test file | What you learn |
|-----------|----------------|
| `` `.../parse-paalam-profile.test.ts` `` | How dates/locations/names should parse; edge cases |
| `` `.../fixtures/*.html` `` | Tiny real-ish HTML pages (full profile, no age, anonymous, mayor, etc.) |
| `` `.../canonicalize.test.ts` `` | URL normalization |
| `` `.../ingest-pending.test.ts` `` | Why `--url` must not duplicate rows |
| `` `.../http.test.ts` `` | Which HTTP failures retry and which return immediately |

Run:

```text
pnpm test
```

Study tip: open a fixture HTML and the matching test assertion side by side. That’s the fastest way to learn the parser.

---

## 9. Suggested study path (in order)

1. This file (concepts)  
2. `` `README.md` `` — repo map + commands  
3. `` `guide/00_WORKFLOW_GUIDE.md` `` — what to run day to day  
4. `` `guide/01_PRD.md` `` — why the product exists / ethics  
5. `` `data-pipeline/scripts/discover-paalam.ts` `` — skim: sitemap + REST → URL list  
6. `` `data-pipeline/scripts/ingest-paalam.ts` `` — skim: queue → fetch → parse → append
7. `` `data-pipeline/scripts/lib/parse-paalam-profile.ts` `` — the heart; read slowly  
8. `` `data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts` `` + fixtures  
9. `` `guide/02_DATA_PIPELINE_PLAN.md` `` — longer-term plan (normalize/dedupe/export later)  
10. `` `guide/03_DATA_SCHEMA.md` `` — record shape  

Optional networking deep dive: `` `data-pipeline/scripts/lib/http.ts` ``

---

## 10. Light TypeScript notes (the 30%)

You don’t need to be a TS expert to follow this repo. A few patterns show up everywhere:

### `import ... from "./lib/foo.js"`

Even though the source file is `foo.ts`, NodeNext ESM imports use the `.js` extension in the import path. That’s a TypeScript/Node convention, not a mistake.

### `type` / object shapes

We describe records with TypeScript types (e.g. `PaalamVictimRecord`) so the compiler catches typos like `dateKilld`.

### `pnpm exec tsx script.ts`

`tsx` runs TypeScript directly without a separate compile step for scripts.

### `pnpm --filter @wod-victims/data-pipeline ...`

This is a **pnpm monorepo**. Root commands forward into packages:

- `` `data-pipeline/` `` — scraping/parsing  
- `` `apps/web/` `` — Next.js app scaffold (map later)  

Root package scripts live in `` `package.json` ``.

### Cheerio selectors

```ts
$("h1.post-title").first().text()
$("ul.plm-details.source a[href]")
```

Read as: “find these HTML nodes, read text/attributes.” Same idea as CSS selectors.

### JSONL append

```ts
appendJsonlRow(path, record) // writes one line: JSON.stringify(record) + "\n"
```

That’s the whole persistence model for victims right now.

---

## 11. Ethics to keep in your head while studying

- No photos in v1  
- No exact private addresses
- No inventing missing fields  
- Every public claim needs a source link when possible  
- Uncertainty should be visible (`needsReview`)  
- Be gentle with Paalam’s servers  

These aren’t “extra rules.” They’re part of the data design.

---

## 12. What is *not* built yet

Still future work:

- deeper location normalization (PSGC codes, centroids)  
- dedupe across records/sources  
- public-safe export for the app  
- map + timeline UI beyond the Next.js scaffold  
- linked news / other datasets  

That’s fine. The learning core of this repo today is:

**discover → fetch → parse labeled fields → honest JSONL.**
