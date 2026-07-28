# Pipeline Build Notes

How the Paalam pipeline was actually built, and why it looks the way it does. `guide/02_DATA_PIPELINE_PLAN.md` describes the current design; this file records the decisions and the rewrites behind it, so a later change doesn't quietly undo something that was deliberate.

## How it was built, in order

1. **Site inspection first.** Before writing a scraper, we mapped Paalam's structure (`guide/06_PAALAM_SITE_INSPECTION.md`) and found that profiles expose their facts in a labeled `ul.plm-details` list plus a `ul.plm-details.source` link list, and that a sitemap and a WordPress REST endpoint both enumerate victim pages. Everything after this followed from those two findings.
2. **Discovery split from ingest.** `discover-paalam.ts` only collects URLs — it never opens a profile page. That keeps a cheap, rerunnable step separate from the slow, polite one, and it means the queue can be inspected before any fetching happens.
3. **A first AI-extraction pass — since removed.** The original ingest fetched pages, archived HTML, and used an LLM to pull fields out of prose. It produced ~72 rows, and the problems showed up quickly: fields that couldn't be traced to anything on the page, a repo growing with HTML snapshots, and no way to tell an extracted fact from an inferred one.
4. **The parser-first rewrite.** Replaced with deterministic Cheerio parsing of the labeled fields only. The corpus was deliberately reset to empty rather than migrated — the old rows couldn't be re-derived from a labeled field, so keeping them would have meant publishing claims we couldn't defend. See `guide/00_WORKFLOW_GUIDE.md` §1b.
5. **A hardening audit.** A dedicated pass (`docs/superpowers/`) fixed parser edge cases, tightened URL identity, narrowed retries to transient failures, made narrative text ephemeral, and pointed the tests at the production helpers instead of mirrored copies. Commits `ea3bcc5`…`fe40d68`.

## Decisions worth keeping

**Parse labeled fields; never infer.** A field is filled only from its own labeled entry. If the page doesn't say it, the record says `null`. The parser may read a narrative excerpt to *explain* a gap — emitting a warning like "age mentioned in narrative but missing from profile details" — but it never fills the field from that text and never saves the excerpt. This is the rule the whole project rests on: this dataset is about named victims, and a plausible-but-invented age or location attached to a real person's name is a serious harm, not a data-quality nit.

**Flag, don't drop; flag, don't fix.** Incomplete records still land in `victims.jsonl` with `needsReview: true` and a reason. Dropping them would silently shrink the count; "fixing" them by inference would fabricate. Review reasons are a publishing gate, not an error state.

**Keep only the structured result.** Ingest fetches into memory, parses, and writes the record. Raw HTML reaches disk only under an explicit `--keep-cache` debugging flag, into a gitignored directory. No photos, no exact addresses, no free-form narrative — the privacy boundary is enforced by what the pipeline is *able* to persist, not by remembering to clean up later. `contentHash` (SHA-256 of the fetched HTML) preserves change detection without keeping the page.

**One page, one ID, forever.** Canonicalization plus a deterministic hash means rerunning anything is safe, and `summary:paalam` fails the run if a duplicate ID ever appears. Details in `guide/02_DATA_PIPELINE_PLAN.md` §4.

**Be polite by construction.** Sequential requests, a default 2.5s delay, per-request timeouts, backoff on transient failures only, and a cutoff after repeated failures. We are a guest on someone else's memorial site.

**Deterministic over clever.** No AI in the core path, no geocoding, no fuzzy dedupe yet. Each of those adds a class of confident-but-wrong output, and each is deferred until there's a review process that could catch it.

## Traps we already hit

- **Trailing slashes and `www` created duplicate targets** before canonicalization existed. Fixed at the URL layer, not by de-duplicating rows afterward.
- **`getaddrinfo` failing in sandboxed environments** while `dns.resolve4` worked. `lib/http.ts` falls back to a direct HTTPS request with SNI.
- **Retrying every failure** hammered Paalam on permanent `404`s. Retries are now limited to transient statuses and thrown network errors.
- **Impossible dates like "February 31, 2021"** used to round into a real date. They now parse to `unknown` precision rather than a wrong day.
- **Paalam self-links counted as sources**, making unsourced records look sourced. Self-links are excluded; malformed `href`s raise a review reason.
- **Tests that reimplemented the parser** passed while the real one regressed. Suites now import from `lib/`.

## Before you change the pipeline

- Run `pnpm test` and `pnpm check`.
- If Paalam's markup changed, add a trimmed fixture rather than loosening the parser.
- If a review-reason count spikes after a run, suspect the parser before suspecting the data.
- Don't add a second source, geocoding, or AI extraction into the core path without revisiting the constraints above — they're in `guide/02_DATA_PIPELINE_PLAN.md` §7–8 for a reason.
