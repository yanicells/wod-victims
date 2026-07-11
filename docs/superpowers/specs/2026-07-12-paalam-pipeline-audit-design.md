# Paalam Parser-First Pipeline Audit Design

## Goal

Audit the existing Paalam discover, ingest, parse, state, and summary flow; fix material correctness or robustness problems; align the documentation; and leave the repository ready for a human-run ingest with no victim data or cached HTML present.

## Scope

The work stays inside the data pipeline and its documentation. It does not build the map UI, add another source, restore AI extraction, retain HTML archives, geocode locations, or attempt broad cross-record deduplication.

The existing parser-first architecture remains the foundation:

```text
sitemap + WordPress REST
  -> canonical profile URLs in state.json
  -> sequential fetch with timeout, retries, delay, and failure cutoff
  -> deterministic parsing of labeled Paalam fields
  -> one durable JSON record per profile in victims.jsonl
  -> summary and review flags
```

## Audit approach

Use a targeted hybrid audit:

1. Read the active scripts, tests, schemas, and operator guides end to end.
2. Run the existing tests and typechecks to establish a clean baseline.
3. Add focused regression tests for important failures found during review.
4. Run a polite live validation of ten profiles using a 3,000 ms inter-request delay.
5. Inspect every resulting record for name, date, location, source, age, gender, incident type, warnings, and review flags.
6. Implement surgical fixes and repeat focused tests or live checks when needed.
7. Update only documentation affected by actual behavior or command changes.
8. Run the full test and typecheck suites.
9. Empty `victims.jsonl`, restore the epoch starter state, and remove cached HTML before the final handoff.

Fixture-only review was rejected because it cannot reveal current Paalam markup or data variation. A broad rewrite was rejected because the current pipeline is already small, deterministic, and passing its baseline suite.

## Correctness and ethics rules

- Structured facts come only from Paalam's labeled detail fields. Narrative text may produce a warning but never populate a missing fact.
- Missing, malformed, anonymous, combined-name, and sensitive-public-figure cases remain visible through review reasons instead of fabricated normalization.
- Source URL handling must retain usable public evidence while rejecting malformed or self-referential links.
- The parser must not create exact private addresses or add photos.
- Stable canonical URLs and deterministic IDs remain the identity boundary. Ingest reruns must not append a completed ID.

## Network and failure behavior

Requests stay sequential and delayed. Transient network failures may be retried with backoff. Repeated failures stop the batch. The DNS fallback remains limited to lookup failures and must preserve the original hostname for HTTP Host and TLS SNI.

Temporary HTML is allowed only during validation or an ingest run. It is not a durable artifact and must be removed automatically unless a developer explicitly asks to keep a temporary cache for debugging.

## Testing and verification

Tests should cover parser edge cases and pure queue/state/network helpers where practical. Live pages are validation evidence, not permanent test fixtures or committed raw HTML.

Required final checks:

```text
pnpm test
pnpm check
pnpm summary:paalam
```

The final data checks must confirm:

- `data/paalam/victims.jsonl` is zero bytes.
- `data/paalam/state.json` contains the clean epoch starter object.
- `data/cache/` contains no HTML files.
- No old raw archive has been restored.

## Commit strategy

Keep commits coherent and reviewable: focused fixes and their tests together, documentation alignment separately, and the final empty-data reset only if tracked files changed during live validation. Do not push.
