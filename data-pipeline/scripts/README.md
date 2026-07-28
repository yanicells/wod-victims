# Scripts

## Active pipeline

- `discover-paalam.ts` — fetches `sitemap.xml` and the WordPress REST `victim` list, merges/canonicalizes profile URLs, writes new ones into `data/paalam/state.json`. Does not fetch profile pages.
- `ingest-paalam.ts` — takes queued URLs from `state.json`, fetches each profile page into memory, parses it with `lib/parse-paalam-profile.ts`, builds a record with `lib/paalam-record.ts`, and appends it to `data/paalam/victims.jsonl`. It writes HTML only with explicit `--keep-cache` debugging. Tracks failures and stops after too many consecutive failures (throttle protection).
- `summary-paalam.ts` — reads `state.json` + `victims.jsonl` and prints counts: total, with name/date/location/sources/age, needs-review breakdown by reason.

Commands (from repo root):

```text
pnpm discover:paalam
pnpm ingest:paalam -- --limit=20
pnpm summary:paalam
pnpm test
pnpm check
```

## Library (`lib/`)

- `http.ts` — fetch with timeout, DNS fallback, and bounded backoff for network errors and transient HTTP statuses. Details:
  - every request carries an `AbortController` timeout, so a stalled connection can't hang a batch;
  - retries cover thrown errors (network drops, aborted timeouts) and the transient statuses `408`, `425`, `429`, `500`, `502`, `503`, `504`. Any other non-2xx is returned to the caller immediately and recorded as a failure — retrying a `404` only wastes Paalam's bandwidth;
  - backoff grows per attempt (`backoffMs * attempt`, base 2s), so a throttled server gets progressively more room;
  - if `getaddrinfo` fails with `ENOTFOUND` but `dns.resolve4` succeeds, it retries as a direct HTTPS request with the hostname passed as TLS SNI and a `Host` header. This is a workaround for sandboxed/agent DNS setups, not something the pipeline needs on a normal machine.
- `canonicalize.ts` — accept only Paalam victim-profile URLs and normalize HTTP/`www`/query/hash/trailing-slash variants into one HTTPS ID space. It throws on a non-HTTP(S) protocol, a host other than `paalam.org`/`www.paalam.org`, embedded credentials, or any path outside `/homepage/victims/<slug>` — so a stray URL fails discovery loudly instead of entering the dataset as a bogus target.
- `parse-paalam-profile.ts` — the parser. Reads labeled `ul.plm-details` fields and the `plm-details.source` link list. Narrative text is ephemeral and may produce a warning, but is never saved or used to invent a fact.
- `paalam-record.ts` — shapes a parse result plus fetch metadata into the committed `PaalamVictimRecord`.
- `state.ts` — reads/writes `data/paalam/state.json`, resolves paths, loads existing victim IDs for resume.
- `ids.ts` — deterministic IDs from the canonical URL.
- `hash.ts` — SHA-256 of raw HTML for `contentHash`.
- `jsonl.ts` — read/append JSONL files.
- `paths.ts` — resolve paths from the repo root.

## Tests

```text
data-pipeline/scripts/__tests__/*.test.ts
data-pipeline/scripts/__tests__/fixtures/*.html
```

Tests cover parser fixtures and edge cases, URL identity, ingest queue idempotency, CLI safety limits, and transient HTTP retry behavior. Run with `pnpm test`.
