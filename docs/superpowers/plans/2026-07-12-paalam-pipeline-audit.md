# Paalam Pipeline Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct material parser, identity, retry, privacy, and test-coverage gaps in the existing Paalam pipeline while preserving its parser-first architecture and returning all tracked data to the empty starter state.

**Architecture:** Keep the current discover -> sequential ingest -> labeled-field parser -> JSONL -> summary flow. Tighten validation at the existing boundaries, keep unstructured narrative ephemeral, retry only transient failures, and test production helpers directly instead of mirrored copies.

**Tech Stack:** TypeScript 7, Node.js 25, Cheerio, Node test runner, pnpm 10.

## Global Constraints

- No invented facts from narrative text.
- No photos.
- No exact private addresses.
- Be polite to Paalam with sequential requests, delays, retries with backoff, and a repeated-failure cutoff.
- Keep clean JSONL as the durable artifact; do not restore raw HTML or text archives.
- Do not add UI, geocoding, broad deduplication, another source, or AI extraction.
- Finish with an empty `data/paalam/victims.jsonl`, epoch starter `data/paalam/state.json`, and no cached HTML.
- Make small local commits and do not push.

---

### Task 1: Parser correctness for dates, anonymous names, and source links

**Files:**
- Modify: `data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts`
- Modify: `data-pipeline/scripts/lib/parse-paalam-profile.ts`

**Interfaces:**
- Consumes: Paalam profile HTML and labeled `ul.plm-details` fields.
- Produces: `parseIncidentDate(raw)` and `parsePaalamProfile(html)` with accurate dates, anonymous review flags, and normalized external source URLs.

- [ ] **Step 1: Write failing parser regression tests**

Add assertions that:

```ts
assert.deepEqual(parseIncidentDate("February 31, 2021"), {
  iso: null,
  precision: "unknown"
});

const unidentified = parsePaalamProfile(
  readFixture("anonymous.html").replaceAll("Anonymous", "Unidentified Male")
);
assert.ok(unidentified.reviewReasons.includes("anonymous_or_unnamed"));

const sourceHtml = `
  <h1 class="post-title">Source Test</h1>
  <ul class="plm-details">
    <li>Sex: Male</li>
    <li>Killed in police operation</li>
    <li>Date of Incident: June 1, 2020</li>
    <li>Location of Incident: Manila</li>
  </ul>
  <ul class="plm-details source">
    <li><a href="/homepage/victims/source-test/">Paalam</a></li>
    <li><a href="//news.example/story">News</a></li>
  </ul>`;
const parsedSources = parsePaalamProfile(sourceHtml);
assert.deepEqual(parsedSources.sourceUrls, ["https://news.example/story"]);
assert.ok(!parsedSources.reviewReasons.includes("malformed_source_link"));
```

- [ ] **Step 2: Run focused tests and confirm the regressions fail**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/parse-paalam-profile.test.ts
```

Expected: failures for the invalid date, unidentified name, and source-link behavior.

- [ ] **Step 3: Implement calendar validation and source classification**

After parsing the numeric date, construct a UTC date and require its year, month, and day to equal the input. Replace the boolean source validator with a normalizer that resolves hrefs against `https://paalam.org`, returns `null` without warning for Paalam-owned links, accepts only HTTP(S) external links, and records genuinely malformed or unsupported hrefs.

Expand the anonymous-name pattern to:

```ts
return /^(?:anonymous|unidentified|unnamed|unknown)\b/i.test(name);
```

- [ ] **Step 4: Run the focused parser tests**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/parse-paalam-profile.test.ts
```

Expected: all parser tests pass.

- [ ] **Step 5: Commit the parser fixes**

```text
git add data-pipeline/scripts/lib/parse-paalam-profile.ts data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts
git commit -m "fix: validate Paalam parser edge cases"
```

### Task 2: Canonical Paalam identity and production queue tests

**Files:**
- Modify: `data-pipeline/scripts/lib/canonicalize.ts`
- Modify: `data-pipeline/scripts/__tests__/canonicalize.test.ts`
- Modify: `data-pipeline/scripts/ingest-paalam.ts`
- Modify: `data-pipeline/scripts/__tests__/ingest-pending.test.ts`

**Interfaces:**
- Consumes: absolute profile URL strings and ingest CLI arguments.
- Produces: one canonical `https://paalam.org/homepage/victims/<slug>/` identity; exported `pendingUrls()` and `parseArgs()` tested from their production module.

- [ ] **Step 1: Add failing canonicalization tests**

Add tests requiring HTTP and `www` variants to collapse to the HTTPS apex URL, and rejecting foreign hosts, non-HTTP protocols, and non-victim paths:

```ts
assert.equal(
  canonicalizePaalamUrl("http://www.paalam.org/homepage/victims/test"),
  "https://paalam.org/homepage/victims/test/"
);
assert.throws(() => canonicalizePaalamUrl("https://example.com/test"));
assert.throws(() => canonicalizePaalamUrl("ftp://paalam.org/homepage/victims/test"));
assert.throws(() => canonicalizePaalamUrl("https://paalam.org/about/"));
```

- [ ] **Step 2: Run canonicalization tests and confirm failure**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/canonicalize.test.ts
```

Expected: the new assertions fail against the permissive current implementation.

- [ ] **Step 3: Enforce the Paalam profile identity boundary**

Validate `http:` or `https:`, allow only `paalam.org` and `www.paalam.org`, require a pathname below `/homepage/victims/`, then set protocol to HTTPS, hostname to `paalam.org`, clear credentials/query/hash, and add one trailing slash.

- [ ] **Step 4: Replace the mirrored queue test with imports of production code**

Export `Args`, `parseArgs(args = process.argv.slice(2))`, and `pendingUrls` from `ingest-paalam.ts`. Guard `main()` with a direct-execution check using `pathToFileURL(process.argv[1])` so tests can import the module without starting ingestion.

Update `ingest-pending.test.ts` to import `pendingUrls` and `parseArgs` rather than maintaining `selectPending`. Add:

```ts
assert.throws(
  () => parseArgs(["--max-consecutive-failures=0"]),
  /Invalid --max-consecutive-failures/
);
assert.equal(parseArgs(["--retries=0"]).retries, 0);
```

Keep `--retries=0` valid, but require a positive repeated-failure cutoff so a run cannot disable the politeness stop.

- [ ] **Step 5: Run canonicalization and ingest tests**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/canonicalize.test.ts scripts/__tests__/ingest-pending.test.ts
```

Expected: both suites pass and importing `ingest-paalam.ts` performs no CLI work.

- [ ] **Step 6: Commit identity and queue validation**

```text
git add data-pipeline/scripts/lib/canonicalize.ts data-pipeline/scripts/ingest-paalam.ts data-pipeline/scripts/__tests__/canonicalize.test.ts data-pipeline/scripts/__tests__/ingest-pending.test.ts
git commit -m "fix: enforce canonical Paalam ingest identities"
```

### Task 3: Retry transient HTTP responses politely

**Files:**
- Create: `data-pipeline/scripts/__tests__/http.test.ts`
- Modify: `data-pipeline/scripts/lib/http.ts`

**Interfaces:**
- Consumes: a URL, timeout, extra-attempt count, and backoff duration.
- Produces: `fetchText()` that retries thrown network errors plus HTTP 408, 425, 429, 500, 502, 503, and 504; permanent HTTP errors return immediately.

- [ ] **Step 1: Write local-server retry tests**

Use `node:http` to start an ephemeral loopback server. One route returns 503 then 200; another always returns 404. Assert:

```ts
const recovered = await fetchText(transientUrl, 1_000, 1, 1);
assert.equal(recovered.status, 200);
assert.equal(transientRequests, 2);

const permanent = await fetchText(notFoundUrl, 1_000, 2, 1);
assert.equal(permanent.status, 404);
assert.equal(notFoundRequests, 1);
```

Close the server in `after()` so tests leave no process running.

- [ ] **Step 2: Run the HTTP tests and confirm transient retry failure**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/http.test.ts
```

Expected: the 503 route returns 503 after one request.

- [ ] **Step 3: Refactor one fetch attempt and retry transient statuses**

Keep DNS fallback inside a single-attempt helper. In `fetchText()`, retry only when an attempt throws or the completed response has a transient status and extra attempts remain. Use the existing increasing backoff and return the final response when retries are exhausted.

- [ ] **Step 4: Run HTTP and full pipeline tests**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/http.test.ts
pnpm test
```

Expected: the local retry tests and all existing suites pass.

- [ ] **Step 5: Commit retry handling**

```text
git add data-pipeline/scripts/lib/http.ts data-pipeline/scripts/__tests__/http.test.ts
git commit -m "fix: retry transient Paalam HTTP responses"
```

### Task 4: Minimize durable victim data

**Files:**
- Modify: `data-pipeline/scripts/lib/parse-paalam-profile.ts`
- Modify: `data-pipeline/scripts/lib/paalam-record.ts`
- Modify: `data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts`

**Interfaces:**
- Consumes: page narrative only inside `parsePaalamProfile()` for non-persisted warnings.
- Produces: parser and record objects with structured fields, sources, warnings, and review flags but no durable free-form narrative.

- [ ] **Step 1: Add a failing data-minimization assertion**

Parse a fixture whose story mentions an age and assert the warning remains, while neither parsed output nor `PaalamVictimRecord` exposes a `narrative` field. Use `assert.ok(!("narrative" in parsed))` for the runtime assertion.

- [ ] **Step 2: Run the parser tests and confirm the narrative assertion fails**

Run:

```text
pnpm --filter @wod-victims/data-pipeline test -- scripts/__tests__/parse-paalam-profile.test.ts
```

Expected: parsed output still contains `narrative`.

- [ ] **Step 3: Keep narrative ephemeral**

Remove `narrative` from `ParsedPaalamProfile` and `PaalamVictimRecord`, and omit it from both returned objects. Continue extracting a short narrative inside the parser only to emit the existing “Age mentioned in narrative” warning. Do not add redaction heuristics or persist a transformed excerpt.

- [ ] **Step 4: Run tests and typechecks**

Run:

```text
pnpm test
pnpm check
```

Expected: all tests and workspace typechecks pass.

- [ ] **Step 5: Commit data minimization**

```text
git add data-pipeline/scripts/lib/parse-paalam-profile.ts data-pipeline/scripts/lib/paalam-record.ts data-pipeline/scripts/__tests__/parse-paalam-profile.test.ts
git commit -m "refactor: keep Paalam narrative text ephemeral"
```

### Task 5: Align operator and learning documentation

**Files:**
- Modify: `README.md`
- Modify: `data-pipeline/README.md`
- Modify: `data-pipeline/scripts/README.md`
- Modify: `guide/00_WORKFLOW_GUIDE.md`
- Modify: `guide/02_DATA_PIPELINE_PLAN.md`
- Modify: `guide/03_DATA_SCHEMA.md`
- Modify: `guide/07_SCRAPING_STUDY_GUIDE.md`

**Interfaces:**
- Consumes: final implemented CLI, parser, retry, cache, and record behavior.
- Produces: one consistent description of the live pipeline and human commands.

- [ ] **Step 1: Correct stale commands and architecture**

Remove the nonexistent `pnpm compare:parser` command and `compare-parser-vs-ai.ts` file. State that default ingest keeps HTML in memory and writes it only with explicit `--keep-cache` debugging; no default temporary archive exists.

- [ ] **Step 2: Document the hardened behavior**

Explain that canonical identities accept only Paalam victim profiles and collapse HTTP/`www` variants, transient 429/5xx responses retry with backoff, unidentified/unknown titles are review flagged, internal Paalam links are not evidence, and free-form narrative is not durable data.

- [ ] **Step 3: Update schema examples and review guidance**

Remove `narrative` from the schema and example record. Preserve the rule that narrative may trigger a warning without filling a structured value. Keep the study guide concepts-first.

- [ ] **Step 4: Scan for stale references and validate formatting**

Run:

```text
rg -n "compare:parser|compare-parser-vs-ai|narrative.*stored|narrative.*kept|temporary HTML during" README.md data-pipeline guide
git diff --check
```

Expected: no stale current-workflow claims and no whitespace errors.

- [ ] **Step 5: Commit documentation alignment**

```text
git add README.md data-pipeline/README.md data-pipeline/scripts/README.md guide/00_WORKFLOW_GUIDE.md guide/02_DATA_PIPELINE_PLAN.md guide/03_DATA_SCHEMA.md guide/07_SCRAPING_STUDY_GUIDE.md
git commit -m "docs: align Paalam pipeline guidance"
```

### Task 6: Live regression, full verification, and clean reset

**Files:**
- Restore: `data/paalam/victims.jsonl`
- Restore: `data/paalam/state.json`
- Remove if present: `data/cache/**/*.html`

**Interfaces:**
- Consumes: the implemented pipeline and live Paalam profiles.
- Produces: verified behavior plus the exact empty starter dataset.

- [ ] **Step 1: Reset the audit sample before post-fix validation**

Use `apply_patch` to empty `victims.jsonl` and restore:

```json
{
  "source": "paalam",
  "updatedAt": "1970-01-01T00:00:00.000Z",
  "discoveredUrls": [],
  "completedIds": [],
  "failed": []
}
```

Remove any HTML under `data/cache/`.

- [ ] **Step 2: Run a focused live regression**

Run one explicit unidentified profile and one ordinary profile with a 3,000 ms delay setting. Inspect their complete JSONL records. Expected: the unidentified profile has `anonymous_or_unnamed`; both omit `narrative`; structured facts and source URLs remain correct.

- [ ] **Step 3: Test idempotency on the explicit ordinary profile**

Run the same explicit URL again. Expected: “Nothing to ingest” and no extra JSONL row.

- [ ] **Step 4: Reset all live data again**

Empty `victims.jsonl`, restore the exact epoch starter state, and delete all cached HTML. Do not commit sample records.

- [ ] **Step 5: Run final verification**

Run:

```text
pnpm test
pnpm check
pnpm summary:paalam
test ! -s data/paalam/victims.jsonl
jq -e '.source == "paalam" and .updatedAt == "1970-01-01T00:00:00.000Z" and (.discoveredUrls | length == 0) and (.completedIds | length == 0) and (.failed | length == 0)' data/paalam/state.json
test -z "$(find data/cache -type f -name '*.html' -print 2>/dev/null)"
git diff --check
git status --short --branch
```

Expected: tests/typechecks pass; summary reports zero records and duplicates; all empty-state checks pass; only intended commits exist; no sample-data diff remains.
